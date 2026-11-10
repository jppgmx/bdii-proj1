import { createGeocoder } from './services/geocoding.js';
import { createApp } from './app.js';
import { ConfigurationError, loadConfig } from './config.js';
import { runMigrations } from './database/migrate.js';
import { checkDatabase, createDatabase } from './database/sequelize.js';

async function main() {
  let database;
  try {
    const config = loadConfig();
    database = createDatabase(config.database);
    await database.authenticate();
    await runMigrations(database);
    await checkDatabase(database);

    const app = createApp({ database, geocoder: createGeocoder({ database, ...config.geocoding }) });
    const server = await new Promise((resolve, reject) => {
      const listening = app.listen(config.port, '0.0.0.0', () => resolve(listening));
      listening.once('error', reject);
    });
    console.log(`Servidor disponível na porta ${config.port}.`);

    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      const timeout = setTimeout(() => server.closeAllConnections(), 10000);
      timeout.unref();
      server.close(async () => {
        clearTimeout(timeout);
        await database.close();
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } catch (error) {
    const message = error instanceof ConfigurationError ? error.message : `Falha ao iniciar o servidor (${error.name}).`;
    console.error(message);
    await database?.close();
    process.exitCode = 1;
  }
}

await main();
