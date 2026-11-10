export async function up({ database, transaction }) {
  await database.query(`
    CREATE TABLE onibus (
      id UUID PRIMARY KEY,
      identificacao VARCHAR(60) NOT NULL CHECK (length(trim(identificacao)) > 0),
      universidade_id UUID NOT NULL REFERENCES universidades(id),
      posicao_atual geometry(Point, 4326),
      posicao_atualizada_em TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL,
      CHECK ((posicao_atual IS NULL AND posicao_atualizada_em IS NULL) OR
        (posicao_atual IS NOT NULL AND posicao_atualizada_em IS NOT NULL)),
      CHECK (posicao_atual IS NULL OR (NOT ST_IsEmpty(posicao_atual) AND
        ST_X(posicao_atual) BETWEEN -180 AND 180 AND ST_Y(posicao_atual) BETWEEN -90 AND 90))
    );
    CREATE INDEX onibus_posicao_atual_gist ON onibus USING GIST (posicao_atual) WHERE posicao_atual IS NOT NULL;
    CREATE INDEX onibus_universidade_id_idx ON onibus (universidade_id);
  `, { transaction });
}
