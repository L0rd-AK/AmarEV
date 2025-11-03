import { Schema, model, Document, Types } from 'mongoose';
import { Station as IStation, Location } from '@chargebd/shared';

export interface StationDocument extends Omit<IStation, '_id' | 'operatorId'>, Document {
  operatorId: Types.ObjectId;
}

const locationSchema = new Schema<Location>({
  type: {
    type: String,
    enum: ['Point'],
    required: true,
    default: 'Point',
  },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function(coords: number[]) {
        return coords.length === 2 && 
               coords[0] >= -180 && coords[0] <= 180 && // longitude
               coords[1] >= -90 && coords[1] <= 90;     // latitude
      },
      message: 'Invalid coordinates format [longitude, latitude]',
    },
  },
}, { _id: false });

const addressSchema = new Schema({
  street: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  division: { type: String, required: true, trim: true },
  postalCode: { type: String, trim: true },
}, { _id: false });

const openingHoursSchema = new Schema({
  monday: { open: String, close: String },
  tuesday: { open: String, close: String },
  wednesday: { open: String, close: String },
  thursday: { open: String, close: String },
  friday: { open: String, close: String },
  saturday: { open: String, close: String },
  sunday: { open: String, close: String },
}, { _id: false });

const stationSchema = new Schema<StationDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: 'text',
    },
    operatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      type: locationSchema,
      required: true,
    },
    address: {
      type: addressSchema,
      required: true,
    },
    amenities: [{
      type: String,
      trim: true,
    }],
    photos: [{
      type: String,
      validate: {
        validator: function(url: string) {
          return /^https?:\/\/.+/i.test(url);
        },
        message: 'Invalid photo URL format',
      },
    }],
    timezone: {
      type: String,
      default: 'Asia/Dhaka',
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    openingHours: openingHoursSchema,
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
stationSchema.index({ location: '2dsphere' });
stationSchema.index({ operatorId: 1 });
stationSchema.index({ isActive: 1, isPublic: 1 });
stationSchema.index({ 'address.city': 1 });
stationSchema.index({ 'address.area': 1 });
stationSchema.index({ amenities: 1 });
stationSchema.index({ name: 'text', 'address.area': 'text', 'address.city': 'text' });

export const Station = model<StationDocument>('Station', stationSchema);