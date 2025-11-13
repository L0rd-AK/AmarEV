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

interface SSLCommerzConfig {
  storeId: string;
  storePassword: string;
  sandboxMode: boolean;
  baseUrl: string;
}

interface SSLCommerzInitiationRequest {
  store_id: string;
  store_passwd: string;
  total_amount: number;
  currency: string;
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  desc: string;
  cus_name: string;
  cus_email: string;
  cus_add1?: string;
  cus_add2?: string;
  cus_city?: string;
  cus_state?: string;
  cus_postcode?: string;
  cus_country?: string;
  cus_phone: string;
  cus_fax?: string;
  ship_name?: string;
  ship_add1?: string;
  ship_add2?: string;
  ship_city?: string;
  ship_state?: string;
  ship_postcode?: string;
  ship_country?: string;
  shipping_method?: string;
  product_name?: string;
  product_category?: string;
  product_profile?: string;
  hours_till_departure?: string;
  flight_type?: string;
  pnr?: string;
  journey_from_to?: string;
  third_party_booking?: string;
  hotel_name?: string;
  length_of_stay?: string;
  check_in_time?: string;
  hotel_city?: string;
  product_type?: string;
  topup_number?: string;
  country_topup?: string;
  cart?: string;
  product_amount?: number;
  vat?: number;
  discount_amount?: number;
  convenience_fee?: number;
  value_a?: string;
  value_b?: string;
  value_c?: string;
  value_d?: string;
  emi_option?: number;
  emi_max_inst_option?: number;
  emi_selected_inst?: number;
  emi_allow_only?: number;
}

interface SSLCommerzInitiationResponse {
  status: string;
  failedreason?: string;
  sessionkey?: string;
  gw?: Array<{
    name: string;
    type: string;
    logo: string;
    gw: string;
    r_flag: string;
    redirectGatewayURL: string;
  }>;
  desc?: string;
  is_direct_pay_enable?: string;
  direct_pay_gw?: string[];
  direct_pay_gw_name?: string[];
  direct_pay_gw_logo?: string[];
  direct_pay_gw_redirectGatewayURL?: string[];
  redirectGatewayURL?: string;
  GatewayPageURL?: string;
  storeBanner?: string;
  storeLogo?: string;
  store_name?: string;
  desc2?: string;
}

interface SSLCommerzValidationResponse {
  status: string;
  tran_date: string;
  tran_id: string;
  val_id: string;
  amount: string;
  store_amount: string;
  currency: string;
  bank_tran_id: string;
  card_type: string;
  card_no: string;
  card_issuer: string;
  card_brand: string;
  card_issuer_country: string;
  card_issuer_country_code: string;
  store_id: string;
  verify_sign: string;
  verify_key: string;
  verify_sign_sha2: string;
  currency_type: string;
  currency_amount: string;
  currency_rate: string;
  base_fair: string;
  value_a: string;
  value_b: string;
  value_c: string;
  value_d: string;
  subscription_id: string;
  risk_level: string;
  risk_title: string;
}

export class SSLCommerzPaymentService implements PaymentProvider {
  private config: SSLCommerzConfig;

  constructor() {
    // In development/sandbox mode, use SSLCommerz test credentials if not provided
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const defaultTestStoreId = 'testbox';
    const defaultTestPassword = 'qwerty';
    
    this.config = {
      storeId: process.env.SSLCOMMERZ_STORE_ID || (isDevelopment ? defaultTestStoreId : ''),
      storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || (isDevelopment ? defaultTestPassword : ''),
      sandboxMode: isDevelopment,
      baseUrl: isDevelopment
        ? 'https://sandbox.sslcommerz.com'
        : 'https://securepay.sslcommerz.com',
    };

    // Only require credentials in production
    if (!isDevelopment && (!this.config.storeId || !this.config.storePassword)) {
      throw new Error('SSLCOMMERZ credentials not configured for production');
    }

    if (isDevelopment) {
      if (process.env.SSLCOMMERZ_STORE_ID) {
        logger.info(`SSLCOMMERZ running in SANDBOX mode with store ID: ${this.config.storeId}`);
      } else {
        logger.warn('SSLCOMMERZ running in DEMO mode with test credentials (testbox)');
        logger.warn('For actual testing, set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD in .env');
      }
    }
  }

  async initiatePayment(paymentData: PaymentInitiationData): Promise<PaymentInitiationResponse> {
    try {
      const requestData: SSLCommerzInitiationRequest = {
        store_id: this.config.storeId,
        store_passwd: this.config.storePassword,
        total_amount: paymentData.amount,
        currency: paymentData.currency,
        tran_id: paymentData.orderId,
        success_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/sslcommerz/success`,
        fail_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/sslcommerz/fail`,
        cancel_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/sslcommerz/cancel`,
        desc: paymentData.description,
        cus_name: paymentData.customerInfo.name,
        cus_email: paymentData.customerInfo.email,
        cus_phone: paymentData.customerInfo.phone,
        cus_add1: 'N/A',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        shipping_method: 'NO',
        product_name: 'EV Charging Service',
        product_category: 'Service',
        product_profile: 'general',
        value_a: paymentData.metadata?.userId || '',
        value_b: paymentData.metadata?.reservationId || '',
        value_c: paymentData.metadata?.sessionId || '',
        value_d: paymentData.metadata?.stationId || '',
      };

      logger.info('Initiating SSLCOMMERZ payment', {
        transactionId: paymentData.orderId,
        amount: paymentData.amount,
        currency: paymentData.currency,
      });

      const response = await axios.post<SSLCommerzInitiationResponse>(
        `${this.config.baseUrl}/gwprocess/v4/api.php`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000,
        }
      );

      if (response.data.status === 'SUCCESS') {
        return {
          success: true,
          sessionKey: response.data.sessionkey,
          gatewayPageURL: response.data.GatewayPageURL,
          paymentUrl: response.data.redirectGatewayURL,
          transactionId: paymentData.orderId,
        };
      } else {
        return {
          success: false,
          error: response.data.failedreason || 'Payment initiation failed',
          errorCode: 'SSLCOMMERZ_INITIATION_FAILED',
        };
      }
    } catch (error) {
      logger.error('SSLCOMMERZ payment initiation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: paymentData.orderId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment initiation failed',
        errorCode: 'SSLCOMMERZ_API_ERROR',
      };
    }
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerificationResponse> {
    try {
      logger.info('Verifying SSLCOMMERZ payment', { transactionId });

      const response = await axios.get<SSLCommerzValidationResponse>(
        `${this.config.baseUrl}/validator/api/validationserverAPI.php`,
        {
          params: {
            val_id: transactionId,
            store_id: this.config.storeId,
            store_passwd: this.config.storePassword,
            format: 'json',
          },
          timeout: 30000,
        }
      );

      const validationData = response.data;

      logger.info('SSLCOMMERZ validation response', {
        status: validationData.status,
        tran_id: validationData.tran_id,
        amount: validationData.amount,
        val_id: transactionId,
      });

      // Skip signature verification in sandbox mode (testbox credentials)
      // In production, you MUST enable this for security
      const isSignatureValid = this.config.sandboxMode ? true : this.verifySignature(validationData);
      
      if (!isSignatureValid) {
        logger.warn('Invalid SSLCOMMERZ signature', { transactionId });
        return {
          success: false,
          status: PaymentStatus.FAILED,
          transactionId,
          amount: 0,
          currency: validationData.currency || 'BDT',
          error: 'Invalid payment signature',
        };
      }

      let status: PaymentStatus;
      switch (validationData.status?.toUpperCase()) {
        case 'VALID':
        case 'VALIDATED':
          status = PaymentStatus.COMPLETED;
          break;
        case 'FAILED':
          status = PaymentStatus.FAILED;
          break;
        case 'CANCELLED':
          status = PaymentStatus.CANCELED;
          break;
        default:
          status = PaymentStatus.PENDING;
      }

      logger.info('SSLCOMMERZ payment verification result', {
        transactionId: validationData.tran_id,
        status,
        success: status === PaymentStatus.COMPLETED,
      });

      return {
        success: status === PaymentStatus.COMPLETED,
        status,
        transactionId: validationData.tran_id,
        amount: parseFloat(validationData.amount || '0'),
        currency: validationData.currency || 'BDT',
        paidAt: status === PaymentStatus.COMPLETED ? new Date(validationData.tran_date) : undefined,
        gatewayTransactionId: validationData.bank_tran_id,
      };
    } catch (error) {
      logger.error('SSLCOMMERZ payment verification error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error instanceof Error ? error.stack : undefined,
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
      logger.info('Initiating SSLCOMMERZ refund', {
        transactionId,
        amount,
        reason,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/validator/api/merchantTransIDvalidationAPI.php`,
        {
          store_id: this.config.storeId,
          store_passwd: this.config.storePassword,
          refund_amount: amount,
          refund_remarks: reason || 'Refund requested',
          bank_tran_id: transactionId,
          refe_id: `REF_${Date.now()}`,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000,
        }
      );

      if (response.data.status === 'SUCCESS') {
        return {
          success: true,
          refundId: response.data.refund_ref_id,
          refundedAmount: amount,
        };
      } else {
        return {
          success: false,
          error: response.data.failedreason || 'Refund failed',
        };
      }
    } catch (error) {
      logger.error('SSLCOMMERZ refund error', {
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
      logger.info('Processing SSLCOMMERZ webhook', {
        transactionId: payload.tran_id,
        status: payload.status,
      });

      // Verify the webhook signature if provided
      if (signature && !this.verifyWebhookSignature(payload, signature)) {
        logger.warn('Invalid SSLCOMMERZ webhook signature', {
          transactionId: payload.tran_id,
        });
        return {
          success: false,
          transactionId: payload.tran_id,
          status: PaymentStatus.FAILED,
        };
      }

      let status: PaymentStatus;
      switch (payload.status?.toUpperCase()) {
        case 'VALID':
        case 'VALIDATED':
          status = PaymentStatus.COMPLETED;
          break;
        case 'FAILED':
          status = PaymentStatus.FAILED;
          break;
        case 'CANCELLED':
          status = PaymentStatus.CANCELED;
          break;
        default:
          status = PaymentStatus.PENDING;
      }

      return {
        success: true,
        transactionId: payload.tran_id,
        status,
        amount: parseFloat(payload.amount || '0'),
        metadata: {
          bankTransactionId: payload.bank_tran_id,
          cardType: payload.card_type,
          cardBrand: payload.card_brand,
          userId: payload.value_a,
          reservationId: payload.value_b,
          sessionId: payload.value_c,
          stationId: payload.value_d,
        },
      };
    } catch (error) {
      logger.error('SSLCOMMERZ webhook processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload,
      });

      return {
        success: false,
        transactionId: payload.tran_id || 'unknown',
        status: PaymentStatus.FAILED,
      };
    }
  }

  private verifySignature(data: SSLCommerzValidationResponse): boolean {
    try {
      const signString = `${this.config.storePassword}${data.val_id}${data.amount}${data.currency}${data.store_amount}${data.currency}`;
      const hash = crypto.createHash('md5').update(signString).digest('hex');
      return hash === data.verify_sign;
    } catch (error) {
      logger.error('Signature verification error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      // SSLCOMMERZ webhook signature verification logic
      const signString = `${this.config.storePassword}${payload.val_id}${payload.amount}${payload.currency}${payload.store_amount}${payload.currency}`;
      const hash = crypto.createHash('md5').update(signString).digest('hex');
      return hash === signature;
    } catch (error) {
      logger.error('Webhook signature verification error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}