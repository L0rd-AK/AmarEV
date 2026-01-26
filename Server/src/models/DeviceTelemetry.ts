import { Schema, model, Document, Types } from 'mongoose';

/**
 * THEORETICAL DEVICE TELEMETRY MODEL
 * Stores historical sensor data from ESP32 devices
 * Used for analytics, monitoring, and fault detection
 */

export enum TelemetryType {
  HEARTBEAT = 'heartbeat',
  STATUS_UPDATE = 'status_update',
  SENSOR_DATA = 'sensor_data',
  ERROR = 'error',
  CHARGING_METRICS = 'charging_metrics'
}

export interface ITelemetry {
  _id: string;
  deviceId: string;
  stationId: string;
  portId?: string;
  type: TelemetryType;
  timestamp: Date;
  
  // Connection status
  status?: string;
  
  // Sensor readings
  voltage?: number; // in Volts
  current?: number; // in Amperes
  power?: number;   // in Watts
  energyWh?: number; // Total energy delivered in Wh
  temperature?: number; // in Celsius
  humidity?: number; // in percentage
  
  // Connector status
  connectorStatus?: 'connected' | 'disconnected' | 'charging' | 'idle';
  
  // Network metrics
  rssi?: number; // WiFi signal strength
  uptime?: number; // Device uptime in seconds
  
  // Error information
  errorCode?: string;
  errorMessage?: string;
  
  // Raw data (for flexibility)
  rawData?: Record<string, any>;
  
  createdAt: Date;
}

export interface TelemetryDocument extends Omit<ITelemetry, '_id' | 'deviceId' | 'stationId'>, Document {
  deviceId: Types.ObjectId;
  stationId: Types.ObjectId;
}

const telemetrySchema = new Schema<TelemetryDocument>(
  {
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
      index: true,
    },
    stationId: {
      type: Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
      index: true,
    },
    portId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TelemetryType),
      required: true,
      default: TelemetryType.SENSOR_DATA,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      trim: true,
    },
    voltage: {
      type: Number,
      min: 0,
      max: 1000, // Max expected voltage
    },
    current: {
      type: Number,
      min: 0,
      max: 500, // Max expected current in Amperes
    },
    power: {
      type: Number,
      min: 0,
    },
    energyWh: {
      type: Number,
      min: 0,
    },
    temperature: {
      type: Number,
      min: -40,
      max: 125, // Typical sensor range
    },
    humidity: {
      type: Number,
      min: 0,
      max: 100,
    },
    connectorStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'charging', 'idle'],
    },
    rssi: {
      type: Number,
      min: -100,
      max: 0,
    },
    uptime: {
      type: Number,
      min: 0,
    },
    errorCode: {
      type: String,
      trim: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    rawData: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (doc: any, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for efficient querying
telemetrySchema.index({ deviceId: 1, timestamp: -1 });
telemetrySchema.index({ stationId: 1, timestamp: -1 });
telemetrySchema.index({ type: 1, timestamp: -1 });
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // Auto-delete after 90 days

// Index for analytics queries
telemetrySchema.index({ stationId: 1, type: 1, timestamp: -1 });

export const DeviceTelemetry = model<TelemetryDocument>('DeviceTelemetry', telemetrySchema);
