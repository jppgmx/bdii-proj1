import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { QueryTypes } from 'sequelize';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';
import { runMigrations } from '../database/migrate.js';
import { checkDatabase, createDatabase } from '../database/sequelize.js';

// Executar com npm run test:integration e um PostGIS de desenvolvimento acessível.
test('PostGIS real, migrações concorrentes/repetíveis e saúde integrada', { timeout: 30000 }, async t => {
  const database = createDatabase(loadConfig().database);
  t.after(() => database.close());
  await database.authenticate();
  const executions = await Promise.all([runMigrations(database), runMigrations(database)]);
  assert.ok(executions.flat().filter(name => name === '001-enable-postgis.js').length <= 1);
  assert.deepEqual(await runMigrations(database), []);
  const rows = await database.query('SELECT name FROM schema_migrations WHERE name = $1', {
    bind: ['001-enable-postgis.js'],
    type: QueryTypes.SELECT,
  });
  assert.equal(rows.length, 1);
  await checkDatabase(database);

  const server = createApp({ database }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'ok' });
});

test('etapa 2: CRUD persistente, bbox inclusivo, validação e carga idempotente', { timeout: 30000 }, async t => {
  const { seedDemo } = await import('../database/seed.js');
  const { defineModels } = await import('../model/index.js');
  const database = createDatabase(loadConfig().database);
  let universityId;
  t.after(async () => {
    try {
      if (universityId) {
        const { Universidade, Parada } = defineModels(database);
        await Parada.destroy({ where: { universidade_id: universityId } });
        await Universidade.destroy({ where: { id: universityId } });
      }
    } finally {
      await database.close();
    }
  });
  await runMigrations(database);
  const { Universidade, Parada } = defineModels(database);
  await seedDemo(database);
  await seedDemo(database);
  const samples = await database.query("SELECT count(*)::int AS total FROM paradas WHERE id::text LIKE '20000000-0000-4000-8000-%'", { type: QueryTypes.SELECT });
  assert.equal(samples[0].total, 8);
  const universities = await database.query("SELECT count(*)::int AS total FROM universidades WHERE id::text LIKE '10000000-0000-4000-8000-%'", { type: QueryTypes.SELECT });
  assert.equal(universities[0].total, 8);

  const server = createApp({ database }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  async function request(path, status, method = 'GET', body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = response.status === 204 ? await response.text() : await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  const uni = await request('/universidades', 201, 'POST', { nome: ' Teste etapa 2 ', sigla: 'UFCG' });
  assert.equal(uni.nome, 'Teste etapa 2');
  assert.equal(uni.campus, null);
  universityId = uni.id;
  assert.ok((await request('/universidades', 200)).some(row => row.id === uni.id));
  const data = { nome: ' Borda do mapa ', descricao: ' texto ', universidade_id: uni.id, localizacao: { type: 'Point', coordinates: [10, 20] } };
  const created = await request('/paradas', 201, 'POST', data);
  assert.equal(created.nome, 'Borda do mapa');
  assert.equal(created.descricao, 'texto');
  assert.deepEqual(created.localizacao, data.localizacao);
  assert.ok(Number.isFinite(Date.parse(created.createdAt)));
  assert.equal((await request(`/paradas/${created.id}`, 200)).id, created.id);
  for (const bbox of ['10,20,11,21', '9,19,10,20']) {
    assert.ok((await request(`/paradas?bbox=${bbox}`, 200)).some(row => row.id === created.id));
  }
  assert.deepEqual(await request('/paradas?bbox=11,21,12,22', 200), []);
  assert.equal((await request('/paradas?bbox=-38.58,-6.91,-38.53,-6.86', 200)).length, 5);
  assert.equal((await request('/paradas?bbox=-38.58,-6.91,-38.22,-6.77', 200)).length, 8);
  const bounds = await request('/paradas', 400);
  assert.equal(bounds.error.code, 'VALIDATION_ERROR');
  assert.ok(bounds.error.fields.bbox);
  await request('/paradas?bbox=0,0,1m,1', 400);
  await request('/paradas?bbox=0,0,1,1&bbox=0,0,2,2', 400);
  await request('/paradas/invalido', 400);
  await request('/paradas/ffffffff-ffff-4fff-8fff-ffffffffffff', 404);
  await request('/paradas', 400, 'POST', { ...data, id: created.id });
  await request('/paradas', 400, 'POST', { ...data, universidade_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' });
  await request('/paradas', 400, 'POST', { ...data, localizacao: { type: 'Point', coordinates: ['10', 20] } });
  await request(`/paradas/${created.id}`, 400, 'PUT', { descricao: 'incompleto' });
  const changed = await request(`/paradas/${created.id}`, 200, 'PUT', { ...data, descricao: undefined, localizacao: { type: 'Point', coordinates: [11, 21] } });
  assert.equal(changed.descricao, null);
  assert.equal(changed.createdAt, created.createdAt);
  assert.ok(Date.parse(changed.updatedAt) >= Date.parse(created.updatedAt));
  assert.deepEqual((await Parada.findByPk(created.id)).localizacao.coordinates, [11, 21]);
  assert.deepEqual(await request('/paradas?bbox=9,19,10,20', 200), []);
  assert.ok((await request('/paradas?bbox=11,21,12,22', 200)).some(row => row.id === created.id));
  const spatial = await database.query('SELECT ST_SRID(localizacao) AS srid, GeometryType(localizacao) AS type FROM paradas WHERE id = $1', { bind: [created.id], type: QueryTypes.SELECT });
  assert.deepEqual(spatial[0], { srid: 4326, type: 'POINT' });
  const indexes = await database.query("SELECT indexdef FROM pg_indexes WHERE tablename = 'paradas' AND indexname = 'paradas_localizacao_gist'", { type: QueryTypes.SELECT });
  assert.match(indexes[0].indexdef, /USING gist/);
  assert.equal(await request(`/paradas/${created.id}`, 204, 'DELETE'), '');
  await request(`/paradas/${created.id}`, 404);
  await request(`/paradas/${created.id}`, 404, 'DELETE');
  await request(`/paradas/${created.id}`, 404, 'PUT', data);
  assert.equal(await Parada.findByPk(created.id), null);
});

test('etapa 3: Nominatim, cache persistente, concorrência, limites e erros HTTP', { timeout: 30000 }, async t => {
  const { createGeocoder } = await import('../services/geocoding.js');
  const database = createDatabase(loadConfig().database);
  t.after(() => database.close());
  await runMigrations(database);
  // Banco dedicado: o teste não consulta o serviço público.
  await database.query('DELETE FROM geocoding_cache');
  const resetGate = () => database.query("UPDATE geocoding_limits SET next_allowed = clock_timestamp() - INTERVAL '1 second' WHERE id = 1");
  await resetGate();
  let calls = 0;
  let handle = async () => new Response(JSON.stringify([{ display_name: ' Cajazeiras, Paraíba ', lon: '-38.55', lat: '-6.88' }]));
  const service = () => createGeocoder({ database, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url.searchParams.get('format'), 'jsonv2');
    assert.equal(url.searchParams.get('limit'), '5');
    assert.equal(url.searchParams.get('accept-language'), 'pt-BR');
    assert.equal(url.searchParams.has('bounded'), false);
    assert.match(options.headers['User-Agent'], /bdii-proj1/);
    assert.equal(options.redirect, 'error');
    return handle(url, options);
  } });
  let geocoder = service();
  const expected = [{ nome: 'Cajazeiras, Paraíba', localizacao: { type: 'Point', coordinates: [-38.55, -6.88] } }];
  assert.deepEqual(await geocoder.search(' Cajazeiras, Paraíba '), expected);
  assert.equal(calls, 1);
  geocoder = service(); // Outra instância usa o mesmo cache, sem consumir nova chamada.
  assert.deepEqual(await geocoder.search('CAJAZEIRAS,  PARAÍBA'), expected);
  assert.equal(calls, 1);
  await assert.rejects(geocoder.search('Sousa, Paraíba'), error => error.status === 429 && error.retryAfter >= 1);
  assert.equal(calls, 1);

  const server = createApp({ database, geocoder }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const request = q => fetch(`http://127.0.0.1:${server.address().port}/api/geocodificacao${q}`);
  for (const q of ['', '?q=ab', '?q=Sousa&q=Cajazeiras']) {
    const response = await request(q);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).error.fields.q);
  }
  const hit = await request('?q=Cajazeiras%2C%20Para%C3%ADba');
  assert.equal(hit.status, 200);
  assert.match(hit.headers.get('link'), /openstreetmap.org\/copyright/);
  assert.deepEqual(await hit.json(), expected);
  await resetGate();
  handle = async () => new Response('[]');
  assert.deepEqual(await geocoder.search('Local sem resultado'), []);
  assert.deepEqual(await service().search('Local sem resultado'), []);

  // Consultas concorrentes entre instâncias nunca chamam o provedor em paralelo.
  await resetGate();
  let release;
  let started;
  const began = new Promise(resolve => { started = resolve; });
  const block = new Promise(resolve => { release = resolve; });
  handle = async () => { started(); await block; return new Response('[]'); };
  const pending = geocoder.search('Primeira concorrente');
  await began;
  try {
    const other = await createAppRequest();
    assert.equal(other.status, 429);
    assert.equal(other.headers.get('retry-after'), '1');
    assert.equal((await other.json()).error.code, 'RATE_LIMITED');
  } finally { release(); }
  await pending;
  async function createAppRequest() { return request('?q=Outra%20concorrente'); }

  for (const [label, handler, status, code] of [
    ['indisponível', async () => new Response('segredo', { status: 503 }), 502, 'GEOCODING_UNAVAILABLE'],
    ['JSON inválido', async () => new Response('not-json'), 502, 'GEOCODING_UNAVAILABLE'],
    ['objeto inválido', async () => new Response('{}'), 502, 'GEOCODING_UNAVAILABLE'],
    ['coordenadas inválidas', async () => new Response(JSON.stringify([{ display_name: 'x', lat: null, lon: '' }])), 502, 'GEOCODING_UNAVAILABLE'],
    ['fora do globo', async () => new Response(JSON.stringify([{ display_name: 'x', lat: '91', lon: '0' }])), 502, 'GEOCODING_UNAVAILABLE'],
    ['rede', async () => { throw new TypeError('segredo'); }, 502, 'GEOCODING_UNAVAILABLE'],
    ['tempo', async () => { throw new DOMException('segredo', 'TimeoutError'); }, 504, 'GEOCODING_TIMEOUT'],
  ]) {
    await resetGate(); handle = handler;
    const response = await request(`?q=${encodeURIComponent(label)}`);
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.doesNotMatch(JSON.stringify(body), /segredo/);
    const [gate] = await database.query('SELECT next_allowed > clock_timestamp() AS active FROM geocoding_limits', { type: QueryTypes.SELECT });
    assert.equal(gate.active, true);
  }
  await resetGate();
  handle = async () => new Response('[]', { status: 429, headers: { 'Retry-After': '30' } });
  const limited = await request('?q=Limite%20do%20provedor');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '30');
  await assert.rejects(service().search('Outra após limite'), error => error.status === 429 && error.retryAfter >= 29);
  // Resposta em cache continua disponível durante bloqueio do provedor.
  assert.deepEqual(await geocoder.search('Cajazeiras, Paraíba'), expected);
  await resetGate();
  handle = async () => new Response(JSON.stringify(Array.from({ length: 7 }, () => ({ display_name: 'Sousa', lat: '-6.76', lon: '-38.23' }))));
  assert.equal((await geocoder.search('Sete resultados')).length, 5);
  await resetGate();
  await database.query("UPDATE geocoding_cache SET expires_at = NOW() - INTERVAL '1 second'");
  handle = async () => new Response('[]');
  const count = calls;
  assert.deepEqual(await geocoder.search('Cajazeiras, Paraíba'), []);
  assert.equal(calls, count + 1);
});

test('etapa 4: proximidade em metros, filtros combinados, limite do raio e desempate', { timeout: 30000 }, async t => {
  const { randomUUID } = await import('node:crypto');
  const { defineModels } = await import('../model/index.js');
  const { seedDemo } = await import('../database/seed.js');
  const database = createDatabase(loadConfig().database);
  let universityId;
  t.after(async () => {
    try {
      if (universityId) {
        const { Universidade, Parada } = defineModels(database);
        await Parada.destroy({ where: { universidade_id: universityId } });
        await Universidade.destroy({ where: { id: universityId } });
      }
    } finally { await database.close(); }
  });
  await runMigrations(database);
  await seedDemo(database);
  const { Universidade } = defineModels(database);
  universityId = (await Universidade.create({ nome: 'Teste de proximidade' })).id;
  const distances = [0, 0, 999, 1000, 1000.01, 1500];
  const ids = distances.map(() => randomUUID());
  for (let i = 0; i < distances.length; i++) {
    await database.query(`
      INSERT INTO paradas (id, nome, universidade_id, localizacao, "createdAt", "updatedAt")
      SELECT $1, $2, $3, ST_Project('SRID=4326;POINT(0 0)'::geography, $4::double precision, pi()/2)::geometry, NOW(), NOW()
    `, { bind: [ids[i], 'Parada controlada', universityId, distances[i]] });
  }
  const server = createApp({ database }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const defaults = { lat: '0', lng: '0', raio_m: '1000', bbox: '0,0,0.02,0.01' };
  async function request(params = defaults, status = 200) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/paradas/proximas?${new URLSearchParams(params)}`);
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  const rows = await request();
  assert.deepEqual(rows.map(row => row.id), [...ids.slice(0, 2).sort(), ids[2], ids[3]]);
  assert.equal(rows[0].distancia_m, 0);
  assert.equal(rows[1].distancia_m, 0);
  assert.ok(Math.abs(rows.at(-1).distancia_m - 1000) < 0.000001);
  assert.ok(rows.every(row => typeof row.distancia_m === 'number' && row.distancia_m >= 0));
  assert.deepEqual(rows[0].localizacao, { type: 'Point', coordinates: [0, 0] });
  assert.ok(rows.every(row => row.createdAt && row.updatedAt && row.universidade_id === universityId));
  // Pontos dentro do raio mas fora do retângulo não devem aparecer.
  const cropped = await request({ ...defaults, bbox: '0,-0.01,0.005,0.01' });
  assert.deepEqual(cropped.map(row => row.id), ids.slice(0, 2).sort());
  assert.deepEqual((await request({ ...defaults, bbox: '0.008,-0.01,0.02,0.01' })).map(row => row.id), [ids[2], ids[3]]);
  // Ponto visível no retângulo mas fora do raio também é excluído.
  assert.deepEqual(await request({ ...defaults, raio_m: '500', bbox: '0.008,-0.01,0.02,0.01' }), []);

  const origin = { lat: '-6.889266108880796', lng: '-38.54534133432616', bbox: '-38.58,-6.91,-38.53,-6.86' };
  const sampleId = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  assert.deepEqual((await request({ ...origin, raio_m: '500' })).map(row => row.id), [sampleId(1)]);
  const twoKm = await request({ ...origin, raio_m: '2000' });
  assert.deepEqual(twoKm.map(row => row.id), [sampleId(1), sampleId(5), sampleId(3)]);
  assert.equal(twoKm[0].distancia_m, 0);
  const expanded = { ...origin, bbox: '-38.58,-6.91,-38.22,-6.77' };
  assert.deepEqual((await request({ ...expanded, raio_m: '5000' })).map(row => row.id).sort(), [1, 2, 3, 4, 5].map(sampleId));
  assert.equal((await request({ ...expanded, raio_m: '50000' })).length, 8);
  for (const field of ['lat', 'lng', 'raio_m', 'bbox']) {
    const missing = { ...defaults }; delete missing[field];
    assert.ok((await request(missing, 400)).error.fields[field]);
  }
  for (const [field, value] of [['lat', '91'], ['lng', '-181'], ['raio_m', '0'], ['raio_m', '50001'], ['raio_m', '2000m'], ['bbox', '0,0,0,1']]) {
    const error = await request({ ...defaults, [field]: value }, 400);
    assert.equal(error.error.code, 'VALIDATION_ERROR');
    assert.ok(error.error.fields[field]);
  }
  const duplicate = new URLSearchParams(defaults); duplicate.append('lat', '1');
  assert.ok((await request(duplicate, 400)).error.fields.lat);
  const [index] = await database.query("SELECT indexdef FROM pg_indexes WHERE tablename = 'paradas' AND indexname = 'paradas_localizacao_geography_gist'", { type: QueryTypes.SELECT });
  assert.match(index.indexdef, /USING gist.*geography/i);
});
