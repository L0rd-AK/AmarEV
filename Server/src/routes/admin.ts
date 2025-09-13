import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth';

export const adminRoutes = Router();

// Admin-only routes
adminRoutes.get('/dashboard', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Admin dashboard', stats: {} });
});

adminRoutes.get('/users', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Get all users', users: [] });
});

adminRoutes.get('/stations', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Get all stations for admin', stations: [] });
});

adminRoutes.post('/stations', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Create station', station: req.body });
});

adminRoutes.put('/stations/:id', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Update station', stationId: req.params.id });
});