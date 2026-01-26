import { Device, DeviceDocument, DeviceStatus } from '../models/Device';
import { DeviceTelemetry, TelemetryType } from '../models/DeviceTelemetry';
import { Connector } from '../models/Connector';
import { ConnectorStatus } from '@chargebd/shared';
import { Station } from '../models/Station';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { io } from '../config/socket';

/**
 * THEORETICAL DEVICE MANAGEMENT SERVICE
 * Handles ESP32 device lifecycle, telemetry processing, and health monitoring
 * This demonstrates IoT backend integration patterns for academic purposes
 */

export interface TelemetryPayload {
  deviceId: string;
  stationId: string;
  portId?: string;
  status?: string;
  voltage?: number;
  current?: number;
  power?: number;
  energyWh?: number;
  temperature?: number;
  humidity?: number;
  connectorStatus?: 'connected' | 'disconnected' | 'charging' | 'idle';
  rssi?: number;
  uptime?: number;
  timestamp?: Date;
  errorCode?: string;
  errorMessage?: string;
}

export interface DeviceRegistration {
  deviceId: string;
  stationId: string;
  portId?: string;
  name: string;
  type?: string;
  firmwareVersion?: string;
  macAddress?: string;
}

export interface DeviceHealth {
  deviceId: string;
  status: DeviceStatus;
  lastSeen: Date;
  isOnline: boolean;
  uptime?: number;
  rssi?: number;
  temperature?: number;
  recentErrors: number;
}

export class DeviceManagementService {
  
  /**
   * Register a new ESP32 device to the system
   * Generates a unique API key for device authentication
   */
  async registerDevice(data: DeviceRegistration, operatorId: string): Promise<DeviceDocument> {
    try {
      // Verify station exists and belongs to operator
      const station = await Station.findOne({ 
        _id: data.stationId, 
        operatorId 
      });
      
      if (!station) {
        throw new Error('Station not found or unauthorized');
      }

      // Check if device already exists
      const existingDevice = await Device.findOne({ deviceId: data.deviceId });
      if (existingDevice) {
        throw new Error('Device ID already registered');
      }

      // Generate secure API key for device
      const apiKey = this.generateApiKey();

      const device = new Device({
        deviceId: data.deviceId,
        stationId: data.stationId,
        portId: data.portId,
        name: data.name,
        type: data.type || 'esp32',
        firmwareVersion: data.firmwareVersion || '1.0.0',
        macAddress: data.macAddress,
        apiKey,
        status: DeviceStatus.OFFLINE,
        isActive: true,
      });

      await device.save();
      
      logger.info(`Device registered: ${data.deviceId} for station ${data.stationId}`);
      
      // Return device with API key (only time it's returned)
      const deviceWithKey = device.toObject();
      deviceWithKey.apiKey = apiKey;
      
      return deviceWithKey as DeviceDocument;
    } catch (error) {
      logger.error('Error registering device:', error);
      throw error;
    }
  }

  /**
   * Process incoming telemetry data from ESP32 device
   * Updates device status and stores telemetry record
   */
  async processTelemetry(payload: TelemetryPayload): Promise<void> {
    try {
      // Find device by deviceId
      const device = await Device.findOne({ deviceId: payload.deviceId });
      
      if (!device) {
        logger.warn(`Telemetry from unknown device: ${payload.deviceId}`);
        return;
      }

      // Update device last seen and status
      const previousStatus = device.status;
      device.lastSeen = new Date();
      device.status = DeviceStatus.ONLINE;
      
      if (payload.rssi) {
        device.rssi = payload.rssi;
      }

      await device.save();

      // Store telemetry data
      const telemetry = new DeviceTelemetry({
        deviceId: device._id,
        stationId: device.stationId,
        portId: payload.portId || device.portId,
        type: this.determineTelemetryType(payload),
        timestamp: payload.timestamp || new Date(),
        status: payload.status,
        voltage: payload.voltage,
        current: payload.current,
        power: payload.power,
        energyWh: payload.energyWh,
        temperature: payload.temperature,
        humidity: payload.humidity,
        connectorStatus: payload.connectorStatus,
        rssi: payload.rssi,
        uptime: payload.uptime,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
      });

      await telemetry.save();

      // Update connector status based on device telemetry
      await this.updateConnectorStatus(device, payload);

      // Emit real-time updates via Socket.IO
      await this.emitDeviceUpdate(device, payload);

      // Check for alerts (temperature, errors, etc.)
      await this.checkForAlerts(device, payload);

      // Log status change
      if (previousStatus !== DeviceStatus.ONLINE) {
        logger.info(`Device ${device.deviceId} came online`);
      }

    } catch (error) {
      logger.error('Error processing telemetry:', error);
      throw error;
    }
  }

  /**
   * Update connector availability based on device telemetry
   */
  private async updateConnectorStatus(device: DeviceDocument, payload: TelemetryPayload): Promise<void> {
    try {
      if (!device.portId) return;

      // Find connector by portId (assuming portId matches connector ID)
      const connector = await Connector.findOne({
        stationId: device.stationId,
        _id: device.portId
      });

      if (!connector) return;

      let newStatus = connector.status;

      // Determine connector status from device telemetry
      if (payload.connectorStatus === 'charging') {
        newStatus = ConnectorStatus.OCCUPIED;
      } else if (payload.connectorStatus === 'connected' || payload.connectorStatus === 'idle') {
        newStatus = ConnectorStatus.AVAILABLE;
      } else if (payload.connectorStatus === 'disconnected') {
        newStatus = ConnectorStatus.AVAILABLE;
      }

      // Check for errors or faults
      if (payload.errorCode || payload.errorMessage) {
        newStatus = ConnectorStatus.MAINTENANCE;
      }

      // Update if changed
      if (connector.status !== newStatus) {
        connector.status = newStatus;
        await connector.save();
        
        logger.info(`Connector ${connector._id} status updated to ${newStatus} from device telemetry`);
        
        // Emit connector update
        if (io) {
          io.of('/public').to(`station:${device.stationId}`).emit('connector:updated', {
            connectorId: connector._id,
            status: newStatus,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      logger.error('Error updating connector status:', error);
    }
  }

  /**
   * Emit real-time device updates via Socket.IO
   */
  private async emitDeviceUpdate(device: DeviceDocument, payload: TelemetryPayload): Promise<void> {
    if (!io) return;

    const updateData = {
      deviceId: device.deviceId,
      stationId: device.stationId,
      status: device.status,
      lastSeen: device.lastSeen,
      telemetry: {
        voltage: payload.voltage,
        current: payload.current,
        power: payload.power,
        temperature: payload.temperature,
        connectorStatus: payload.connectorStatus,
      },
      timestamp: new Date()
    };

    // Emit to station room
    io.of('/public').to(`station:${device.stationId}`).emit('device:updated', updateData);
    
    // Emit to operator namespace for station owners
    io.of('/operator').to(`station:${device.stationId}`).emit('device:telemetry', updateData);
  }

  /**
   * Check telemetry for alerts and anomalies
   */
  private async checkForAlerts(device: DeviceDocument, payload: TelemetryPayload): Promise<void> {
    const alerts: string[] = [];

    // Temperature alert (> 80°C is concerning for most components)
    if (payload.temperature && payload.temperature > 80) {
      alerts.push(`High temperature: ${payload.temperature}°C`);
    }

    // Error alerts
    if (payload.errorCode || payload.errorMessage) {
      alerts.push(`Device error: ${payload.errorCode} - ${payload.errorMessage}`);
    }

    // Low signal strength alert
    if (payload.rssi && payload.rssi < -85) {
      alerts.push(`Weak WiFi signal: ${payload.rssi} dBm`);
    }

    // Send alerts if any
    if (alerts.length > 0 && io) {
      io.of('/operator').to(`station:${device.stationId}`).emit('device:alert', {
        deviceId: device.deviceId,
        stationId: device.stationId,
        alerts,
        timestamp: new Date(),
        severity: this.calculateAlertSeverity(payload)
      });
      
      logger.warn(`Device ${device.deviceId} alerts: ${alerts.join(', ')}`);
    }
  }

  /**
   * Detect and mark offline devices
   * Should be run periodically (e.g., every minute)
   */
  async detectOfflineDevices(): Promise<void> {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      
      // Find devices that were online but haven't sent telemetry recently
      const offlineDevices = await Device.find({
        status: DeviceStatus.ONLINE,
        lastSeen: { $lt: twoMinutesAgo },
        isActive: true
      });

      for (const device of offlineDevices) {
        const previousStatus = device.status;
        device.status = DeviceStatus.OFFLINE;
        await device.save();

        logger.warn(`Device ${device.deviceId} marked as offline (last seen: ${device.lastSeen})`);

        // Update connector to offline if linked
        if (device.portId) {
          await Connector.findByIdAndUpdate(device.portId, {
            status: ConnectorStatus.OFFLINE
          });
        }

        // Emit offline notification
        if (io) {
          io.of('/operator').to(`station:${device.stationId}`).emit('device:offline', {
            deviceId: device.deviceId,
            stationId: device.stationId,
            lastSeen: device.lastSeen,
            timestamp: new Date()
          });
        }
      }

      if (offlineDevices.length > 0) {
        logger.info(`Marked ${offlineDevices.length} devices as offline`);
      }
    } catch (error) {
      logger.error('Error detecting offline devices:', error);
    }
  }

  /**
   * Get device health status
   */
  async getDeviceHealth(deviceId: string): Promise<DeviceHealth | null> {
    try {
      const device = await Device.findOne({ deviceId });
      if (!device) return null;

      // Get recent errors (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentErrors = await DeviceTelemetry.countDocuments({
        deviceId: device._id,
        type: TelemetryType.ERROR,
        timestamp: { $gte: oneDayAgo }
      });

      // Get latest telemetry for metrics
      const latestTelemetry = await DeviceTelemetry.findOne({
        deviceId: device._id
      }).sort({ timestamp: -1 });

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const isOnline = device.lastSeen >= twoMinutesAgo;

      return {
        deviceId: device.deviceId,
        status: device.status,
        lastSeen: device.lastSeen,
        isOnline,
        uptime: latestTelemetry?.uptime,
        rssi: device.rssi,
        temperature: latestTelemetry?.temperature,
        recentErrors
      };
    } catch (error) {
      logger.error('Error getting device health:', error);
      return null;
    }
  }

  /**
   * Get telemetry history for a device
   */
  async getTelemetryHistory(
    deviceId: string, 
    startDate?: Date, 
    endDate?: Date, 
    limit: number = 100
  ): Promise<any[]> {
    try {
      const device = await Device.findOne({ deviceId });
      if (!device) return [];

      const query: any = { deviceId: device._id };
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
      }

      return await DeviceTelemetry.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      logger.error('Error getting telemetry history:', error);
      return [];
    }
  }

  /**
   * Get all devices for a station
   */
  async getStationDevices(stationId: string): Promise<DeviceDocument[]> {
    try {
      return await Device.find({ stationId, isActive: true })
        .sort({ name: 1 });
    } catch (error) {
      logger.error('Error getting station devices:', error);
      return [];
    }
  }

  /**
   * Authenticate device API key
   */
  async authenticateDevice(deviceId: string, apiKey: string): Promise<DeviceDocument | null> {
    try {
      const device = await Device.findOne({ 
        deviceId, 
        isActive: true 
      }).select('+apiKey');

      if (!device) return null;

      // Compare API keys (constant-time comparison)
      const isValid = crypto.timingSafeEqual(
        Buffer.from(apiKey),
        Buffer.from(device.apiKey)
      );

      return isValid ? device : null;
    } catch (error) {
      logger.error('Error authenticating device:', error);
      return null;
    }
  }

  // Helper methods

  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private determineTelemetryType(payload: TelemetryPayload): TelemetryType {
    if (payload.errorCode || payload.errorMessage) {
      return TelemetryType.ERROR;
    }
    if (payload.energyWh || payload.power) {
      return TelemetryType.CHARGING_METRICS;
    }
    if (payload.connectorStatus) {
      return TelemetryType.STATUS_UPDATE;
    }
    return TelemetryType.SENSOR_DATA;
  }

  private calculateAlertSeverity(payload: TelemetryPayload): 'low' | 'medium' | 'high' | 'critical' {
    if (payload.errorCode) return 'critical';
    if (payload.temperature && payload.temperature > 90) return 'high';
    if (payload.temperature && payload.temperature > 80) return 'medium';
    if (payload.rssi && payload.rssi < -85) return 'medium';
    return 'low';
  }
}

export const deviceService = new DeviceManagementService();
