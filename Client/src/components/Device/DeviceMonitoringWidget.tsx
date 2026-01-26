import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Device, DeviceTelemetry } from '@chargebd/shared';
import { selectStationDevices } from '../../store/slices/deviceSlice';
import { DeviceStatusIndicator } from './DeviceStatusIndicator';
import { deviceService } from '../../services/deviceService';

/**
 * THEORETICAL DEVICE MONITORING WIDGET
 * Dashboard widget for station operators to monitor their ESP32 devices
 * Shows real-time device health, connectivity, and sensor readings
 */

interface DeviceMonitoringWidgetProps {
  stationId: string;
}

export const DeviceMonitoringWidget: React.FC<DeviceMonitoringWidgetProps> = ({
  stationId,
}) => {
  const devices = useSelector(selectStationDevices(stationId));
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [telemetry, setTelemetry] = useState<DeviceTelemetry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  useEffect(() => {
    if (selectedDevice) {
      loadTelemetry(selectedDevice.deviceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      await deviceService.getStationDevices(stationId);
      // Device list would be fetched and dispatched to Redux store
      // For now, using selector directly
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTelemetry = async (deviceId: string) => {
    try {
      const data = await deviceService.getTelemetryHistory(deviceId, { limit: 10 });
      setTelemetry(data);
    } catch (error) {
      console.error('Failed to load telemetry:', error);
    }
  };

  const getDeviceStats = () => {
    const online = devices.filter(d => d.status === 'online').length;
    const offline = devices.filter(d => d.status === 'offline').length;
    const fault = devices.filter(d => d.status === 'fault').length;
    return { online, offline, fault, total: devices.length };
  };

  const stats = getDeviceStats();
  const latestTelemetry = telemetry[0];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Device Monitoring
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total Devices</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.online}</div>
          <div className="text-xs text-gray-500">Online</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-400">{stats.offline}</div>
          <div className="text-xs text-gray-500">Offline</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats.fault}</div>
          <div className="text-xs text-gray-500">Faults</div>
        </div>
      </div>

      {/* Device List */}
      <div className="space-y-2 mb-6">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No devices registered for this station
          </div>
        ) : (
          devices.map((device) => (
            <div
              key={device.deviceId}
              onClick={() => setSelectedDevice(device)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedDevice?.deviceId === device.deviceId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DeviceStatusIndicator device={device} size="medium" />
                  <div>
                    <div className="font-medium text-gray-900">{device.name}</div>
                    <div className="text-xs text-gray-500">
                      {device.deviceId} • FW v{device.firmwareVersion}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {device.portId && <div>Port: {device.portId}</div>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected Device Details */}
      {selectedDevice && latestTelemetry && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Latest Readings</h4>
          <div className="grid grid-cols-2 gap-4">
            {latestTelemetry.voltage !== undefined && (
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Voltage</div>
                <div className="text-lg font-semibold text-gray-900">
                  {latestTelemetry.voltage.toFixed(1)} V
                </div>
              </div>
            )}
            {latestTelemetry.current !== undefined && (
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Current</div>
                <div className="text-lg font-semibold text-gray-900">
                  {latestTelemetry.current.toFixed(2)} A
                </div>
              </div>
            )}
            {latestTelemetry.power !== undefined && (
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Power</div>
                <div className="text-lg font-semibold text-gray-900">
                  {(latestTelemetry.power / 1000).toFixed(2)} kW
                </div>
              </div>
            )}
            {latestTelemetry.temperature !== undefined && (
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Temperature</div>
                <div className="text-lg font-semibold text-gray-900">
                  {latestTelemetry.temperature.toFixed(1)} °C
                </div>
              </div>
            )}
            {latestTelemetry.energyWh !== undefined && (
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Energy Delivered</div>
                <div className="text-lg font-semibold text-gray-900">
                  {(latestTelemetry.energyWh / 1000).toFixed(2)} kWh
                </div>
              </div>
            )}
            {latestTelemetry.connectorStatus && (
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Connector Status</div>
                <div className="text-lg font-semibold text-gray-900 capitalize">
                  {latestTelemetry.connectorStatus}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
