import { ApiError } from './errors.js';

export function invalid(field, message) {
  const error = new ApiError(400, 'VALIDATION_ERROR', 'Dados inválidos.');
  error.fields = { [field]: message };
  throw error;
}

export function uuid(value, field = 'id') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    invalid(field, 'Informe um UUID válido.');
  }
  return value;
}

function bodyFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body', 'Informe um objeto JSON.');
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) invalid(key, 'Campo desconhecido.');
  }
}

function text(value, field, max, optional = false, emptyAsNull = false) {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== 'string') invalid(field, 'Informe um texto válido.');
  const trimmed = value.trim();
  if (emptyAsNull && trimmed === '') return null;
  if (!trimmed || [...trimmed].length > max) invalid(field, `Informe de 1 a ${max} caracteres.`);
  return trimmed;
}

export function universidadeInput(body) {
  bodyFields(body, ['nome', 'sigla', 'campus']);
  return {
    nome: text(body.nome, 'nome', 160),
    sigla: text(body.sigla, 'sigla', 20, true),
    campus: text(body.campus, 'campus', 120, true),
  };
}

export function paradaInput(body) {
  bodyFields(body, ['nome', 'descricao', 'universidade_id', 'localizacao']);
  const localizacao = pointInput(body.localizacao, 'localizacao');
  return {
    nome: text(body.nome, 'nome', 120),
    descricao: text(body.descricao, 'descricao', 500, true, true),
    universidade_id: uuid(body.universidade_id, 'universidade_id'),
    localizacao,
  };
}

export function bboxInput(value) {
  const fail = () => invalid('bbox', 'Informe west,south,east,north com limites válidos.');
  if (typeof value !== 'string') fail();
  const parts = value.split(',');
  if (parts.length !== 4 || parts.some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(part.trim()))) fail();
  const bounds = parts.map(Number);
  const [west, south, east, north] = bounds;
  if (!bounds.every(Number.isFinite) || west >= east || south >= north ||
      west < -180 || east > 180 || south < -90 || north > 90) fail();
  return bounds;
}

export function proximityInput(query) {
  function number(field, min, max) {
    const raw = query[field];
    if (typeof raw !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) {
      invalid(field, 'Informe um número válido.');
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max || (field === 'raio_m' && value === 0)) {
      invalid(field, field === 'raio_m' ? 'Informe um raio maior que zero e de até 50000 metros.' : `Informe um valor entre ${min} e ${max}.`);
    }
    return value;
  }
  return {
    lat: number('lat', -90, 90),
    lng: number('lng', -180, 180),
    raio_m: number('raio_m', 0, 50000),
    bbox: bboxInput(query.bbox),
  };
}

export function pointInput(point, field) {
  if (!point || typeof point !== 'object' || Array.isArray(point) ||
      Object.keys(point).some(key => !['type', 'coordinates'].includes(key)) ||
      point.type !== 'Point' || !Array.isArray(point.coordinates) || point.coordinates.length !== 2 ||
      !point.coordinates.every(Number.isFinite) ||
      Math.abs(point.coordinates[0]) > 180 || Math.abs(point.coordinates[1]) > 90) {
    invalid(field, 'Informe Point com coordenadas numéricas [longitude, latitude] válidas.');
  }
  return { type: 'Point', coordinates: [...point.coordinates] };
}

export function onibusInput(body) {
  bodyFields(body, ['identificacao', 'universidade_id']);
  return {
    identificacao: text(body.identificacao, 'identificacao', 60),
    universidade_id: uuid(body.universidade_id, 'universidade_id'),
  };
}

export function busPositionInput(body) {
  bodyFields(body, ['posicao_atual']);
  return pointInput(body.posicao_atual, 'posicao_atual');
}
