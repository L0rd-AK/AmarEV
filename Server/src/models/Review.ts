import { Schema, model, Document, Types } from 'mongoose';
import { Review as IReview } from '@chargebd/shared';

export interface ReviewDocument extends Omit<IReview, '_id' | 'userId' | 'stationId'>, Document {
  userId: Types.ObjectId;
  stationId: Types.ObjectId;
}

const reviewSchema = new Schema<ReviewDocument>(
  {
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    photos: [{
      type: String,
      validate: {
        validator: function(url: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(url);
        },
        message: 'Invalid photo URL format',
      },
    }],
    flagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    flaggedReason: {
      type: String,
      trim: true,
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
reviewSchema.index({ stationId: 1, rating: -1 });
reviewSchema.index({ userId: 1, stationId: 1 }, { unique: true }); // One review per user per station
reviewSchema.index({ flagged: 1 });
reviewSchema.index({ createdAt: -1 });

export const Review = model<ReviewDocument>('Review', reviewSchema);