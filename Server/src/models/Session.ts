import { Schema, model, Document, Types } from 'mongoose';
import { Session as ISession, SessionEvent, SessionStatus } from '@chargebd/shared';

export interface SessionDocument extends Omit<ISession, '_id' | 'reservationId' | 'userId' | 'stationId' | 'connectorId' | 'vehicleId' | 'paymentId'>, Document {
  reservationId?: Types.ObjectId;
  userId: Types.ObjectId;
  stationId: Types.ObjectId;
  connectorId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  paymentId?: Types.ObjectId;
}

const sessionEventSchema = new Schema<SessionEvent>({
  timestamp: { type: Date, required: true },
  powerKw: { type: Number, required: true, min: 0 },
  voltage: { type: Number, required: true, min: 0 },
  current: { type: Number, required: true, min: 0 },
  energyKWh: { type: Number, required: true, min: 0 },
}, { _id: false });

const sessionSchema = new Schema<SessionDocument>(
  {
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stationId: {
      type: Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
      index: true,
    },
    connectorId: {
      type: Schema.Types.ObjectId,
      ref: 'Connector',
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      validate: {
        validator: function(this: SessionDocument, endTime: Date) {
          return !endTime || endTime > this.startTime;
        },
        message: 'End time must be after start time',
      },
    },
    totalEnergyKWh: {
      type: Number,
      default: 0,
      min: 0,
    },
    averagePowerKw: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCostBDT: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.ACTIVE,
      index: true,
    },
    events: [sessionEventSchema],
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
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
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ stationId: 1, startTime: -1 });
sessionSchema.index({ connectorId: 1, startTime: -1 });
sessionSchema.index({ status: 1, startTime: 1 });
sessionSchema.index({ reservationId: 1 }, { sparse: true });

export const Session = model<SessionDocument>('Session', sessionSchema);