import { Schema, model, Document, Types } from 'mongoose';
import { Vehicle as IVehicle, ConnectorStandard } from '@chargebd/shared';

export interface VehicleDocument extends Omit<IVehicle, '_id' | 'userId'>, Document {
  userId: Types.ObjectId;
}

const vehicleSchema = new Schema<VehicleDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    make: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      min: 2010,
      max: new Date().getFullYear() + 2,
    },
    connectorType: [{
      type: String,
      enum: Object.values(ConnectorStandard),
      required: true,
    }],
    usableKWh: {
      type: Number,
      required: true,
      min: 10,
      max: 200,
    },
    maxACkW: {
      type: Number,
      required: true,
      min: 3,
      max: 50,
    },
    maxDCkW: {
      type: Number,
      required: true,
      min: 10,
      max: 350,
    },
    isDefault: {
      type: Boolean,
      default: false,
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
vehicleSchema.index({ userId: 1 });
vehicleSchema.index({ userId: 1, isDefault: 1 });
vehicleSchema.index({ connectorType: 1 });

// Ensure only one default vehicle per user
vehicleSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

export const Vehicle = model<VehicleDocument>('Vehicle', vehicleSchema);