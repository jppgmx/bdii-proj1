export async function up({ database, transaction }) {
  await database.query('CREATE EXTENSION IF NOT EXISTS postgis', { transaction });
}
