import { Router } from 'express';
import { authenticate } from '@/middleware/auth';

export const reservationRoutes = Router();

// Reservation management
reservationRoutes.get('/', authenticate, (req, res) => {
  res.json({ message: 'Get user reservations', reservations: [] });
});

reservationRoutes.post('/', authenticate, (req, res) => {
  res.json({ message: 'Create reservation', reservation: req.body });
});

reservationRoutes.get('/:id', authenticate, (req, res) => {
  res.json({ message: 'Get reservation', reservationId: req.params.id });
});

reservationRoutes.put('/:id', authenticate, (req, res) => {
  res.json({ message: 'Update reservation', reservationId: req.params.id });
});

reservationRoutes.delete('/:id', authenticate, (req, res) => {
  res.json({ message: 'Cancel reservation', reservationId: req.params.id });
});