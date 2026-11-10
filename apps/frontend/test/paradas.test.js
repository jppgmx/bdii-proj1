import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bboxFromBounds, formatDistance, latestRequest, stopsUrl } from '../src/paradas.js';

const position = { lat: -6.889266, lng: -38.545341 };
const bbox = '-38.58,-6.91,-38.53,-6.86';

test('monta URL relativa com lat antes de lng para os três raios', () => {
  for (const radius of [500, 1000, 2000]) {
    assert.equal(stopsUrl(bbox, { position, radius }),
      `/api/paradas/proximas?lat=-6.889266&lng=-38.545341&raio_m=${radius}&bbox=${bbox}`);
  }
});

test('serializa os quatro limites do mapa como west,south,east,north', () => {
  assert.equal(bboxFromBounds({
    getWest: () => -38.58,
    getSouth: () => -6.91,
    getEast: () => -38.53,
    getNorth: () => -6.86,
  }), bbox);
});

test('limpar o filtro volta à consulta somente por bbox', () => {
  assert.equal(stopsUrl(bbox, null), `/api/paradas?bbox=${bbox}`);
});

test('uma nova área altera somente o bbox, preservando origem e raio', () => {
  const filter = { position, radius: 1000 };
  const nextBbox = '-38.25,-6.79,-38.22,-6.77';
  assert.equal(stopsUrl(nextBbox, filter), stopsUrl(bbox, filter).replace(bbox, nextBbox));
});

test('exibe distância zero e arredonda a distância apenas para exibição', () => {
  assert.equal(formatDistance(0), '0 m');
  assert.equal(formatDistance(500.6), '501 m');
});

function requestFixture() {
  const requestId = { current: 0 };
  const pending = [];
  const results = [];
  const errors = [];
  const requests = latestRequest(
    requestId,
    (signal, url) => new Promise((resolve, reject) => pending.push({ signal, url, resolve, reject })),
    (items) => results.push(items),
    (error) => errors.push(error),
  );
  return { requestId, requests, pending, results, errors };
}

describe('latestRequest', () => {
  const nearby = stopsUrl(bbox, { position, radius: 500 });
  const visible = stopsUrl(bbox, null);

  test('descarta sucesso atrasado de uma consulta com requestId anterior', async () => {
    const { requestId, requests, pending, results } = requestFixture();
    const old = requests.run(nearby);
    const current = requests.run(visible);

    assert.equal(requestId.current, 2);
    assert.equal(pending[0].signal.aborted, true);
    pending[1].resolve([{ id: 'visível' }]);
    await current;
    pending[0].resolve([{ id: 'antiga', distancia_m: 0 }]);
    await old;

    assert.deepEqual(results, [[{ id: 'visível' }]]);
  });

  test('descarta erro atrasado e entrega o erro do requestId atual', async () => {
    const { requestId, requests, pending, errors } = requestFixture();
    const old = requests.run(nearby);
    const current = requests.run(visible);
    const currentError = new Error('falha atual');

    assert.equal(requestId.current, 2);
    pending[1].reject(currentError);
    await current;
    pending[0].reject(new Error('falha antiga'));
    await old;

    assert.deepEqual(errors, [currentError]);
  });

  test('limpar incrementa requestId e invalida o sucesso anterior antes da nova consulta', async () => {
    const { requestId, requests, pending, results } = requestFixture();
    const old = requests.run(nearby);
    const oldId = requestId.current;

    requests.cancel();
    assert.equal(requestId.current, oldId + 1);
    pending[0].resolve([{ id: 'antiga', distancia_m: 0 }]);
    await old;
    assert.deepEqual(results, []);

    const cleared = requests.run(visible);
    assert.equal(requestId.current, oldId + 2);
    assert.equal(pending[1].url, `/api/paradas?bbox=${bbox}`);
    pending[1].resolve([{ id: 'visível' }]);
    await cleared;
    assert.deepEqual(results, [[{ id: 'visível' }]]);
  });

  test('a mesma chave dispara uma única requisição', async () => {
    const { requestId, requests, pending } = requestFixture();
    const first = requests.run(nearby);
    await requests.run(nearby);

    assert.equal(pending[0].signal.aborted, false);
    pending[0].resolve([]);
    await first;
    await requests.run(nearby);

    assert.equal(pending.length, 1);
    assert.equal(requestId.current, 1);
  });

  test('uma atualização explícita permite consultar novamente a mesma chave', async () => {
    const { requests, pending } = requestFixture();
    const first = requests.run(nearby);
    pending[0].resolve([]);
    await first;

    requests.cancel();
    const refreshed = requests.run(nearby);
    assert.equal(pending.length, 2);
    pending[1].resolve([]);
    await refreshed;
  });
});
