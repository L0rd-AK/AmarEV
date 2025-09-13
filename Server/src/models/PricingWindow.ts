import { Schema, model, Document, Types } from 'mongoose';
import { PricingWindow as IPricingWindow, ConnectorType, PricingRateType } from '@chargebd/shared';

export interface PricingWindowDocument extends Omit<IPricingWindow, '_id' | 'stationId'>, Document {
  stationId: Types.ObjectId;
}

const pricingWindowSchema = new Schema<PricingWindowDocument>(
  {
    stationId: {
      type: Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
      index: true,
    },
    connectorType: {
      type: String,
      enum: Object.values(ConnectorType),
    },
    fromTime: {
      type: String,
      required: true,
      validate: {
        validator: function(time: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
        },
        message: 'Invalid time format (HH:mm)',
      },
    },
    toTime: {
      type: String,
      required: true,
      validate: {
        validator: function(time: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
        },
        message: 'Invalid time format (HH:mm)',
      },
    },
    dayOfWeek: [{
      type: Number,
      min: 0,
      max: 6,
    }],
    rateType: {
      type: String,
      enum: Object.values(PricingRateType),
      required: true,
    },
    rateBDT: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validTo: {
      type: Date,
      validate: {
        validator: function(this: PricingWindowDocument, validTo: Date) {
          return !validTo || validTo > this.validFrom;
        },
        message: 'Valid to date must be after valid from date',
      },
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
pricingWindowSchema.index({ stationId: 1, isActive: 1 });
pricingWindowSchema.index({ stationId: 1, connectorType: 1, isActive: 1 });
pricingWindowSchema.index({ validFrom: 1, validTo: 1 });

export const PricingWindow = model<PricingWindowDocument>('PricingWindow', pricingWindowSchema);