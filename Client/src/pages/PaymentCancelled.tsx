import React from 'react';
import { useNavigate } from 'react-router-dom';

export const PaymentCancelled: React.FC = () => {
  const navigate = useNavigate();

  const handleTryAgain = () => {
    navigate(-1); // Go back to booking page
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          {/* Warning Icon */}
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <svg
              className="w-12 h-12 text-gray-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>

          {/* Title */}
          <h1 className="mt-6 text-2xl font-bold text-gray-900">Payment Cancelled</h1>
          
          {/* Message */}
          <p className="mt-3 text-gray-600">
            You have cancelled the payment process. No charges have been made to your account.
          </p>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Your reservation has not been confirmed. To complete your booking,
              please proceed with the payment.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-8 space-y-3">
            <button
              onClick={handleTryAgain}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              Complete Payment
            </button>
            <button
              onClick={handleGoHome}
              className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              Go to Homepage
            </button>
          </div>

          {/* Support */}
          <div className="mt-8 pt-6 border-t text-sm text-gray-500">
            <p>Changed your mind?</p>
            <p className="mt-1">
              You can always come back and complete your booking later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
