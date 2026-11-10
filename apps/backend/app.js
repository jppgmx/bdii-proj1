import { createGeocoder } from './services/geocoding.js';
import { createGeocodingRouter } from './routes/geocodingRouter.js';
import express from 'express';
import { createDomainRouter } from './routes/domainRouter.js';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorHandler, notFound } from './errors.js';
import { createHealthRouter } from './routes/healthRouter.js';

const defaultPublicDir = fileURLToPath(new URL('./public/', import.meta.url));

export function createApp({ database, publicDir = defaultPublicDir, logger = console, geocoder = createGeocoder({ database }) }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use('/health', createHealthRouter(database));
  api.use('/geocodificacao', createGeocodingRouter(geocoder));
  api.use(createDomainRouter(database));
  api.use(notFound);
  app.use('/api', api);

  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || extname(req.path) || !req.accepts('html')) {
      return next();
    }
    res.sendFile(join(publicDir, 'index.html'), error => {
      if (!error) return;
      if (error.statusCode === 404 || error.code === 'ENOENT') return next();
      next(error);
    });
  });
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
