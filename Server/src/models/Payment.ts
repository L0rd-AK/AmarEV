import { Schema, model, Document, Types } from 'mongoose';
import { Payment as IPayment, PaymentProvider, PaymentStatus } from '@chargebd/shared';

export interface PaymentDocument extends Omit<IPayment, '_id' | 'userId' | 'reservationId' | 'sessionId'>, Document {
  userId: Types.ObjectId;
  reservationId?: Types.ObjectId;
  sessionId?: Types.ObjectId;
}

const paymentSchema = new Schema<PaymentDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: Object.values(PaymentProvider),
      required: true,
    },
    amountBDT: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'BDT',
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    gatewayTransactionId: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
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
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ provider: 1, status: 1 });
// Note: transactionId already has unique: true, so no separate index needed
paymentSchema.index({ gatewayTransactionId: 1 }, { sparse: true });
// Note: idempotencyKey already has unique: true, so no separate index needed
paymentSchema.index({ createdAt: -1 });

export const Payment = model<PaymentDocument>('Payment', paymentSchema);