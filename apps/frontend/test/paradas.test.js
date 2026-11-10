import assert from 'node:assert/strict';
import { test } from 'node:test';
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

test('descarta sucesso e erro atrasados ao mudar a área e limpar o filtro', async () => {
  const pending = [];
  const results = [];
  const errors = [];
  const requests = latestRequest(
    (signal, url) => new Promise((resolve, reject) => pending.push({ signal, url, resolve, reject })),
    (items) => results.push(items),
    (error) => errors.push(error),
  );
  const filter = { position, radius: 500 };
  const nextBbox = '-38.57,-6.9,-38.52,-6.85';
  const first = requests.run(stopsUrl(bbox, filter));
  const second = requests.run(stopsUrl(nextBbox, filter));
  const cleared = requests.run(stopsUrl(nextBbox, null));

  assert.equal(pending[0].signal.aborted, true);
  assert.equal(pending[1].signal.aborted, true);
  assert.equal(pending[2].signal.aborted, false);
  assert.equal(pending[2].url, `/api/paradas?bbox=${nextBbox}`);

  pending[2].resolve([{ id: 'visível' }]);
  await cleared;
  pending[0].resolve([{ id: 'antiga', distancia_m: 0 }]);
  pending[1].reject(new Error('falha antiga'));
  await Promise.all([first, second]);

  assert.deepEqual(results, [[{ id: 'visível' }]]);
  assert.deepEqual(errors, []);
});
