import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigurationError(`Defina a variável ${name}.`);
  }
  return value;
}

function port(value, name, fallback) {
  const raw = value ?? String(fallback);
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535) {
    throw new ConfigurationError(`${name} deve ser uma porta entre 1 e 65535.`);
  }
  return Number(raw);
}

export function readGeocodingConfig(env = process.env) {
  const url = env.GEOCODING_URL ?? 'https://nominatim.openstreetmap.org/search';
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
  } catch {
    throw new ConfigurationError('GEOCODING_URL deve ser uma URL HTTP(S) sem credenciais, query ou fragmento.');
  }
  const userAgent = env.GEOCODING_USER_AGENT ?? 'TransporteUniversitarioBDII/0.1 (https://github.com/jppgmx/bdii-proj1)';
  if (!userAgent.trim() || /[^\x20-\x7e]/.test(userAgent)) throw new ConfigurationError('GEOCODING_USER_AGENT deve identificar a aplicação em texto ASCII.');
  const integer = (name, fallback, max) => {
    const value = env[name] ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw new ConfigurationError(`${name} deve ser um inteiro entre 1 e ${max}.`);
    return Number(value);
  };
  return { url, userAgent, timeoutMs: integer('GEOCODING_TIMEOUT_MS', 5000, 60000), cacheTtlSeconds: integer('GEOCODING_CACHE_TTL_SECONDS', 86400, 604800) };
}

export function readConfig(env = process.env) {
  const ssl = env.PG_SSL ?? 'false';
  if (!['true', 'false'].includes(ssl)) {
    throw new ConfigurationError('PG_SSL deve ser true ou false.');
  }

  return {
    geocoding: readGeocodingConfig(env),
    port: port(env.API_PORT, 'API_PORT', 3000),
    database: {
      host: required(env, 'PG_HOST'),
      port: port(env.PG_PORT, 'PG_PORT', 5432),
      name: required(env, 'PG_DATABASE'),
      user: required(env, 'PG_USER'),
      password: required(env, 'PG_PASSWORD'),
      ssl: ssl === 'true',
    },
  };
}

export function loadConfig() {
  loadEnv({
    path: fileURLToPath(new URL('../../.env', import.meta.url)),
    quiet: true,
  });
  return readConfig();
}
