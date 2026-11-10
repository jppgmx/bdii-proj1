import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { defineModels } from '../model/index.js';
import { createDatabase } from './sequelize.js';
import { runMigrations } from './migrate.js';

export async function seedDemo(database) {
  const data = JSON.parse(await readFile(new URL('../../../docs/dados-demonstracao.json', import.meta.url), 'utf8'));
  const { Universidade, Parada, Onibus } = defineModels(database);
  await database.transaction(async transaction => {
    // IDs estáveis e ON CONFLICT preservam registros existentes, inclusive edições manuais.
    await Universidade.bulkCreate(data.universidades, { transaction, ignoreDuplicates: true });
    await Parada.bulkCreate(data.paradas, { transaction, ignoreDuplicates: true });
    await Onibus.bulkCreate(data.onibus, { transaction, ignoreDuplicates: true });
  });
}

async function main() {
  let database;
  try {
    database = createDatabase(loadConfig().database);
    await runMigrations(database);
    await seedDemo(database);
    console.log('Carga de demonstração concluída: universidades, paradas e ônibus (sem duplicar IDs existentes).');
  } catch (error) {
    console.error(`Falha na carga de demonstração (${error.name}).`);
    process.exitCode = 1;
  } finally {
    await database?.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
