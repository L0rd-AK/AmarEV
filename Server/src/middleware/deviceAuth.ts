import { Request, Response, NextFunction } from 'express';
import { deviceService } from '../services/DeviceManagementService';
import { logger } from '../utils/logger';

/**
 * THEORETICAL DEVICE AUTHENTICATION MIDDLEWARE
 * Validates API key from ESP32 devices for telemetry endpoints
 */

export const authenticateDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get API key from header
    const apiKey = req.header('X-Device-API-Key') || req.header('Authorization')?.replace('Bearer ', '');
    const deviceId = req.body.deviceId || req.params.deviceId;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        message: 'API key required in X-Device-API-Key header'
      });
      return;
    }

    if (!deviceId) {
      res.status(400).json({
        success: false,
        message: 'Device ID required'
      });
      return;
    }

    // Authenticate device
    const device = await deviceService.authenticateDevice(deviceId, apiKey);

    if (!device) {
      logger.warn(`Failed device authentication attempt: ${deviceId}`);
      res.status(401).json({
        success: false,
        message: 'Invalid device credentials'
      });
      return;
    }

    // Attach device to request
    (req as any).device = device;

    next();
  } catch (error) {
    logger.error('Device authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Require operator or admin role for device management endpoints
 */
export const requireOperatorRole = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (user.role !== 'operator' && user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Operator or admin role required'
    });
    return;
  }

  next();
};
