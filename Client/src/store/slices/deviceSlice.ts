import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Device, DeviceTelemetry, DeviceStatus } from '@chargebd/shared';

/**
 * THEORETICAL DEVICE STATE MANAGEMENT
 * Redux slice for managing ESP32 device state in the frontend
 */

interface DeviceState {
  devices: Record<string, Device>; // Keyed by deviceId
  telemetry: Record<string, DeviceTelemetry[]>; // Keyed by deviceId
  stationDevices: Record<string, string[]>; // stationId -> deviceIds[]
  loading: boolean;
  error: string | null;
}

const initialState: DeviceState = {
  devices: {},
  telemetry: {},
  stationDevices: {},
  loading: false,
  error: null,
};

const deviceSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Add or update a device
    setDevice: (state, action: PayloadAction<Device>) => {
      const device = action.payload;
      state.devices[device.deviceId] = device;
    },

    // Set multiple devices
    setDevices: (state, action: PayloadAction<Device[]>) => {
      action.payload.forEach(device => {
        state.devices[device.deviceId] = device;
      });
    },

    // Update device status (from real-time updates)
    updateDeviceStatus: (state, action: PayloadAction<{
      deviceId: string;
      status: DeviceStatus;
      lastSeen: Date;
    }>) => {
      const { deviceId, status, lastSeen } = action.payload;
      if (state.devices[deviceId]) {
        state.devices[deviceId].status = status;
        state.devices[deviceId].lastSeen = lastSeen;
      }
    },

    // Add telemetry data
    addTelemetry: (state, action: PayloadAction<{
      deviceId: string;
      telemetry: DeviceTelemetry;
    }>) => {
      const { deviceId, telemetry } = action.payload;
      if (!state.telemetry[deviceId]) {
        state.telemetry[deviceId] = [];
      }
      // Add to beginning and limit to last 100 entries
      state.telemetry[deviceId].unshift(telemetry);
      if (state.telemetry[deviceId].length > 100) {
        state.telemetry[deviceId] = state.telemetry[deviceId].slice(0, 100);
      }
    },

    // Set telemetry history
    setTelemetryHistory: (state, action: PayloadAction<{
      deviceId: string;
      history: DeviceTelemetry[];
    }>) => {
      const { deviceId, history } = action.payload;
      state.telemetry[deviceId] = history;
    },

    // Map devices to station
    setStationDevices: (state, action: PayloadAction<{
      stationId: string;
      deviceIds: string[];
    }>) => {
      const { stationId, deviceIds } = action.payload;
      state.stationDevices[stationId] = deviceIds;
    },

    // Clear devices
    clearDevices: (state) => {
      state.devices = {};
      state.telemetry = {};
      state.stationDevices = {};
    },
  },
});

export const {
  setLoading,
  setError,
  setDevice,
  setDevices,
  updateDeviceStatus,
  addTelemetry,
  setTelemetryHistory,
  setStationDevices,
  clearDevices,
} = deviceSlice.actions;

// Selectors
export const selectAllDevices = (state: { devices: DeviceState }) => 
  Object.values(state.devices.devices);

export const selectDeviceById = (deviceId: string) => 
  (state: { devices: DeviceState }) => state.devices.devices[deviceId];

export const selectStationDevices = (stationId: string) => 
  (state: { devices: DeviceState }) => {
    const deviceIds = state.devices.stationDevices[stationId] || [];
    return deviceIds.map(id => state.devices.devices[id]).filter(Boolean);
  };

export const selectDeviceTelemetry = (deviceId: string) => 
  (state: { devices: DeviceState }) => state.devices.telemetry[deviceId] || [];

export const selectOnlineDevices = (state: { devices: DeviceState }) => 
  Object.values(state.devices.devices).filter(d => d.status === 'online');

export const selectOfflineDevices = (state: { devices: DeviceState }) => 
  Object.values(state.devices.devices).filter(d => d.status === 'offline');

export default deviceSlice.reducer;
