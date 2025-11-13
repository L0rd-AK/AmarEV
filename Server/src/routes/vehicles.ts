import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { VehicleController } from '../controllers/VehicleController';
import { authenticateToken } from '../middleware/authMiddleware';

export const vehicleRoutes = Router();

// User vehicle management
vehicleRoutes.get('/', authenticateToken, VehicleController.getUserVehicles);
vehicleRoutes.post('/', authenticateToken, VehicleController.createVehicle);
vehicleRoutes.get('/:id', authenticateToken, VehicleController.getVehicleById);
vehicleRoutes.put('/:id', authenticateToken, VehicleController.updateVehicle);
vehicleRoutes.delete('/:id', authenticateToken, VehicleController.deleteVehicle);