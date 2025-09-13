import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { RouteController } from '../controllers/RouteController';

const router = Router();
const routeController = new RouteController();

// Basic route calculation (public)
router.post('/calculate', optionalAuthenticate, routeController.calculateRoute);

// Route planning with charging stops (requires auth)
router.post('/plan-charging', authenticate, routeController.planRouteWithCharging);

// Find charging stations near route (public)
router.post('/stations/nearby', optionalAuthenticate, routeController.findChargingStationsNearRoute);

// Isochrone calculation (public)
router.post('/isochrone', optionalAuthenticate, routeController.getIsochrone);

// Route analysis
router.get('/analysis/:routeId', authenticate, routeController.getRouteAnalysis);

// Save/manage routes (requires auth)
router.post('/save', authenticate, routeController.saveRoute);
router.get('/saved', authenticate, routeController.getSavedRoutes);
router.delete('/saved/:routeId', authenticate, routeController.deleteRoute);

export default router;