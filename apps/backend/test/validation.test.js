import assert from 'node:assert/strict';
import test from 'node:test';
import { bboxInput, busPositionInput, onibusInput, paradaInput, proximityInput, universidadeInput, uuid } from '../validation.js';
const valid = { nome: ' Parada ', universidade_id: '10000000-0000-4000-8000-000000000001', localizacao: { type: 'Point', coordinates: [-38.55, -6.88] } };
function rejects(fn, field) {
  assert.throws(fn, error => error.status === 400 && error.code === 'VALIDATION_ERROR' && Boolean(error.fields[field]));
}
test('normaliza textos e campos opcionais sem aceitar campos controlados pelo servidor', () => {
  assert.deepEqual(universidadeInput({ nome: ' UFCG ' }), { nome: 'UFCG', sigla: null, campus: null });
  assert.equal(paradaInput({ ...valid, descricao: '  ' }).descricao, null);
  assert.equal(paradaInput(valid).nome, 'Parada');
  for (const body of [null, [], 'texto']) rejects(() => universidadeInput(body), 'body');
  for (const field of ['id', 'createdAt', 'updatedAt', 'extra']) rejects(() => paradaInput({ ...valid, [field]: 'x' }), field);
  rejects(() => universidadeInput({ nome: 'x'.repeat(161) }), 'nome');
  rejects(() => universidadeInput({ nome: 'UFCG', sigla: ' ' }), 'sigla');
  rejects(() => universidadeInput({ nome: 'UFCG', campus: 2 }), 'campus');
  rejects(() => paradaInput({ ...valid, nome: ' ' }), 'nome');
  rejects(() => paradaInput({ ...valid, descricao: 'x'.repeat(501) }), 'descricao');
  rejects(() => uuid('inválido'), 'id');
});
test('rejeita geometria inválida e preserva a ordem longitude/latitude', () => {
  for (const point of [null, {}, [], { type: 'LineString', coordinates: [0, 0] },
    ...[[0], [0, 0, 0], ['0', 0], [null, 0], [Infinity, 0], [181, 0], [0, -91]].map(coordinates => ({ type: 'Point', coordinates })),
    { type: 'Point', coordinates: [0, 0], crs: 'não permitido' }]) {
    rejects(() => paradaInput({ ...valid, localizacao: point }), 'localizacao');
  }
  assert.deepEqual(paradaInput(valid).localizacao.coordinates, [-38.55, -6.88]);
});
test('bbox é obrigatório e estrito, com intervalos geográficos ordenados', () => {
  for (const bbox of [undefined, '', [], '0,0,1', '0,,1,1', '0,0,1m,1', '0,0,0,1', '1,0,-1,1', '-181,0,1,1', '0,-91,1,1', '0,0,181,1', '0,0,1,91', '0,0,Infinity,1', '0,0,0x10,1']) rejects(() => bboxInput(bbox), 'bbox');
  assert.deepEqual(bboxInput('-38.58,-6.91,-38.53,-6.86'), [-38.58, -6.91, -38.53, -6.86]);
});

test('proximidade valida números estritos, limites e parâmetros obrigatórios', () => {
  const valid = { lat: '-6.889', lng: '-38.545', raio_m: '2000', bbox: '-38.58,-6.91,-38.53,-6.86' };
  assert.deepEqual(proximityInput(valid), { lat: -6.889, lng: -38.545, raio_m: 2000, bbox: [-38.58, -6.91, -38.53, -6.86] });
  for (const field of ['lat', 'lng', 'raio_m']) {
    for (const value of [undefined, '', ' ', [], ['1', '2'], '1m', 'Infinity', 'NaN', '0x10', '1; SELECT 1']) {
      rejects(() => proximityInput({ ...valid, [field]: value }), field);
    }
  }
  for (const [field, values] of [['lat', ['-90.1', '90.1']], ['lng', ['-180.1', '180.1']], ['raio_m', ['0', '-1', '50000.1', '1e999']]]) {
    for (const value of values) rejects(() => proximityInput({ ...valid, [field]: value }), field);
  }
  rejects(() => proximityInput({ ...valid, bbox: undefined }), 'bbox');
  assert.equal(proximityInput({ ...valid, raio_m: '5e4', lat: '90', lng: '-180' }).raio_m, 50000);
  assert.equal(proximityInput({ ...valid, raio_m: '0.5', lat: '-90', lng: '180' }).raio_m, 0.5);
});

test('ônibus começa sem posição e aceita somente o ponto na atualização manual', () => {
  const universidade_id = '10000000-0000-4000-8000-000000000001';
  assert.deepEqual(onibusInput({ identificacao: ' DEMO-01 ', universidade_id }), { identificacao: 'DEMO-01', universidade_id });
  for (const identificacao of [undefined, '', ' ', 123, 'x'.repeat(61)]) rejects(() => onibusInput({ identificacao, universidade_id }), 'identificacao');
  rejects(() => onibusInput({ identificacao: 'DEMO', universidade_id: 'invalido' }), 'universidade_id');
  for (const field of ['id', 'posicao_atual', 'posicao_atualizada_em', 'createdAt', 'updatedAt']) {
    rejects(() => onibusInput({ identificacao: 'DEMO', universidade_id, [field]: null }), field);
  }
  const point = { type: 'Point', coordinates: [-38.55, -6.88] };
  assert.deepEqual(busPositionInput({ posicao_atual: point }), point);
  for (const posicao_atual of [undefined, null, {}, { type: 'Point', coordinates: [181, 0] }, { type: 'Point', coordinates: ['0', 0] }]) {
    rejects(() => busPositionInput({ posicao_atual }), 'posicao_atual');
  }
  for (const field of ['posicao_atualizada_em', 'universidade_id', 'identificacao', 'updatedAt']) {
    rejects(() => busPositionInput({ posicao_atual: point, [field]: 'indevido' }), field);
  }
});
