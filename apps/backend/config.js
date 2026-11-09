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

export function readConfig(env = process.env) {
  const ssl = env.PG_SSL ?? 'false';
  if (!['true', 'false'].includes(ssl)) {
    throw new ConfigurationError('PG_SSL deve ser true ou false.');
  }

  return {
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
