import { Schema, model, Document, Types } from 'mongoose';

/**
 * THEORETICAL ESP32 DEVICE MODEL
 * Represents a physical ESP32 microcontroller deployed at a charging station
 * This is for academic demonstration of IoT integration principles
 */

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  FAULT = 'fault',
  MAINTENANCE = 'maintenance'
}

export enum DeviceType {
  ESP32 = 'esp32',
  ESP32_S3 = 'esp32-s3',
  ESP8266 = 'esp8266'
}

export interface IDevice {
  _id: string;
  deviceId: string;
  stationId: string;
  portId?: string;
  name: string;
  type: DeviceType;
  firmwareVersion: string;
  status: DeviceStatus;
  lastSeen: Date;
  ipAddress?: string;
  macAddress?: string;
  rssi?: number; // WiFi signal strength
  apiKey: string; // For device authentication
  isActive: boolean;
  metadata?: {
    installDate?: Date;
    lastMaintenanceDate?: Date;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceDocument extends Omit<IDevice, '_id' | 'stationId'>, Document {
  stationId: Types.ObjectId;
}

const deviceSchema = new Schema<DeviceDocument>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      validate: {
        validator: function(v: string) {
          // Format: DEV-{STATION_ID}-{PORT_ID} or custom format
          return /^[A-Z0-9_-]+$/i.test(v);
        },
        message: 'Device ID must be alphanumeric with hyphens/underscores'
      }
    },
    stationId: {
      type: Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
      index: true,
    },
    portId: {
      type: String,
      trim: true,
      index: true,
      // Optional: references Connector._id or port number
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(DeviceType),
      default: DeviceType.ESP32,
    },
    firmwareVersion: {
      type: String,
      required: true,
      trim: true,
      default: '1.0.0',
    },
    status: {
      type: String,
      enum: Object.values(DeviceStatus),
      default: DeviceStatus.OFFLINE,
      index: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          return /^(\d{1,3}\.){3}\d{1,3}$/.test(v);
        },
        message: 'Invalid IP address format'
      }
    },
    macAddress: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(v);
        },
        message: 'Invalid MAC address format'
      }
    },
    rssi: {
      type: Number,
      min: -100,
      max: 0,
      // WiFi signal strength in dBm (typically -30 to -90)
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      select: false, // Don't return in queries by default
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    metadata: {
      installDate: Date,
      lastMaintenanceDate: Date,
      notes: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc: any, ret: any) => {
        delete ret.__v;
        delete ret.apiKey; // Never expose API key
        return ret;
      },
    },
  }
);

// Indexes for efficient querying
deviceSchema.index({ stationId: 1, status: 1 });
deviceSchema.index({ lastSeen: 1 }); // For offline detection
deviceSchema.index({ isActive: 1, status: 1 });

// Virtual for checking if device is recently active (within 2 minutes)
deviceSchema.virtual('isRecentlyActive').get(function() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  return this.lastSeen && this.lastSeen >= twoMinutesAgo;
});

// Pre-save hook to update status based on lastSeen
deviceSchema.pre('save', function(next) {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  
  // Auto-set to offline if lastSeen is old and status is online
  if (this.status === DeviceStatus.ONLINE && this.lastSeen < twoMinutesAgo) {
    this.status = DeviceStatus.OFFLINE;
  }
  
  next();
});

export const Device = model<DeviceDocument>('Device', deviceSchema);
