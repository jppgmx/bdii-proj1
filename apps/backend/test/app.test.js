import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../app.js';

async function serve(t, { database = { query: async () => [] }, withBuild = true } = {}) {
  const publicDir = await mkdtemp(join(tmpdir(), 'transporte-http-'));
  t.after(() => rm(publicDir, { recursive: true, force: true }));
  if (withBuild) {
    await writeFile(join(publicDir, 'index.html'), '<html><body>React compilado</body></html>');
    await writeFile(join(publicDir, 'app.js'), 'console.log("asset");');
  }
  const app = createApp({ database, publicDir });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}

test('saúde confirma o banco e não divulga identificação do Express', async t => {
  const request = await serve(t);
  const response = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'ok' });
});

test('saúde detecta queda e recuperação do banco sem expor credenciais', async t => {
  let available = true;
  const request = await serve(t, {
    database: {
      query: async () => {
        if (!available) throw new Error('postgres://usuario:segredo@banco');
      },
    },
  });
  assert.equal((await request('/api/health')).status, 200);
  available = false;
  const failure = await request('/api/health');
  assert.equal(failure.status, 503);
  assert.deepEqual(await failure.json(), {
    error: { code: 'DATABASE_UNAVAILABLE', message: 'Banco de dados indisponível.' },
  });
  available = true;
  assert.equal((await request('/api/health')).status, 200);
});

test('API inexistente retorna JSON 404 mesmo com Accept HTML e build disponível', async t => {
  const request = await serve(t);
  for (const path of ['/api', '/api/inexistente', '/api/paradas']) {
    const response = await request(path, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal((await response.json()).error.code, 'NOT_FOUND');
  }
});

test('JSON malformado tem resposta padronizada sem devolver o corpo recebido', async t => {
  const request = await serve(t);
  const response = await request('/api/inexistente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"senha":"segredo",',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: 'INVALID_JSON', message: 'O corpo deve conter JSON válido.' },
  });
});

test('corpo acima de 100 KB é rejeitado com JSON 413', async t => {
  const request = await serve(t);
  const response = await request('/api/inexistente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: 'x'.repeat(101 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('Express entrega index, assets e navegação da SPA', async t => {
  const request = await serve(t);
  for (const path of ['/', '/paradas/editar']) {
    const response = await request(path, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /React compilado/);
  }
  const asset = await request('/app.js');
  assert.equal(asset.status, 200);
  assert.match(await asset.text(), /console.log/);
});

test('asset ausente e métodos de escrita não recebem HTML da SPA', async t => {
  const request = await serve(t);
  const missing = await request('/inexistente.js', { headers: { Accept: 'text/html' } });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'NOT_FOUND');
  const write = await request('/paradas/editar', { method: 'POST' });
  assert.equal(write.status, 404);
});

test('backend funciona sem build React e retorna 404 na interface', async t => {
  const request = await serve(t, { withBuild: false });
  assert.equal((await request('/api/health')).status, 200);
  const response = await request('/', { headers: { Accept: 'text/html' } });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});
