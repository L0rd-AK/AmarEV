import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { PaymentReceipt } from '../components/Payment';
import { LoadingSpinner } from '../components/UI';
import paymentService, { Payment } from '../services/paymentService';
import { PaymentProvider } from '@chargebd/shared';

export const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const verifyPayment = async () => {
      // DEBUG: Log full URL and all parameters
      console.log('Full URL:', window.location.href);
      console.log('Search params:', window.location.search);
      console.log('Path:', window.location.pathname);
      
      // Get transaction details from:
      // 1. URL path parameter (e.g., /payment/success/TXN_123)
      // 2. Query parameters (e.g., /payment/success?tran_id=TXN_123)
      const urlParams = new URLSearchParams(window.location.search);
      
      // DEBUG: Log all query parameters
      console.log('All URL params:', Object.fromEntries(urlParams.entries()));
      
      // Priority: URL path param > query params
      let transactionId = id || urlParams.get('tran_id') || urlParams.get('transactionId');
      let valId = urlParams.get('val_id');
      let status = urlParams.get('status');
      
      console.log('Extracted values:', { transactionId, valId, status, pathId: id });
      
      const provider = (urlParams.get('provider') as PaymentProvider) || PaymentProvider.SSLCOMMERZ;

      if (!transactionId) {
        console.error('No transaction ID found in URL');
        setError('Invalid payment callback - No transaction ID found in URL. Please check the payment link or try again.');
        setLoading(false);
        return;
      }

      // Check if SSLCommerz returned a failed/cancelled status
      if (status && (status.toUpperCase() === 'FAILED' || status.toUpperCase() === 'CANCELLED')) {
        setError(`Payment ${status.toLowerCase()}. Please try again.`);
        setLoading(false);
        return;
      }

      try {
        console.log('Verifying payment:', { transactionId, valId, status, provider });
        
        // If we only have transactionId (from URL path), fetch payment directly
        if (id && !valId) {
          // Direct fetch when accessing via /payment/success/:id
          const paymentData = await paymentService.getPayment(transactionId);
          setPayment(paymentData);
          setLoading(false);
          return;
        }
        
        // Otherwise, verify with payment gateway first
        const response = await paymentService.verifyPayment({
          transactionId: valId || transactionId,
          paymentMethod: provider,
        });

        console.log('Verification response:', response);

        if (response.success && response.data?.success) {
          // Try to fetch full payment details
          try {
            const paymentData = await paymentService.getPayment(transactionId);
            setPayment(paymentData);
          } catch (fetchError: any) {
            console.warn('Could not fetch full payment details:', fetchError);
            // Payment verified successfully but can't fetch details
            // Show success message without full details
            setPayment({
              _id: '',
              transactionId,
              userId: '',
              amount: response.data.amount || 0,
              amountBDT: response.data.amount || 0,
              currency: response.data.currency || 'BDT',
              status: 'completed',
              paymentMethod: provider,
              provider: provider,
              paidAt: response.data.paidAt || new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as any);
          }
          
          // Clear pending payment data from localStorage
          localStorage.removeItem('pendingPaymentTransaction');
          localStorage.removeItem('pendingPaymentReservation');
          localStorage.removeItem('pendingPaymentSession');
        } else {
          setError(response.data?.error || 'Payment verification failed');
        }
      } catch (err: any) {
        console.error('Payment verification error:', err);
        setError(err.response?.data?.error || err.message || 'Failed to verify payment');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams, id]);

  const handleDownload = async () => {
    if (payment) {
      try {
        await paymentService.downloadReceipt(payment.transactionId);
      } catch (error) {
        console.error('Download error:', error);
      }
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleViewTransactions = () => {
    navigate('/transaction-history');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
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
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Payment Verification Failed</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={handleGoHome}
            className="mt-6 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
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
            <div>
              <h1 className="text-2xl font-bold text-green-900">Payment Successful!</h1>
              <p className="text-green-700">
                Your payment has been processed successfully and your charging session is confirmed.
              </p>
              <p className="text-green-600 text-sm mt-1">
                Transaction receipt and details are available in your Transaction History.
              </p>
            </div>
          </div>
        </div>

        {/* Receipt */}
        {payment && (
          <PaymentReceipt
            payment={payment}
            onDownload={handleDownload}
            onClose={handleGoHome}
          />
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleGoToDashboard}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
          >
            Go to Dashboard
          </button>
          <button
            onClick={handleViewTransactions}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Transaction History
          </button>
          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Homepage
          </button>
        </div>
      </div>
    </div>
  );
};
