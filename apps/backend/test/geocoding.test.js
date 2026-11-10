import assert from 'node:assert/strict';
import test from 'node:test';
import { readGeocodingConfig, ConfigurationError } from '../config.js';
import { searchInput } from '../services/geocoding.js';

test('busca exige texto de 3 a 200 caracteres e normaliza espaços e Unicode', () => {
  assert.equal(searchInput('  São   Gonçalo, Sousa  '), 'São Gonçalo, Sousa');
  assert.equal(searchInput('Sa\u0303o Gonçalo'), 'São Gonçalo');
  for (const value of [undefined, null, [], ['Sousa'], 123, '', '  ', 'ab', 'x'.repeat(201)]) {
    assert.throws(() => searchInput(value), error => error.status === 400 && Boolean(error.fields.q));
  }
});
test('configuração identifica a aplicação e permite trocar Nominatim por ambiente', () => {
  const defaults = readGeocodingConfig({});
  assert.equal(defaults.url, 'https://nominatim.openstreetmap.org/search');
  assert.match(defaults.userAgent, /bdii-proj1/);
  assert.equal(defaults.timeoutMs, 5000);
  assert.equal(defaults.cacheTtlSeconds, 86400);
  assert.equal(readGeocodingConfig({ GEOCODING_URL: 'http://localhost:8080/search' }).url, 'http://localhost:8080/search');
  for (const url of ['', 'not-a-url', 'file:///tmp/search', 'https://user:pass@example.org/search', 'https://example.org/search?q=x', 'https://example.org/search#x']) {
    assert.throws(() => readGeocodingConfig({ GEOCODING_URL: url }), ConfigurationError);
  }
  for (const value of ['0', '-1', '1s', '1.5', 'Infinity', '']) {
    assert.throws(() => readGeocodingConfig({ GEOCODING_TIMEOUT_MS: value }), ConfigurationError);
    assert.throws(() => readGeocodingConfig({ GEOCODING_CACHE_TTL_SECONDS: value }), ConfigurationError);
  }
  for (const value of ['', '  ', 'invalid\r\nheader', 'não ASCII']) {
    assert.throws(() => readGeocodingConfig({ GEOCODING_USER_AGENT: value }), ConfigurationError);
  }
});
