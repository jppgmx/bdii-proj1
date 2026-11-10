export async function up({ database, transaction }) {
  await database.query(`
    CREATE TABLE universidades (
      id UUID PRIMARY KEY,
      nome VARCHAR(160) NOT NULL CHECK (length(trim(nome)) > 0),
      sigla VARCHAR(20),
      campus VARCHAR(120),
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE paradas (
      id UUID PRIMARY KEY,
      nome VARCHAR(120) NOT NULL CHECK (length(trim(nome)) > 0),
      descricao VARCHAR(500),
      universidade_id UUID NOT NULL REFERENCES universidades(id),
      localizacao geometry(Point, 4326) NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL,
      CHECK (NOT ST_IsEmpty(localizacao) AND
        ST_X(localizacao) BETWEEN -180 AND 180 AND ST_Y(localizacao) BETWEEN -90 AND 90)
    );
    CREATE INDEX paradas_localizacao_gist ON paradas USING GIST (localizacao);
    CREATE INDEX paradas_universidade_id_idx ON paradas (universidade_id);
  `, { transaction });
}
