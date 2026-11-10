import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locationSearch } from '../src/geocodificacao.js';

const first = { nome: 'Vila de Exemplo', localizacao: { type: 'Point', coordinates: [-30, -5] } };
const second = { nome: 'Praça Inventada', localizacao: { type: 'Point', coordinates: [-31, -6] } };

test('codifica q na URL relativa de busca', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json([first]));
  const search = locationSearch((items) => assert.deepEqual(items, [first]), assert.fail);
  await search.run('Vila São Exemplo & Praça');
  assert.equal(fetch.mock.calls[0].arguments[0], '/api/geocodificacao?q=Vila%20S%C3%A3o%20Exemplo%20%26%20Pra%C3%A7a');
});

test('remove espaços nas extremidades antes de codificar q', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json([first]));
  const search = locationSearch((items) => assert.deepEqual(items, [first]), assert.fail);
  await search.run('  IFSertão PB Cajazeiras  ');
  assert.equal(fetch.mock.calls[0].arguments[0], '/api/geocodificacao?q=IFSert%C3%A3o%20PB%20Cajazeiras');
});

test('a resposta antiga não sobrescreve a mais recente', async (t) => {
  const pending = [];
  t.mock.method(globalThis, 'fetch', () => new Promise((resolve) => pending.push(resolve)));
  const results = [];
  const search = locationSearch((items) => results.push(items), assert.fail);
  const older = search.run('Vila de Exemplo');
  const newer = search.run('Praça Inventada');
  pending[1](Response.json([second]));
  await newer;
  pending[0](Response.json([first]));
  await older;
  assert.deepEqual(results, [[second]]);
});

for (const [header, seconds] of [['3', 3], ['30', 30], [null, 60], ['amanhã', 60], ['abc', 60]]) {
  test(`bloqueia nova busca por ${seconds}s com Retry-After ${header}`, async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(
      { error: { code: 'RATE_LIMITED', message: 'Limite de teste.' } },
      { status: 429, headers: header === null ? {} : { 'Retry-After': header } },
    ));
    let now = 1_000;
    const errors = [];
    const search = locationSearch(assert.fail, (error, deadline) => errors.push([error.status, deadline]), () => now);

    await search.run('Vila de Exemplo');
    assert.deepEqual(errors, [[429, now + seconds * 1000]]);
    search.cancel();
    now += seconds * 1000 - 1;
    await search.run('Praça Inventada');
    assert.equal(fetch.mock.callCount(), 1);
    now += 1;
    await search.run('Praça Inventada');
    assert.equal(fetch.mock.callCount(), 2);
  });
}

test('falha de rede chama o tratamento de erro', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Falha simulada'); });
  const errors = [];
  const search = locationSearch(assert.fail, (error) => errors.push(error));
  await search.run('Vila de Exemplo');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Não foi possível conectar à API.');
  assert.equal(errors[0].status, undefined);
});
