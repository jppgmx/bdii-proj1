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
