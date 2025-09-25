import { Schema, model, Document } from 'mongoose';

// RefreshToken interface defined inline since it's simple
interface IRefreshToken {
  _id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RefreshTokenDocument extends Omit<IRefreshToken, '_id'>, Document {}

const refreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index for automatic cleanup
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ token: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

export const RefreshToken = model<RefreshTokenDocument>('RefreshToken', refreshTokenSchema);