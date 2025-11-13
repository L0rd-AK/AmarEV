import { Schema, model, Document, Types } from 'mongoose';
import { Payment as IPayment, PaymentProvider, PaymentStatus } from '@chargebd/shared';

/**
 * Payment Model - Transaction History Collection
 * 
 * This collection serves as the complete transaction history for all payments
 * in the system. Each payment record includes:
 * - Payment gateway details (SSLCommerz, bKash)
 * - Transaction IDs and status
 * - Associated reservation or session
 * - Timeline of payment status changes
 * - Refund information if applicable
 * 
 * All completed payments are permanently stored here for:
 * - User transaction history
 * - Financial reporting and analytics
 * - Audit trail and compliance
 * - Dispute resolution
 */
export interface PaymentDocument extends Omit<IPayment, '_id' | 'userId' | 'reservationId' | 'sessionId'>, Document {
  userId: Types.ObjectId;
  reservationId?: Types.ObjectId;
  sessionId?: Types.ObjectId;
  refundedAmount?: number;
  refundId?: string;
  refundReason?: string;
  refundedAt?: Date;
  paidAt?: Date;
  failureReason?: string;
  cardDetails?: {
    cardType?: string;
    cardBrand?: string;
    cardIssuer?: string;
    lastFourDigits?: string;
  };
  gatewayResponse?: any;
  verificationResponse?: any;
  refundResponse?: any;
  webhookPayload?: any;
  timeline?: Array<{
    status: PaymentStatus;
    timestamp: Date;
    note?: string;
  }>;
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
    refundedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    refundId: {
      type: String,
    },
    refundReason: {
      type: String,
    },
    refundedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    cardDetails: {
      cardType: String,
      cardBrand: String,
      cardIssuer: String,
      lastFourDigits: String,
    },
    gatewayResponse: {
      type: Schema.Types.Mixed,
    },
    verificationResponse: {
      type: Schema.Types.Mixed,
    },
    refundResponse: {
      type: Schema.Types.Mixed,
    },
    webhookPayload: {
      type: Schema.Types.Mixed,
    },
    timeline: [{
      status: {
        type: String,
        enum: Object.values(PaymentStatus),
        required: true,
      },
      timestamp: {
        type: Date,
        required: true,
        default: Date.now,
      },
      note: String,
    }],
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

// Methods
paymentSchema.methods.addTimelineEvent = function(status: PaymentStatus, note?: string) {
  if (!this.timeline) {
    this.timeline = [];
  }
  this.timeline.push({
    status,
    timestamp: new Date(),
    note,
  });
  return this;
};

// Pre-save hook to update timeline when status changes
paymentSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (!this.timeline) {
      this.timeline = [];
    }
    // Only add to timeline if this status isn't already the last one
    const lastStatus = this.timeline[this.timeline.length - 1]?.status;
    if (lastStatus !== this.status) {
      this.timeline.push({
        status: this.status,
        timestamp: new Date(),
        note: this.status === PaymentStatus.FAILED ? this.failureReason : undefined,
      });
    }
  }
  next();
});

export const Payment = model<PaymentDocument>('Payment', paymentSchema);