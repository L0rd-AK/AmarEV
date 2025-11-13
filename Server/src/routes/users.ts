import { Router } from 'express';  
import { authenticate, authorize } from '@/middleware/auth';
import { UserController } from '@/controllers/UserController';

export const userRoutes = Router();

// User profile management
userRoutes.get('/profile', authenticate, UserController.getProfile);
userRoutes.put('/profile', authenticate, UserController.validateProfileUpdate, UserController.updateProfile);

// User statistics
userRoutes.get('/stats', authenticate, UserController.getUserStats);

// User vehicles
userRoutes.get('/vehicles', authenticate, (req, res) => {
  res.json({ message: 'Get user vehicles' });
});

userRoutes.post('/vehicles', authenticate, (req, res) => {
  res.json({ message: 'Add user vehicle' });
});

// User reservations
userRoutes.get('/reservations', authenticate, (req, res) => {
  res.json({ message: 'Get user reservations' });
});

// User settings
userRoutes.get('/settings', authenticate, (req, res) => {
  res.json({ message: 'Get user settings' });
});

userRoutes.put('/settings', authenticate, (req, res) => {
  res.json({ message: 'Update user settings' });
});