import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '@/middleware/auth';

export const stationRoutes = Router();

// Public station endpoints
stationRoutes.get('/', optionalAuthenticate, (req, res) => {
  res.json({ message: 'Get all stations', stations: [] });
});

stationRoutes.get('/:id', optionalAuthenticate, (req, res) => {
  res.json({ message: 'Get station by id', stationId: req.params.id });
});

// Search stations
stationRoutes.get('/search/nearby', optionalAuthenticate, (req, res) => {
  res.json({ message: 'Search nearby stations', stations: [] });
});