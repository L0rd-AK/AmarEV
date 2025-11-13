import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AdminController } from '../controllers/AdminController';
import { UserRole } from '@chargebd/shared';

export const adminRoutes = Router();

adminRoutes.get('/dashboard', authenticate, authorize(UserRole.ADMIN), AdminController.getDashboardAnalytics);
adminRoutes.get('/system-stats', authenticate, authorize(UserRole.ADMIN), AdminController.getSystemStats);
adminRoutes.get('/users', authenticate, authorize(UserRole.ADMIN), AdminController.getAllUsers);
adminRoutes.put('/users/:userId/status', authenticate, authorize(UserRole.ADMIN), AdminController.updateUserStatus);
