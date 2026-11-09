import assert from 'node:assert/strict';
import test from 'node:test';
import { DataTypes } from 'sequelize';
import { ConfigurationError, readConfig } from '../config.js';
import { createDatabase } from '../database/sequelize.js';

const env = {
  PG_HOST: 'localhost',
  PG_DATABASE: 'transporte_test',
  PG_USER: 'teste',
  PG_PASSWORD: 'segredo_de_teste',
};

test('configuração aplica portas padrão e SSL desativado no ambiente local', () => {
  const config = readConfig(env);
  assert.equal(config.port, 3000);
  assert.equal(config.database.port, 5432);
  assert.equal(config.database.ssl, false);
  assert.equal(config.database.password, env.PG_PASSWORD);
});

test('configuração aceita portas explícitas e SSL para banco externo', () => {
  const config = readConfig({ ...env, API_PORT: '8080', PG_PORT: '5433', PG_SSL: 'true' });
  assert.equal(config.port, 8080);
  assert.equal(config.database.port, 5433);
  assert.equal(config.database.ssl, true);
});

test('portas inválidas são rejeitadas sem aceitar conversão parcial', () => {
  for (const key of ['API_PORT', 'PG_PORT']) {
    for (const value of ['', '0', '-1', '65536', '3000abc', '3.5', 'NaN']) {
      assert.throws(() => readConfig({ ...env, [key]: value }), ConfigurationError);
    }
  }
});

test('variáveis de conexão obrigatórias não ficam vazias nem expõem valores no erro', () => {
  for (const key of Object.keys(env)) {
    for (const value of [undefined, '', '   ']) {
      assert.throws(() => readConfig({ ...env, [key]: value }), error => {
        assert.equal(error.name, 'ConfigurationError');
        assert.match(error.message, new RegExp(key));
        assert.doesNotMatch(error.message, /segredo_de_teste/);
        return true;
      });
    }
  }
});

test('SSL aceita somente true ou false explícitos', () => {
  for (const value of ['', '1', 'yes', 'FALSE']) {
    assert.throws(() => readConfig({ ...env, PG_SSL: value }), ConfigurationError);
  }
});

test('Sequelize gera UUID v4 com a dependência uuid corrigida', async () => {
  const database = createDatabase(readConfig(env).database);
  try {
    const Example = database.define('Example', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    });
    const item = Example.build();
    assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    await database.close();
  }
});
