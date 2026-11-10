import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryTypes } from 'sequelize';
import { loadConfig } from '../config.js';
import { createDatabase } from './sequelize.js';

export async function runMigrations(database) {
  const directory = new URL('./migrations/', import.meta.url);
  const files = (await readdir(directory))
    .filter(name => /^\d{3}-[a-z0-9-]+\.js$/.test(name))
    .sort();

  return database.transaction(async transaction => {
    // Serializa inicializações concorrentes; o lock termina com a transação.
    await database.query('SELECT pg_advisory_xact_lock(67650001)', { transaction });
    await database.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `, { transaction });
    const applied = await database.query('SELECT name FROM schema_migrations', {
      type: QueryTypes.SELECT,
      transaction,
    });
    const known = new Set(applied.map(row => row.name));
    const executed = [];

    for (const name of files) {
      if (known.has(name)) continue;
      const migration = await import(new URL(name, directory));
      await migration.up({ database, transaction });
      await database.query('INSERT INTO schema_migrations (name) VALUES ($1)', {
        bind: [name],
        transaction,
      });
      executed.push(name);
    }
    return executed;
  });
}

async function main() {
  let database;
  try {
    database = createDatabase(loadConfig().database);
    await database.authenticate();
    const executed = await runMigrations(database);
    console.log(executed.length ? `Migrações aplicadas: ${executed.join(', ')}` : 'Migrações já atualizadas.');
  } catch (error) {
    console.error(`Não foi possível aplicar as migrações (${error.name}).`);
    process.exitCode = 1;
  } finally {
    await database?.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
