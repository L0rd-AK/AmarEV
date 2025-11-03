import React, { useEffect } from 'react';
import { LoadingSpinner } from '../UI';
import { PaymentProvider } from '@chargebd/shared';

interface PaymentProcessingModalProps {
  isOpen: boolean;
  paymentMethod: PaymentProvider | null;
  paymentUrl?: string;
  onClose: () => void;
  status: 'processing' | 'redirecting' | 'verifying' | 'success' | 'failed';
  error?: string;
}

export const PaymentProcessingModal: React.FC<PaymentProcessingModalProps> = ({
  isOpen,
  paymentMethod,
  paymentUrl,
  onClose,
  status,
  error,
}) => {
  useEffect(() => {
    if (status === 'redirecting' && paymentUrl) {
      // Redirect to payment gateway
      window.location.href = paymentUrl;
    }
  }, [status, paymentUrl]);

  if (!isOpen) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
      case 'redirecting':
      case 'verifying':
        return (
          <div className="w-16 h-16">
            <LoadingSpinner />
          </div>
        );
      case 'success':
        return (
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        );
      case 'failed':
        return (
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'processing':
        return {
          title: 'Processing Payment',
          description: 'Please wait while we process your payment request...',
        };
      case 'redirecting':
        return {
          title: 'Redirecting to Payment Gateway',
          description: `You will be redirected to ${
            paymentMethod === PaymentProvider.BKASH ? 'bKash' : 'payment gateway'
          } to complete your payment...`,
        };
      case 'verifying':
        return {
          title: 'Verifying Payment',
          description: 'Please wait while we verify your payment...',
        };
      case 'success':
        return {
          title: 'Payment Successful!',
          description: 'Your payment has been processed successfully.',
        };
      case 'failed':
        return {
          title: 'Payment Failed',
          description: error || 'An error occurred while processing your payment.',
        };
      default:
        return {
          title: '',
          description: '',
        };
    }
  };

  const { title, description } = getStatusText();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-8">
        <div className="flex flex-col items-center text-center">
          {getStatusIcon()}

          <h2 className="mt-6 text-2xl font-bold text-gray-900">{title}</h2>
          <p className="mt-2 text-gray-600">{description}</p>

          {status === 'failed' && (
            <button
              onClick={onClose}
              className="mt-6 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Try Again
            </button>
          )}

          {status === 'success' && (
            <button
              onClick={onClose}
              className="mt-6 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          )}

          {(status === 'processing' || status === 'redirecting' || status === 'verifying') && (
            <p className="mt-6 text-sm text-gray-500">
              This may take a few moments. Please do not close this window.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
