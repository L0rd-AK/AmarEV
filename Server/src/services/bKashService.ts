import crypto from 'crypto';
import axios from 'axios';
import { PaymentStatus } from '@chargebd/shared';
import {
  PaymentProvider,
  PaymentInitiationData,
  PaymentInitiationResponse,
  PaymentVerificationResponse,
  PaymentRefundResponse,
  WebhookResponse,
} from './PaymentService';
import { logger } from '../utils/logger';

interface bKashConfig {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  sandboxMode: boolean;
  baseUrl: string;
}

interface bKashTokenResponse {
  status_code: string;
  status_message: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

interface bKashCreatePaymentRequest {
  mode: string;
  payerReference: string;
  callbackURL: string;
  amount: string;
  currency: string;
  intent: string;
  merchantInvoiceNumber: string;
  merchantAssociationInfo?: string;
}

interface bKashCreatePaymentResponse {
  status_code: string;
  status_message: string;
  paymentID: string;
  bkashURL: string;
  callbackURL: string;
  successCallbackURL: string;
  failureCallbackURL: string;
  cancelledCallbackURL: string;
  amount: string;
  intent: string;
  currency: string;
  paymentCreateTime: string;
  transactionStatus: string;
  merchantInvoiceNumber: string;
  orgLogo: string;
  orgName: string;
  errorCode?: string;
  errorMessage?: string;
}

interface bKashExecutePaymentResponse {
  status_code: string;
  status_message: string;
  paymentID: string;
  createTime: string;
  updateTime: string;
  trxID: string;
  transactionStatus: string;
  amount: string;
  currency: string;
  intent: string;
  merchantInvoiceNumber: string;
  errorCode?: string;
  errorMessage?: string;
}

interface bKashQueryPaymentResponse {
  status_code: string;
  status_message: string;
  paymentID: string;
  mode: string;
  payerType: string;
  payerReference: string;
  customerMsisdn: string;
  trxID: string;
  amount: string;
  currency: string;
  intent: string;
  merchantInvoiceNumber: string;
  transactionStatus: string;
  createTime: string;
  updateTime: string;
  completedTime?: string;
  errorCode?: string;
  errorMessage?: string;
}

class bKashPaymentService implements PaymentProvider {
  private config: bKashConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor() {
    this.config = {
      appKey: process.env.BKASH_APP_KEY || '',
      appSecret: process.env.BKASH_APP_SECRET || '',
      username: process.env.BKASH_USERNAME || '',
      password: process.env.BKASH_PASSWORD || '',
      sandboxMode: process.env.NODE_ENV !== 'production',
      baseUrl: process.env.NODE_ENV === 'production' 
        ? 'https://tokenized.pay.bka.sh/v1.2.0-beta'
        : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
    };

    // Only require credentials in production or when explicitly testing bKash
    if (process.env.NODE_ENV === 'production' && (!this.config.appKey || !this.config.appSecret || !this.config.username || !this.config.password)) {
      throw new Error('bKash credentials not configured for production');
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.warn('bKash service running in development mode with placeholder credentials');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Check if credentials are properly configured
    if (!this.config.appKey || !this.config.appSecret || !this.config.username || !this.config.password ||
        this.config.appKey === 'dev-app-key-placeholder' || 
        this.config.appSecret === 'dev-app-secret-placeholder') {
      throw new Error('bKash credentials not properly configured for API calls');
    }

    try {
      logger.info('Fetching bKash access token');

      const response = await axios.post<bKashTokenResponse>(
        `${this.config.baseUrl}/tokenized/checkout/token/grant`,
        {
          app_key: this.config.appKey,
          app_secret: this.config.appSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'username': this.config.username,
            'password': this.config.password,
          },
          timeout: 30000,
        }
      );

      if (response.data.status_code === '0000') {
        this.accessToken = response.data.id_token;
        this.tokenExpiresAt = new Date(Date.now() + (response.data.expires_in - 60) * 1000); // 1 minute buffer
        return this.accessToken;
      } else {
        throw new Error(`bKash token error: ${response.data.status_message}`);
      }
    } catch (error) {
      logger.error('bKash token fetch error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async initiatePayment(paymentData: PaymentInitiationData): Promise<PaymentInitiationResponse> {
    try {
      const token = await this.getAccessToken();

      const requestData: bKashCreatePaymentRequest = {
        mode: '0011',
        payerReference: paymentData.customerInfo.phone,
        callbackURL: paymentData.successUrl || `${process.env.FRONTEND_URL}/payment/callback`,
        amount: paymentData.amount.toString(),
        currency: paymentData.currency,
        intent: 'sale',
        merchantInvoiceNumber: paymentData.orderId,
        merchantAssociationInfo: JSON.stringify(paymentData.metadata || {}),
      };

      logger.info('Initiating bKash payment', {
        transactionId: paymentData.orderId,
        amount: paymentData.amount,
        currency: paymentData.currency,
      });

      const response = await axios.post<bKashCreatePaymentResponse>(
        `${this.config.baseUrl}/tokenized/checkout/create`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'authorization': token,
            'x-app-key': this.config.appKey,
          },
          timeout: 30000,
        }
      );

      if (response.data.status_code === '0000') {
        return {
          success: true,
          paymentUrl: response.data.bkashURL,
          transactionId: response.data.paymentID,
        };
      } else {
        return {
          success: false,
          error: response.data.errorMessage || response.data.status_message || 'Payment initiation failed',
          errorCode: response.data.errorCode || 'BKASH_INITIATION_FAILED',
        };
      }
    } catch (error) {
      logger.error('bKash payment initiation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: paymentData.orderId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment initiation failed',
        errorCode: 'BKASH_API_ERROR',
      };
    }
  }

  async executePayment(paymentId: string): Promise<bKashExecutePaymentResponse> {
    try {
      const token = await this.getAccessToken();

      logger.info('Executing bKash payment', { paymentId });

      const response = await axios.post<bKashExecutePaymentResponse>(
        `${this.config.baseUrl}/tokenized/checkout/execute`,
        { paymentID: paymentId },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'authorization': token,
            'x-app-key': this.config.appKey,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error('bKash payment execution error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId,
      });
      throw error;
    }
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerificationResponse> {
    try {
      const token = await this.getAccessToken();

      logger.info('Verifying bKash payment', { transactionId });

      const response = await axios.post<bKashQueryPaymentResponse>(
        `${this.config.baseUrl}/tokenized/checkout/payment/status`,
        { paymentID: transactionId },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'authorization': token,
            'x-app-key': this.config.appKey,
          },
          timeout: 30000,
        }
      );

      const queryData = response.data;

      let status: PaymentStatus;
      switch (queryData.transactionStatus?.toUpperCase()) {
        case 'COMPLETED':
          status = PaymentStatus.COMPLETED;
          break;
        case 'FAILED':
          status = PaymentStatus.FAILED;
          break;
        case 'CANCELLED':
          status = PaymentStatus.CANCELED;
          break;
        case 'INITIATED':
        case 'IN_PROGRESS':
          status = PaymentStatus.PENDING;
          break;
        default:
          status = PaymentStatus.FAILED;
      }

      return {
        success: queryData.status_code === '0000' && status === PaymentStatus.COMPLETED,
        status,
        transactionId: queryData.paymentID,
        amount: parseFloat(queryData.amount || '0'),
        currency: queryData.currency || 'BDT',
        paidAt: status === PaymentStatus.COMPLETED && queryData.completedTime 
          ? new Date(queryData.completedTime) 
          : undefined,
        gatewayTransactionId: queryData.trxID,
      };
    } catch (error) {
      logger.error('bKash payment verification error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId,
      });

      return {
        success: false,
        status: PaymentStatus.FAILED,
        transactionId,
        amount: 0,
        currency: 'BDT',
        error: error instanceof Error ? error.message : 'Payment verification failed',
      };
    }
  }

  async refundPayment(
    transactionId: string,
    amount: number,
    reason?: string
  ): Promise<PaymentRefundResponse> {
    try {
      const token = await this.getAccessToken();

      logger.info('Initiating bKash refund', {
        transactionId,
        amount,
        reason,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/tokenized/checkout/payment/refund`,
        {
          paymentID: transactionId,
          amount: amount.toString(),
          trxID: `REF_${Date.now()}`,
          sku: 'refund',
          reason: reason || 'Refund requested',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'authorization': token,
            'x-app-key': this.config.appKey,
          },
          timeout: 30000,
        }
      );

      if (response.data.status_code === '0000') {
        return {
          success: true,
          refundId: response.data.refundTrxID,
          refundedAmount: parseFloat(response.data.refundAmount || amount.toString()),
        };
      } else {
        return {
          success: false,
          error: response.data.errorMessage || response.data.status_message || 'Refund failed',
        };
      }
    } catch (error) {
      logger.error('bKash refund error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId,
        amount,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<WebhookResponse> {
    try {
      logger.info('Processing bKash webhook', {
        paymentId: payload.paymentID,
        status: payload.transactionStatus,
      });

      // Verify the webhook signature if provided
      if (signature && !this.verifyWebhookSignature(payload, signature)) {
        logger.warn('Invalid bKash webhook signature', {
          paymentId: payload.paymentID,
        });
        return {
          success: false,
          transactionId: payload.paymentID,
          status: PaymentStatus.FAILED,
        };
      }

      let status: PaymentStatus;
      switch (payload.transactionStatus?.toUpperCase()) {
        case 'COMPLETED':
          status = PaymentStatus.COMPLETED;
          break;
        case 'FAILED':
          status = PaymentStatus.FAILED;
          break;
        case 'CANCELLED':
          status = PaymentStatus.CANCELED;
          break;
        case 'INITIATED':
        case 'IN_PROGRESS':
          status = PaymentStatus.PENDING;
          break;
        default:
          status = PaymentStatus.FAILED;
      }

      return {
        success: true,
        transactionId: payload.paymentID,
        status,
        amount: parseFloat(payload.amount || '0'),
        metadata: {
          trxId: payload.trxID,
          customerMsisdn: payload.customerMsisdn,
          merchantInvoiceNumber: payload.merchantInvoiceNumber,
        },
      };
    } catch (error) {
      logger.error('bKash webhook processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload,
      });

      return {
        success: false,
        transactionId: payload.paymentID || 'unknown',
        status: PaymentStatus.FAILED,
      };
    }
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      // bKash webhook signature verification logic
      const signString = JSON.stringify(payload) + this.config.appSecret;
      const hash = crypto.createHash('sha256').update(signString).digest('hex');
      return hash === signature;
    } catch (error) {
      logger.error('bKash webhook signature verification error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

// Export a factory function instead of instantiating immediately
export const createbKashService = () => new bKashPaymentService();

// For backward compatibility, export an instance only if credentials are available
let bKashServiceInstance: bKashPaymentService | null = null;

export const getbKashService = (): bKashPaymentService => {
  if (!bKashServiceInstance) {
    bKashServiceInstance = new bKashPaymentService();
  }
  return bKashServiceInstance;
};

// Legacy export - only create if not in development or if credentials are configured
export const bKashService = process.env.NODE_ENV === 'development' && 
  (!process.env.BKASH_APP_KEY || process.env.BKASH_APP_KEY === 'dev-app-key-placeholder')
  ? null 
  : new bKashPaymentService();