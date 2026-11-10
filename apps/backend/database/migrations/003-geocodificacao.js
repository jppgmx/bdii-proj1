export async function up({ database, transaction }) {
  await database.query(`
    CREATE TABLE geocoding_cache (
      key TEXT PRIMARY KEY,
      results JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX geocoding_cache_expiry_idx ON geocoding_cache (expires_at);
    CREATE TABLE geocoding_limits (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      next_allowed TIMESTAMPTZ NOT NULL
    );
    INSERT INTO geocoding_limits VALUES (1, NOW());
  `, { transaction });
}
