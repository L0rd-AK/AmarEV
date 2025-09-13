import { Schema, model, Document, Types } from 'mongoose';
import { Connector as IConnector, ConnectorType, ConnectorStandard, ConnectorStatus } from '@chargebd/shared';

export interface ConnectorDocument extends Omit<IConnector, '_id' | 'stationId'>, Document {
  stationId: Types.ObjectId;
}

const connectorSchema = new Schema<ConnectorDocument>(
  {
    stationId: {
      type: Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ConnectorType),
      required: true,
    },
    standard: {
      type: String,
      enum: Object.values(ConnectorStandard),
      required: true,
    },
    maxKw: {
      type: Number,
      required: true,
      min: 3,
      max: 350,
    },
    pricePerKWhBDT: {
      type: Number,
      required: true,
      min: 0,
    },
    pricePerMinuteBDT: {
      type: Number,
      required: true,
      min: 0,
    },
    sessionFeeBDT: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(ConnectorStatus),
      default: ConnectorStatus.AVAILABLE,
      index: true,
    },
    lastMaintenanceDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc: any, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
connectorSchema.index({ stationId: 1 });
connectorSchema.index({ stationId: 1, status: 1 });
connectorSchema.index({ type: 1, standard: 1 });
connectorSchema.index({ status: 1 });

export const Connector = model<ConnectorDocument>('Connector', connectorSchema);