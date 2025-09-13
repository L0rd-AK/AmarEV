import { Router } from 'express';
import { AuthController } from '@/controllers/AuthController';
import { authenticate } from '@/middleware/auth';

export const authRoutes = Router();

// Public routes
authRoutes.post('/register', AuthController.register);
authRoutes.post('/login', AuthController.login);
authRoutes.post('/refresh', AuthController.refresh);
authRoutes.post('/forgot-password', AuthController.forgotPassword);
authRoutes.post('/reset-password', AuthController.resetPassword);
authRoutes.post('/verify-email', AuthController.verifyEmail);

// Protected routes
authRoutes.post('/logout', authenticate, AuthController.logout);
authRoutes.get('/profile', authenticate, AuthController.getProfile);