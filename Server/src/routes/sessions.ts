import { Router } from 'express';
import { authenticateToken } from '@/middleware/authMiddleware';
import { ChargingSimulationController } from '@/controllers/ChargingSimulationController';

export const sessionRoutes = Router();

// === ESP32 Charging Simulation Routes (must be before /:id to avoid capture) ===

// Start a simulated charging session (user)
sessionRoutes.post('/charging/start', authenticateToken, ChargingSimulationController.startCharging);

// Stop a charging session (user)
sessionRoutes.post('/charging/stop', authenticateToken, ChargingSimulationController.stopCharging);

// Get charging status for a reservation (user)
sessionRoutes.get('/charging/status/:reservationId', authenticateToken, ChargingSimulationController.getChargingStatus);

// Get all active charging sessions (admin only)
sessionRoutes.get('/charging/active', authenticateToken, ChargingSimulationController.getActiveChargingSessions);

// === General Session Routes ===

sessionRoutes.get('/', authenticateToken, (req, res) => {
  // Return empty array in expected format
  res.json({ data: [], count: 0 });
});

sessionRoutes.post('/start', authenticateToken, (req, res) => {
  res.json({ message: 'Start charging session', session: req.body });
});

sessionRoutes.post('/stop/:id', authenticateToken, (req, res) => {
  res.json({ message: 'Stop charging session', sessionId: req.params.id });
});

sessionRoutes.get('/:id', authenticateToken, (req, res) => {
  res.json({ message: 'Get session details', sessionId: req.params.id });
});