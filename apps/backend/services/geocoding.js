import { createHash } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { readGeocodingConfig } from '../config.js';
import { ApiError } from '../errors.js';
import { invalid } from '../validation.js';

function limited(seconds) {
  const error = new ApiError(429, 'RATE_LIMITED', 'Aguarde antes de pesquisar outra localidade.');
  error.retryAfter = Math.max(1, Math.ceil(seconds));
  return error;
}
function unavailable() {
  return new ApiError(502, 'GEOCODING_UNAVAILABLE', 'Não foi possível consultar o serviço de localidades.');
}
export function searchInput(value) {
  if (typeof value !== 'string') invalid('q', 'Informe um texto de 3 a 200 caracteres.');
  const query = value.trim().normalize('NFC');
  if ([...query].length < 3 || [...query].length > 200) invalid('q', 'Informe um texto de 3 a 200 caracteres.');
  return query.replace(/\s+/g, ' ');
}
function normalize(rows) {
  if (!Array.isArray(rows)) throw unavailable();
  return rows.slice(0, 5).map(row => {
    if (!row || typeof row.display_name !== 'string' || !row.display_name.trim()) throw unavailable();
    const coordinate = (value, max) => {
      if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') throw unavailable();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value))) throw unavailable();
      const n = Number(value);
      if (!Number.isFinite(n) || Math.abs(n) > max) throw unavailable();
      return n;
    };
    return { nome: row.display_name.trim(), localizacao: { type: 'Point', coordinates: [coordinate(row.lon, 180), coordinate(row.lat, 90)] } };
  });
}

export function createGeocoder({ database, fetchImpl = fetch, ...options }) {
  const config = { ...readGeocodingConfig({}), ...options };
  const select = (sql, bind, transaction) => database.query(sql, { bind, transaction, type: QueryTypes.SELECT });
  async function cached(key, transaction) {
    const rows = await select('SELECT results FROM geocoding_cache WHERE key = $1 AND expires_at > NOW()', [key], transaction);
    return rows[0]?.results;
  }
  return {
    async search(value) {
      const q = searchInput(value);
      const key = createHash('sha256').update(JSON.stringify([config.url, 'pt-BR', q.toLocaleLowerCase('pt-BR')])).digest('hex');
      const hit = await cached(key);
      if (hit !== undefined) return hit;
      // Lock compartilhado no PostgreSQL: concorrência e limite abrangem toda a aplicação.
      const outcome = await database.transaction(async transaction => {
        const [lock] = await select('SELECT pg_try_advisory_xact_lock(67650002) AS acquired', [], transaction);
        if (!lock.acquired) return { error: limited(1) };
        const hit = await cached(key, transaction);
        if (hit !== undefined) return { results: hit };
        const [gate] = await select('SELECT EXTRACT(EPOCH FROM (next_allowed - clock_timestamp()))::float AS seconds FROM geocoding_limits WHERE id = 1', [], transaction);
        if (gate.seconds > 0) return { error: limited(gate.seconds) };
        await database.query("UPDATE geocoding_limits SET next_allowed = clock_timestamp() + INTERVAL '1 second' WHERE id = 1", { transaction });
        const url = new URL(config.url);
        url.search = new URLSearchParams({ q, format: 'jsonv2', limit: '5', 'accept-language': 'pt-BR' }).toString();
        let response;
        try {
          response = await fetchImpl(url, {
            headers: { 'User-Agent': config.userAgent, Accept: 'application/json' },
            signal: AbortSignal.timeout(config.timeoutMs), redirect: 'error',
          });
          if (response.status === 429) {
            const raw = response.headers.get('retry-after');
            const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : (Date.parse(raw) - Date.now()) / 1000;
            const retry = Number.isFinite(seconds) ? Math.min(86400, Math.max(1, Math.ceil(seconds))) : 60;
            await response.body?.cancel();
            await database.query("UPDATE geocoding_limits SET next_allowed = clock_timestamp() + $1 * INTERVAL '1 second' WHERE id = 1", { bind: [retry], transaction });
            return { error: limited(retry) };
          }
          if (!response.ok) { await response.body?.cancel(); return { error: unavailable() }; }
          const results = normalize(await response.json());
          await database.query('DELETE FROM geocoding_cache WHERE expires_at <= NOW()', { transaction });
          // Mantém até 1000 buscas recentes, incluindo consultas sem resultados.
          await database.query('DELETE FROM geocoding_cache WHERE key IN (SELECT key FROM geocoding_cache ORDER BY expires_at DESC OFFSET 999)', { transaction });
          await database.query("INSERT INTO geocoding_cache (key, results, expires_at) VALUES ($1, $2::jsonb, clock_timestamp() + $3 * INTERVAL '1 second') ON CONFLICT (key) DO UPDATE SET results = EXCLUDED.results, expires_at = EXCLUDED.expires_at", { bind: [key, JSON.stringify(results), config.cacheTtlSeconds], transaction });
          return { results };
        } catch (error) {
          // Retornar o erro permite persistir o intervalo mesmo quando o provedor falha.
          if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return { error: new ApiError(504, 'GEOCODING_TIMEOUT', 'O serviço de localidades demorou para responder.') };
          }
          if (error instanceof ApiError) return { error };
          // Falhas de banco devem provocar rollback e ser tratadas pela camada de erros.
          if (error.name?.startsWith('Sequelize')) throw error;
          return { error: unavailable() };
        }
      });
      if (outcome.error) throw outcome.error;
      return outcome.results;
    },
  };
}
