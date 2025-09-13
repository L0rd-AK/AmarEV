import { PaymentProvider, PaymentStatus, Payment } from '@chargebd/shared';
import { SSLCommerzPaymentService } from './SSLCommerzService';
import { bKashService, getbKashService } from './bKashService';
import { Payment as PaymentModel } from '../models/Payment';
import { logger } from '../utils/logger';

export interface PaymentProvider {
  initiatePayment(paymentData: PaymentInitiationData): Promise<PaymentInitiationResponse>;
  verifyPayment(transactionId: string): Promise<PaymentVerificationResponse>;
  refundPayment(transactionId: string, amount: number, reason?: string): Promise<PaymentRefundResponse>;
  handleWebhook(payload: any, signature?: string): Promise<WebhookResponse>;
}

export interface PaymentInitiationData {
  amount: number;
  currency: string;
  orderId: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  description: string;
  successUrl?: string;
  failUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentInitiationResponse {
  success: boolean;
  sessionKey?: string;
  gatewayPageURL?: string;
  paymentUrl?: string;
  transactionId?: string;
  error?: string;
  errorCode?: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  status: PaymentStatus;
  transactionId: string;
  amount: number;
  currency: string;
  paidAt?: Date;
  gatewayTransactionId?: string;
  error?: string;
}

export interface PaymentRefundResponse {
  success: boolean;
  refundId?: string;
  refundedAmount?: number;
  error?: string;
}

export interface WebhookResponse {
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  amount?: number;
  metadata?: Record<string, any>;
}

class PaymentService {
  private providers: Map<PaymentProvider, PaymentProvider> = new Map();

  constructor() {
    this.providers.set(PaymentProvider.SSLCOMMERZ, new SSLCommerzPaymentService());
    
    // Only add bKash service if it's available
    if (bKashService) {
      this.providers.set(PaymentProvider.BKASH, bKashService);
    } else {
      logger.warn('bKash service not available - running in development mode without bKash support');
    }
  }

  /**
   * Initiate a payment with the specified provider
   */
  async initiatePayment(
    paymentMethod: PaymentProvider,
    paymentData: PaymentInitiationData
  ): Promise<PaymentInitiationResponse> {
    try {
      const provider = this.providers.get(paymentMethod);
      if (!provider) {
        throw new Error(`Payment provider not found for method: ${paymentMethod}`);
      }

      // Create payment record in database
      const payment = new PaymentModel({
        userId: paymentData.metadata?.userId,
        reservationId: paymentData.metadata?.reservationId,
        sessionId: paymentData.metadata?.sessionId,
        amountBDT: paymentData.amount,
        currency: paymentData.currency,
        provider: paymentMethod,
        status: PaymentStatus.PENDING,
        transactionId: paymentData.orderId,
        idempotencyKey: paymentData.metadata?.idempotencyKey,
        metadata: paymentData.metadata,
      });

      await payment.save();

      const response = await provider.initiatePayment(paymentData);

      if (response.success) {
        // Update payment with gateway response
        payment.gatewayResponse = response;
        payment.gatewayTransactionId = response.transactionId;
        await payment.save();

        logger.info(`Payment initiated successfully`, {
          paymentId: payment._id,
          transactionId: paymentData.orderId,
          method: paymentMethod,
          amount: paymentData.amount,
        });
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = response.error || 'Payment initiation failed';
        await payment.save();

        logger.error(`Payment initiation failed`, {
          paymentId: payment._id,
          transactionId: paymentData.orderId,
          method: paymentMethod,
          error: response.error,
        });
      }

      return response;
    } catch (error) {
      logger.error(`Payment initiation error`, {
        method: paymentMethod,
        orderId: paymentData.orderId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(
    paymentMethod: PaymentMethod,
    transactionId: string
  ): Promise<PaymentVerificationResponse> {
    try {
      const provider = this.providers.get(paymentMethod);
      if (!provider) {
        throw new Error(`Payment provider not found for method: ${paymentMethod}`);
      }

      const response = await provider.verifyPayment(transactionId);

      // Update payment record
      const payment = await PaymentModel.findOne({ transactionId });
      if (payment) {
        payment.status = response.status;
        if (response.success && response.status === PaymentStatus.COMPLETED) {
          payment.paidAt = response.paidAt || new Date();
          payment.gatewayTransactionId = response.gatewayTransactionId;
        }
        payment.verificationResponse = response;
        await payment.save();

        logger.info(`Payment verification completed`, {
          paymentId: payment._id,
          transactionId,
          status: response.status,
          success: response.success,
        });
      }

      return response;
    } catch (error) {
      logger.error(`Payment verification error`, {
        method: paymentMethod,
        transactionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process refund
   */
  async refundPayment(
    paymentMethod: PaymentMethod,
    transactionId: string,
    amount: number,
    reason?: string
  ): Promise<PaymentRefundResponse> {
    try {
      const provider = this.providers.get(paymentMethod);
      if (!provider) {
        throw new Error(`Payment provider not found for method: ${paymentMethod}`);
      }

      const payment = await PaymentModel.findOne({ transactionId });
      if (!payment) {
        throw new Error(`Payment not found for transaction: ${transactionId}`);
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new Error(`Cannot refund payment with status: ${payment.status}`);
      }

      if (amount > payment.amount) {
        throw new Error(`Refund amount cannot exceed original payment amount`);
      }

      const response = await provider.refundPayment(transactionId, amount, reason);

      if (response.success) {
        payment.status = PaymentStatus.REFUNDED;
        payment.refundedAt = new Date();
        payment.refundAmount = response.refundedAmount || amount;
        payment.refundReason = reason;
        payment.refundResponse = response;
        await payment.save();

        logger.info(`Payment refund completed`, {
          paymentId: payment._id,
          transactionId,
          refundAmount: amount,
          reason,
        });
      }

      return response;
    } catch (error) {
      logger.error(`Payment refund error`, {
        method: paymentMethod,
        transactionId,
        amount,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle webhook from payment provider
   */
  async handleWebhook(
    paymentMethod: PaymentMethod,
    payload: any,
    signature?: string
  ): Promise<WebhookResponse> {
    try {
      const provider = this.providers.get(paymentMethod);
      if (!provider) {
        throw new Error(`Payment provider not found for method: ${paymentMethod}`);
      }

      const response = await provider.handleWebhook(payload, signature);

      if (response.success && response.transactionId) {
        const payment = await PaymentModel.findOne({ transactionId: response.transactionId });
        if (payment) {
          payment.status = response.status;
          if (response.status === PaymentStatus.COMPLETED) {
            payment.paidAt = new Date();
          }
          payment.webhookPayload = payload;
          await payment.save();

          logger.info(`Webhook processed successfully`, {
            paymentId: payment._id,
            transactionId: response.transactionId,
            status: response.status,
            method: paymentMethod,
          });
        }
      }

      return response;
    } catch (error) {
      logger.error(`Webhook processing error`, {
        method: paymentMethod,
        error: error.message,
        payload,
      });
      throw error;
    }
  }

  /**
   * Get payment by transaction ID
   */
  async getPayment(transactionId: string): Promise<Payment | null> {
    try {
      const payment = await PaymentModel.findOne({ transactionId }).populate([
        'userId',
        'reservationId',
        'sessionId',
      ]);
      return payment;
    } catch (error) {
      logger.error(`Get payment error`, {
        transactionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get payments for a user
   */
  async getUserPayments(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    payments: Payment[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      const [payments, total] = await Promise.all([
        PaymentModel.find({ userId })
          .populate(['reservationId', 'sessionId'])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        PaymentModel.countDocuments({ userId }),
      ]);

      return {
        payments,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error(`Get user payments error`, {
        userId,
        error: error.message,
      });
      throw error;
    }
  }
}

export const paymentService = new PaymentService();