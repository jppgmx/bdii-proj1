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
