import { Router } from 'express';
import { authenticate } from '@/middleware/auth';

export const vehicleRoutes = Router();

// User vehicle management
vehicleRoutes.get('/', authenticate, (req, res) => {
  res.json({ message: 'Get user vehicles', vehicles: [] });
});

vehicleRoutes.post('/', authenticate, (req, res) => {
  res.json({ message: 'Add vehicle', vehicle: req.body });
});

vehicleRoutes.put('/:id', authenticate, (req, res) => {
  res.json({ message: 'Update vehicle', vehicleId: req.params.id });
});

vehicleRoutes.delete('/:id', authenticate, (req, res) => {
  res.json({ message: 'Delete vehicle', vehicleId: req.params.id });
});