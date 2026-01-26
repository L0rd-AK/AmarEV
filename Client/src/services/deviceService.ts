import { apiClient } from './authService';
import { Device, DeviceTelemetry } from '@chargebd/shared';

/**
 * THEORETICAL DEVICE SERVICE
 * Frontend API service for ESP32 device management
 */

interface DeviceRegistration {
  deviceId: string;
  stationId: string;
  portId?: string;
  name: string;
  type?: string;
  firmwareVersion?: string;
  macAddress?: string;
}

interface DeviceHealth {
  deviceId: string;
  status: string;
  lastSeen: Date;
  isOnline: boolean;
  uptime?: number;
  rssi?: number;
  temperature?: number;
  recentErrors: number;
}

class DeviceService {
  
  /**
   * Register a new device (operator only)
   */
  async registerDevice(data: DeviceRegistration): Promise<{
    device: Device;
    apiKey: string;
  }> {
    const response = await apiClient['request']<{ device: Device; apiKey: string }>(
      '/device/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response.data!;
  }

  /**
   * Get all devices for a station
   */
  async getStationDevices(stationId: string): Promise<Device[]> {
    const response = await apiClient['request']<Device[]>(
      `/device/station/${stationId}/devices`,
      { method: 'GET' }
    );
    return response.data || [];
  }

  /**
   * Get device status and health
   */
  async getDeviceStatus(deviceId: string): Promise<DeviceHealth> {
    const response = await apiClient['request']<DeviceHealth>(
      `/device/${deviceId}/status`,
      { method: 'GET' }
    );
    return response.data!;
  }

  /**
   * Get device telemetry history
   */
  async getTelemetryHistory(
    deviceId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<DeviceTelemetry[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient['request']<DeviceTelemetry[]>(
      `/device/${deviceId}/telemetry?${queryParams.toString()}`,
      { method: 'GET' }
    );
    return response.data || [];
  }

  /**
   * Update device configuration
   */
  async updateDevice(
    deviceId: string,
    data: Partial<Device>
  ): Promise<Device> {
    const response = await apiClient['request']<Device>(
      `/device/${deviceId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return response.data!;
  }

  /**
   * Deactivate a device
   */
  async deleteDevice(deviceId: string): Promise<void> {
    await apiClient['request']<void>(
      `/device/${deviceId}`,
      { method: 'DELETE' }
    );
  }
}

export const deviceService = new DeviceService();
export default deviceService;
