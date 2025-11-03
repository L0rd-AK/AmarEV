import { Router } from 'express';
import { authenticate, optionalAuthenticate, authorize } from '@/middleware/auth';
import { StationController } from '@/controllers/StationController';
import { UserRole } from '@chargebd/shared';

export const stationRoutes = Router();

// Public station endpoints
stationRoutes.get('/', optionalAuthenticate, StationController.getStations);
stationRoutes.get('/search/nearby', optionalAuthenticate, StationController.searchNearby);
stationRoutes.get('/:id', optionalAuthenticate, StationController.getStationById);

// Protected station endpoints - Operator/Admin only
stationRoutes.post('/', authenticate, authorize(UserRole.OPERATOR, UserRole.ADMIN), StationController.createStation);
stationRoutes.put('/:id', authenticate, authorize(UserRole.OPERATOR, UserRole.ADMIN), StationController.updateStation);
stationRoutes.delete('/:id', authenticate, authorize(UserRole.OPERATOR, UserRole.ADMIN), StationController.deleteStation);

// Operator dashboard endpoints
stationRoutes.get('/operator/my-stations', authenticate, authorize(UserRole.OPERATOR, UserRole.ADMIN), StationController.getOperatorStations);
stationRoutes.get('/:id/analytics', authenticate, authorize(UserRole.OPERATOR, UserRole.ADMIN), StationController.getStationAnalytics);

// Connector management
stationRoutes.post('/:id/connectors', authenticate, authorize(UserRole.OPERATOR, UserRole.ADMIN), StationController.addConnector);
stationRoutes.put('/:id/connectors/:connectorId', authenticate, authorize(UserRole.OPERATOR, UserRole.ADMIN), StationController.updateConnector);