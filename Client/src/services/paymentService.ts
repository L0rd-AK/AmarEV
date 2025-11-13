import axios from 'axios';
import { PaymentProvider, PaymentStatus } from '@chargebd/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface PaymentInitiationRequest {
  reservationId?: string;
  sessionId?: string;
  amount: number;
  currency?: string;
  paymentMethod: PaymentProvider;
  description?: string;
  successUrl?: string;
  failUrl?: string;
  cancelUrl?: string;
}

export interface PaymentInitiationResponse {
  success: boolean;
  data?: {
    transactionId: string;
    paymentUrl?: string;
    gatewayPageURL?: string;
    sessionKey?: string;
  };
  error?: string;
  errorCode?: string;
}

export interface PaymentVerificationRequest {
  transactionId: string;
  paymentMethod: PaymentProvider;
}

export interface PaymentVerificationResponse {
  success: boolean;
  data?: {
    success: boolean;
    status: PaymentStatus;
    transactionId: string;
    amount: number;
    currency: string;
    paidAt?: string;
    gatewayTransactionId?: string;
    error?: string;
  };
}

export interface PaymentHistory {
  payments: Payment[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Payment {
  _id: string;
  userId: string;
  provider: PaymentProvider;
  amountBDT: number;
  currency: string;
  status: PaymentStatus;
  transactionId: string;
  gatewayTransactionId?: string;
  metadata: Record<string, any>;
  reservationId?: any;
  sessionId?: any;
  paidAt?: string;
  refundedAmount?: number;
  refundId?: string;
  refundReason?: string;
  refundedAt?: string;
  failureReason?: string;
  cardDetails?: {
    cardType?: string;
    cardBrand?: string;
    cardIssuer?: string;
    lastFourDigits?: string;
  };
  timeline?: Array<{
    status: PaymentStatus;
    timestamp: string;
    note?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentStats {
  totalSpent: number;
  totalTransactions: number;
  successfulPayments: number;
  failedPayments: number;
  refundedAmount: number;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason?: string;
  paymentMethod: PaymentProvider;
}

class PaymentService {
  private getAuthHeaders() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    
    // Validate token format (JWT has 3 parts separated by dots)
    if (token && token.split('.').length !== 3) {
      console.warn('Invalid token format in payment service');
      return {
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }
    
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Initiate a payment
   */
  async initiatePayment(data: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/payments/initiate`,
        data,
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to initiate payment',
        errorCode: error.response?.data?.errorCode || 'PAYMENT_INIT_ERROR',
      };
    }
  }

  /**
   * Execute bKash payment (after user authorization)
   */
  async executePayment(paymentId: string, paymentMethod: PaymentProvider): Promise<any> {
    try {
      const response = await axios.post(
        `${API_URL}/payments/bkash/execute`,
        { paymentId, paymentMethod },
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Payment execution error:', error);
      throw error;
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(data: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/payments/verify`,
        data,
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Payment verification error:', error);
      throw error;
    }
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(page: number = 1, limit: number = 10): Promise<PaymentHistory> {
    try {
      const response = await axios.get(
        `${API_URL}/payments/history?page=${page}&limit=${limit}`,
        this.getAuthHeaders()
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Get payment history error:', error);
      throw error;
    }
  }

  /**
   * Get payment details
   */
  async getPayment(transactionId: string): Promise<Payment> {
    try {
      const response = await axios.get(
        `${API_URL}/payments/${transactionId}`,
        this.getAuthHeaders()
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Get payment error:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<PaymentStats> {
    try {
      const response = await axios.get(
        `${API_URL}/payments/stats`,
        this.getAuthHeaders()
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Get payment stats error:', error);
      throw error;
    }
  }

  /**
   * Request a refund (admin/operator only)
   */
  async requestRefund(data: RefundRequest): Promise<any> {
    try {
      const response = await axios.post(
        `${API_URL}/payments/refund`,
        data,
        this.getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Refund request error:', error);
      throw error;
    }
  }

  /**
   * Generate receipt data for a payment
   */
  generateReceipt(payment: Payment): {
    receiptNumber: string;
    date: string;
    amount: string;
    status: string;
    paymentMethod: string;
    transactionId: string;
  } {
    return {
      receiptNumber: `RCP-${payment._id.slice(-8).toUpperCase()}`,
      date: new Date(payment.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      amount: `৳${payment.amountBDT.toFixed(2)}`,
      status: payment.status,
      paymentMethod: payment.provider.toUpperCase(),
      transactionId: payment.transactionId,
    };
  }

  /**
   * Download receipt as PDF (placeholder - would need PDF generation library)
   */
  async downloadReceipt(transactionId: string): Promise<void> {
    try {
      const payment = await this.getPayment(transactionId);
      const receipt = this.generateReceipt(payment);
      
      // For now, just open print dialog
      // In production, you'd generate a proper PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt - ${receipt.receiptNumber}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; }
                .receipt { max-width: 600px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 30px; }
                .details { margin: 20px 0; }
                .row { display: flex; justify-content: space-between; margin: 10px 0; }
                .label { font-weight: bold; }
              </style>
            </head>
            <body>
              <div class="receipt">
                <div class="header">
                  <h1>AmarEV</h1>
                  <h2>Payment Receipt</h2>
                </div>
                <div class="details">
                  <div class="row">
                    <span class="label">Receipt Number:</span>
                    <span>${receipt.receiptNumber}</span>
                  </div>
                  <div class="row">
                    <span class="label">Date:</span>
                    <span>${receipt.date}</span>
                  </div>
                  <div class="row">
                    <span class="label">Amount:</span>
                    <span>${receipt.amount}</span>
                  </div>
                  <div class="row">
                    <span class="label">Payment Method:</span>
                    <span>${receipt.paymentMethod}</span>
                  </div>
                  <div class="row">
                    <span class="label">Transaction ID:</span>
                    <span>${receipt.transactionId}</span>
                  </div>
                  <div class="row">
                    <span class="label">Status:</span>
                    <span>${receipt.status}</span>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Download receipt error:', error);
      throw error;
    }
  }
}

export default new PaymentService();
