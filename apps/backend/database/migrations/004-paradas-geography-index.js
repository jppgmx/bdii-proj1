export async function up({ database, transaction }) {
  await database.query('CREATE INDEX paradas_localizacao_geography_gist ON paradas USING GIST ((localizacao::geography))', { transaction });
}
