import { Sequelize } from 'sequelize';

export function createDatabase(config) {
  return new Sequelize(config.name, config.user, config.password, {
    dialect: 'postgres',
    host: config.host,
    port: config.port,
    logging: false,
    retry: { max: 0 },
    pool: { max: 5, min: 0, acquire: 10000, idle: 10000 },
    dialectOptions: {
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      ssl: config.ssl ? { require: true, rejectUnauthorized: true } : false,
    },
  });
}

export async function checkDatabase(database) {
  await database.query('SELECT PostGIS_Version() AS version');
}
