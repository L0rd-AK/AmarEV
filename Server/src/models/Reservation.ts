import { Schema, model, Document, Types } from 'mongoose';
import { Reservation as IReservation, ReservationStatus } from '@chargebd/shared';

export interface ReservationDocument extends Omit<IReservation, '_id' | 'userId' | 'vehicleId' | 'stationId' | 'connectorId'>, Document {
  userId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  stationId: Types.ObjectId;
  connectorId: Types.ObjectId;
}

const reservationSchema = new Schema<ReservationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    stationId: {
      type: Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    connectorId: {
      type: Schema.Types.ObjectId,
      ref: 'Connector',
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator: function(this: ReservationDocument, endTime: Date) {
          return endTime > this.startTime;
        },
        message: 'End time must be after start time',
      },
    },
    status: {
      type: String,
      enum: Object.values(ReservationStatus),
      default: ReservationStatus.PENDING,
    },
    qrCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    otp: {
      type: String,
      select: false, // Don't include in queries by default
    },
    totalCostBDT: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc: any, ret: any) => {
        delete ret.__v;
        delete ret.otp; // Never expose OTP in JSON
        return ret;
      },
    },
  }
);

// Indexes
reservationSchema.index({ userId: 1, status: 1 });
reservationSchema.index({ stationId: 1, connectorId: 1, startTime: 1 });
reservationSchema.index({ startTime: 1, endTime: 1 });
reservationSchema.index({ status: 1, startTime: 1 });
// Note: qrCode already has unique: true and sparse: true, so no separate index needed

// Compound index for conflict detection
reservationSchema.index({
  connectorId: 1,
  startTime: 1,
  endTime: 1,
  status: 1
});

export const Reservation = model<ReservationDocument>('Reservation', reservationSchema);