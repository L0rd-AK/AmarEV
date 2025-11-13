import React, { useState } from 'react';
import { PaymentProvider } from '@chargebd/shared';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentProcessingModal } from './PaymentProcessingModal';
import paymentService from '../../services/paymentService';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { Alert } from '../UI/Alert';
import { CreditCard, CheckCircle } from 'lucide-react';

interface PaymentIntegrationProps {
  reservationId?: string;
  sessionId?: string;
  amount: number;
  description: string;
  onPaymentSuccess: (transactionId: string) => void;
  onPaymentCancel?: () => void;
}

export const PaymentIntegration: React.FC<PaymentIntegrationProps> = ({
  reservationId,
  sessionId,
  amount,
  description,
  onPaymentSuccess,
  onPaymentCancel,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentProvider>(PaymentProvider.SSLCOMMERZ);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProcessing, setShowProcessing] = useState(false);

  const handlePayment = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setShowProcessing(true);

      // Don't specify callback URLs - let backend use its default URLs
      // Backend will handle SSLCommerz callbacks and redirect to frontend with query params
      const response = await paymentService.initiatePayment({
        reservationId,
        sessionId,
        amount,
        currency: 'BDT',
        paymentMethod: selectedMethod,
        description,
        // successUrl, failUrl, cancelUrl omitted - backend handles redirects
      });

      if (response.success && response.data) {
        // For SSLCommerz, redirect to payment gateway
        if (selectedMethod === PaymentProvider.SSLCOMMERZ) {
          const paymentUrl = response.data.gatewayPageURL || response.data.paymentUrl;
          
          if (paymentUrl) {
            // Store transaction ID for verification later
            localStorage.setItem('pendingPaymentTransaction', response.data.transactionId);
            localStorage.setItem('pendingPaymentReservation', reservationId || '');
            localStorage.setItem('pendingPaymentSession', sessionId || '');
            
            // Redirect to SSLCommerz payment page
            window.location.href = paymentUrl;
          } else {
            throw new Error('Payment URL not received from gateway');
          }
        }
      } else {
        throw new Error(response.error || 'Payment initiation failed');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to process payment. Please try again.');
      setShowProcessing(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Payment Summary
          </h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Description:</span>
            <span className="font-medium text-gray-900">{description}</span>
          </div>
          
          {reservationId && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Reservation ID:</span>
              <span className="font-mono text-xs text-gray-700">{reservationId.slice(-8)}</span>
            </div>
          )}
          
          <div className="flex justify-between pt-3 border-t border-blue-200">
            <span className="text-gray-900 font-semibold">Total Amount:</span>
            <span className="text-2xl font-bold text-green-600">৳{amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert type="error" title="Payment Error">
          {error}
        </Alert>
      )}

      {/* Payment Method Selection */}
      <PaymentMethodSelector
        selectedMethod={selectedMethod}
        onSelectMethod={setSelectedMethod}
        disabled={isProcessing}
      />

      {/* Security Notice */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-medium mb-1">Secure Payment</p>
            <p className="text-green-700">
              Your payment is processed through SSLCommerz, Bangladesh's leading payment gateway.
              All transactions are encrypted and secure.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Button */}
      <div className="flex gap-4">
        {onPaymentCancel && (
          <button
            onClick={onPaymentCancel}
            disabled={isProcessing}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        
        <button
          onClick={handlePayment}
          disabled={isProcessing || !selectedMethod}
          className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <LoadingSpinner />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              <span>Proceed to Payment</span>
            </>
          )}
        </button>
      </div>

      {/* Processing Modal */}
      {showProcessing && (
        <PaymentProcessingModal
          isOpen={showProcessing}
          transactionId={''}
          paymentMethod={selectedMethod}
          onClose={() => setShowProcessing(false)}
        />
      )}
    </div>
  );
};
