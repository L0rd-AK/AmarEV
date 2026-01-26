import { Request, Response, NextFunction } from 'express';
import { deviceService } from '../services/DeviceManagementService';
import { logger } from '../utils/logger';
import { Device } from '../models/Device';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * THEORETICAL DEVICE CONTROLLER
 * Handles HTTP requests for ESP32 device management and telemetry
 * Demonstrates RESTful API design for IoT device integration
 */

export class DeviceController {
  
  /**
   * POST /api/device/register
   * Register a new ESP32 device
   * Requires operator authentication
   */
  static async registerDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { deviceId, stationId, portId, name, type, firmwareVersion, macAddress } = req.body;

      // Validation
      if (!deviceId || !stationId || !name) {
        res.status(400).json({ 
          success: false,
          message: 'Missing required fields: deviceId, stationId, name' 
        });
        return;
      }

      // Get operator ID from authenticated user
      const operatorId = (req as any).user?.id;
      if (!operatorId) {
        res.status(401).json({ 
          success: false,
          message: 'Authentication required' 
        });
        return;
      }

      const device = await deviceService.registerDevice({
        deviceId,
        stationId,
        portId,
        name,
        type,
        firmwareVersion,
        macAddress
      }, operatorId);

      logger.info(`Device registered: ${deviceId} by operator ${operatorId}`);

      res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        data: {
          deviceId: device.deviceId,
          apiKey: (device as any).apiKey, // Only returned once!
          stationId: device.stationId,
          name: device.name,
          type: device.type,
        }
      });
    } catch (error: any) {
      logger.error('Error in registerDevice:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || 'Failed to register device' 
      });
    }
  }

  /**
   * POST /api/device/telemetry
   * Receive telemetry data from ESP32 device
   * Requires device API key authentication
   */
  static async receiveTelemetry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const telemetryData = req.body;

      // Validation
      if (!telemetryData.deviceId) {
        res.status(400).json({ 
          success: false,
          message: 'Missing deviceId in telemetry data' 
        });
        return;
      }

      // Device is already authenticated by middleware
      // Process telemetry
      await deviceService.processTelemetry(telemetryData);

      // Return minimal response to save device bandwidth
      res.status(200).json({
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('Error in receiveTelemetry:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to process telemetry' 
      });
    }
  }

  /**
   * GET /api/device/:deviceId/status
   * Get current status of a device
   */
  static async getDeviceStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { deviceId } = req.params;

      if (!deviceId) {
        res.status(400).json({ success: false, message: 'Device ID required' });
        return;
      }

      const health = await deviceService.getDeviceHealth(deviceId);

      if (!health) {
        res.status(404).json({ 
          success: false,
          message: 'Device not found' 
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: health
      });
    } catch (error: any) {
      logger.error('Error in getDeviceStatus:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to get device status' 
      });
    }
  }

  /**
   * GET /api/device/:deviceId/health
   * Device health check endpoint (for devices to ping)
   */
  static async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { deviceId } = req.params;

      const device = await Device.findOne({ deviceId, isActive: true });

      if (!device) {
        res.status(404).json({ 
          success: false,
          message: 'Device not found' 
        });
        return;
      }

      // Update last seen
      device.lastSeen = new Date();
      await device.save();

      res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        serverTime: Date.now()
      });
    } catch (error: any) {
      logger.error('Error in healthCheck:', error);
      res.status(500).json({ 
        success: false,
        message: 'Health check failed' 
      });
    }
  }

  /**
   * GET /api/device/:deviceId/telemetry
   * Get telemetry history for a device
   */
  static async getTelemetryHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate, limit } = req.query;

      if (!deviceId) {
        res.status(400).json({ success: false, message: 'Device ID required' });
        return;
      }

      const history = await deviceService.getTelemetryHistory(
        deviceId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        limit ? parseInt(limit as string) : 100
      );

      res.status(200).json({
        success: true,
        count: history.length,
        data: history
      });
    } catch (error: any) {
      logger.error('Error in getTelemetryHistory:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to get telemetry history' 
      });
    }
  }

  /**
   * GET /api/station/:stationId/devices
   * Get all devices for a station
   */
  static async getStationDevices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId } = req.params;

      if (!stationId) {
        res.status(400).json({ success: false, message: 'Station ID required' });
        return;
      }

      const devices = await deviceService.getStationDevices(stationId);

      res.status(200).json({
        success: true,
        count: devices.length,
        data: devices
      });
    } catch (error: any) {
      logger.error('Error in getStationDevices:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to get station devices' 
      });
    }
  }

  /**
   * PUT /api/device/:deviceId
   * Update device configuration
   */
  static async updateDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { deviceId } = req.params;
      const { name, firmwareVersion, status, isActive } = req.body;

      const device = await Device.findOne({ deviceId });

      if (!device) {
        res.status(404).json({ 
          success: false,
          message: 'Device not found' 
        });
        return;
      }

      // Update fields
      if (name) device.name = name;
      if (firmwareVersion) device.firmwareVersion = firmwareVersion;
      if (status) device.status = status;
      if (typeof isActive === 'boolean') device.isActive = isActive;

      await device.save();

      logger.info(`Device ${deviceId} updated`);

      res.status(200).json({
        success: true,
        message: 'Device updated successfully',
        data: device
      });
    } catch (error: any) {
      logger.error('Error in updateDevice:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to update device' 
      });
    }
  }

  /**
   * DELETE /api/device/:deviceId
   * Deactivate a device (soft delete)
   */
  static async deleteDevice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { deviceId } = req.params;

      const device = await Device.findOne({ deviceId });

      if (!device) {
        res.status(404).json({ 
          success: false,
          message: 'Device not found' 
        });
        return;
      }

      device.isActive = false;
      await device.save();

      logger.info(`Device ${deviceId} deactivated`);

      res.status(200).json({
        success: true,
        message: 'Device deactivated successfully'
      });
    } catch (error: any) {
      logger.error('Error in deleteDevice:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to delete device' 
      });
    }
  }
}

export const deviceController = new DeviceController();
