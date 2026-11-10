import express from 'express';
import { QueryTypes } from 'sequelize';
import { defineModels } from '../model/index.js';
import { ApiError } from '../errors.js';
import { bboxInput, invalid, paradaInput, proximityInput, universidadeInput, uuid } from '../validation.js';

export function createDomainRouter(database) {
  const router = express.Router();
  // Os modelos só são definidos ao atender rotas de domínio; importar não altera o banco.
  const models = () => defineModels(database);
  router.get('/universidades', async (_req, res) => {
    res.json(await models().Universidade.findAll({ order: [['nome', 'ASC'], ['id', 'ASC']] }));
  });
  router.post('/universidades', async (req, res) => {
    const input = universidadeInput(req.body);
    res.status(201).json(await models().Universidade.create(input));
  });
  router.get('/paradas', async (req, res) => {
    const bind = bboxInput(req.query.bbox);
    const rows = await database.query(`
      SELECT id, nome, descricao, universidade_id,
        json_build_object('type', 'Point', 'coordinates', json_build_array(ST_X(localizacao), ST_Y(localizacao))) AS localizacao, "createdAt", "updatedAt"
      FROM paradas
      WHERE ST_Covers(ST_MakeEnvelope($1, $2, $3, $4, 4326), localizacao)
      ORDER BY nome, id
    `, { bind, type: QueryTypes.SELECT });
    res.json(rows);
  });
  // A rota de proximidade deve preceder /paradas/:id.
  router.get('/paradas/proximas', async (req, res) => {
    const { lat, lng, raio_m, bbox } = proximityInput(req.query);
    const rows = await database.query(`
      WITH origem AS (
        SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS ponto
      )
      SELECT p.id, p.nome, p.descricao, p.universidade_id,
        json_build_object('type', 'Point', 'coordinates', json_build_array(ST_X(p.localizacao), ST_Y(p.localizacao))) AS localizacao,
        p."createdAt", p."updatedAt",
        ST_Distance(p.localizacao::geography, origem.ponto) AS distancia_m
      FROM paradas p CROSS JOIN origem
      WHERE ST_Covers(ST_MakeEnvelope($3, $4, $5, $6, 4326), p.localizacao)
        AND ST_DWithin(p.localizacao::geography, origem.ponto, $7)
      ORDER BY distancia_m, p.id
    `, { bind: [lng, lat, ...bbox, raio_m], type: QueryTypes.SELECT });
    res.json(rows);
  });
  async function find(id) {
    const parada = await models().Parada.findByPk(uuid(id));
    if (!parada) throw new ApiError(404, 'NOT_FOUND', 'Parada não encontrada.');
    return parada;
  }
  async function input(body) {
    const data = paradaInput(body);
    if (!await models().Universidade.findByPk(data.universidade_id)) {
      invalid('universidade_id', 'Universidade não encontrada.');
    }
    return data;
  }
  router.get('/paradas/:id', async (req, res) => res.json(await find(req.params.id)));
  router.post('/paradas', async (req, res) => res.status(201).json(await models().Parada.create(await input(req.body))));
  router.put('/paradas/:id', async (req, res) => {
    const parada = await find(req.params.id);
    res.json(await parada.update(await input(req.body)));
  });
  router.delete('/paradas/:id', async (req, res) => {
    await (await find(req.params.id)).destroy();
    res.status(204).end();
  });
  return router;
}
