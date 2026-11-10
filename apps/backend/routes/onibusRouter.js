import express from 'express';
import { QueryTypes } from 'sequelize';
import { defineModels } from '../model/index.js';
import { ApiError } from '../errors.js';
import { bboxInput, busPositionInput, invalid, onibusInput, uuid } from '../validation.js';

const columns = `id, identificacao, universidade_id,
  CASE WHEN posicao_atual IS NULL THEN NULL ELSE
    json_build_object('type', 'Point', 'coordinates', json_build_array(ST_X(posicao_atual), ST_Y(posicao_atual)))
  END AS posicao_atual, posicao_atualizada_em, "createdAt", "updatedAt"`;

export function createOnibusRouter(database) {
  const router = express.Router();
  const select = (sql, bind = []) => database.query(sql, { bind, type: QueryTypes.SELECT });
  router.get('/', async (_req, res) => {
    res.json(await select(`SELECT ${columns} FROM onibus ORDER BY identificacao, id`));
  });
  router.post('/', async (req, res) => {
    const data = onibusInput(req.body);
    const { Universidade, Onibus } = defineModels(database);
    if (!await Universidade.findByPk(data.universidade_id)) invalid('universidade_id', 'Universidade não encontrada.');
    res.status(201).json(await Onibus.create(data));
  });
  router.get('/posicoes', async (req, res) => {
    const bind = bboxInput(req.query.bbox);
    res.json(await select(`SELECT ${columns} FROM onibus
      WHERE posicao_atual IS NOT NULL AND ST_Covers(ST_MakeEnvelope($1, $2, $3, $4, 4326), posicao_atual)
      ORDER BY identificacao, id`, bind));
  });
  router.patch('/:id/posicao', async (req, res) => {
    const id = uuid(req.params.id);
    const point = busPositionInput(req.body);
    // Um UPDATE persiste ponto e horário; RETURNING devolve o estado da gravação.
    const rows = await select(`UPDATE onibus SET
      posicao_atual = ST_SetSRID(ST_MakePoint($2, $3), 4326),
      posicao_atualizada_em = clock_timestamp(), "updatedAt" = clock_timestamp()
      WHERE id = $1 RETURNING ${columns}`, [id, ...point.coordinates]);
    if (!rows.length) throw new ApiError(404, 'NOT_FOUND', 'Ônibus não encontrado.');
    res.json(rows[0]);
  });
  return router;
}
