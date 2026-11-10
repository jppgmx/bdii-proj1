import { Router } from 'express';
import { checkDatabase } from '../database/sequelize.js';
import { ApiError } from '../errors.js';

export function createHealthRouter(database) {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      await checkDatabase(database);
    } catch {
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Banco de dados indisponível.');
    }
    res.json({ status: 'ok', database: 'ok' });
  });
  return router;
}
