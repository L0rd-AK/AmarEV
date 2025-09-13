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
      index: true,
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
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gatewayTransactionId: {
      type: String,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      index: true,
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
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ gatewayTransactionId: 1 }, { sparse: true });
paymentSchema.index({ idempotencyKey: 1 });
paymentSchema.index({ createdAt: -1 });

export const Payment = model<PaymentDocument>('Payment', paymentSchema);