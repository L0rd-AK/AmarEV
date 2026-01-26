import { Router } from 'express';
import { DeviceController } from '../controllers/DeviceController';
import { authenticateDevice, requireOperatorRole } from '../middleware/deviceAuth';
import { authenticate } from '../middleware/auth';

/**
 * THEORETICAL DEVICE API ROUTES
 * RESTful endpoints for ESP32 device management and telemetry
 */

const router = Router();

// === DEVICE REGISTRATION & MANAGEMENT (Requires operator auth) ===

/**
 * POST /api/device/register
 * Register a new ESP32 device to the system
 * Returns API key (only shown once!)
 */
router.post('/register', authenticate, requireOperatorRole, DeviceController.registerDevice);

/**
 * GET /api/station/:stationId/devices
 * Get all devices for a specific station
 */
router.get('/station/:stationId/devices', authenticate, DeviceController.getStationDevices);

/**
 * PUT /api/device/:deviceId
 * Update device configuration
 */
router.put('/:deviceId', authenticate, requireOperatorRole, DeviceController.updateDevice);

/**
 * DELETE /api/device/:deviceId
 * Deactivate a device (soft delete)
 */
router.delete('/:deviceId', authenticate, requireOperatorRole, DeviceController.deleteDevice);

// === DEVICE TELEMETRY ENDPOINTS (Requires device API key) ===

/**
 * POST /api/device/telemetry
 * Receive telemetry data from ESP32 device
 * Requires X-Device-API-Key header
 * 
 * Expected payload:
 * {
 *   "deviceId": "DEV-001",
 *   "stationId": "station_id",
 *   "portId": "port_1",
 *   "voltage": 220.5,
 *   "current": 16.2,
 *   "power": 3500,
 *   "energyWh": 1250,
 *   "temperature": 42.5,
 *   "connectorStatus": "charging",
 *   "rssi": -65,
 *   "uptime": 86400,
 *   "timestamp": "2026-01-26T10:30:00Z"
 * }
 */
router.post('/telemetry', authenticateDevice, DeviceController.receiveTelemetry);

/**
 * GET /api/device/:deviceId/health
 * Health check endpoint for devices
 * Minimal response to save bandwidth
 */
router.get('/:deviceId/health', authenticateDevice, DeviceController.healthCheck);

// === DEVICE STATUS & ANALYTICS (Requires user auth) ===

/**
 * GET /api/device/:deviceId/status
 * Get current status and health of a device
 */
router.get('/:deviceId/status', authenticate, DeviceController.getDeviceStatus);

/**
 * GET /api/device/:deviceId/telemetry
 * Get historical telemetry data
 * Query params: startDate, endDate, limit
 */
router.get('/:deviceId/telemetry', authenticate, DeviceController.getTelemetryHistory);

export { router as deviceRoutes };
