import express from 'express';

export function createGeocodingRouter(geocoder) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    res.set('Link', '<https://www.openstreetmap.org/copyright>; rel="license"');
    res.json(await geocoder.search(req.query.q));
  });
  return router;
}
