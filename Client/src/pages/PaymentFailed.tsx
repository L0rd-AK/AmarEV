import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingSpinner } from '../components/UI';

export const PaymentFailed: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const error = searchParams.get('error') || 'Payment was not completed';
    const reason = searchParams.get('reason');
    
    if (reason) {
      setErrorMessage(`${error}: ${reason}`);
    } else {
      setErrorMessage(error);
    }
  }, [searchParams]);

  const handleTryAgain = () => {
    navigate(-1); // Go back to previous page
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          {/* Error Icon */}
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <svg
              className="w-12 h-12 text-red-600"
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

          {/* Title */}
          <h1 className="mt-6 text-2xl font-bold text-gray-900">Payment Failed</h1>
          
          {/* Error Message */}
          <p className="mt-3 text-gray-600">{errorMessage}</p>

          {/* Additional Info */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>What happened?</strong>
              <br />
              Your payment was not processed successfully. This could be due to:
            </p>
            <ul className="mt-2 text-sm text-yellow-700 text-left list-disc list-inside">
              <li>Insufficient funds</li>
              <li>Payment cancellation</li>
              <li>Network issues</li>
              <li>Invalid payment information</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="mt-8 space-y-3">
            <button
              onClick={handleTryAgain}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              Try Again
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
            <p>Need help?</p>
            <p className="mt-1">
              Contact our support team at{' '}
              <a href="mailto:support@amarev.com" className="text-green-600 hover:underline">
                support@amarev.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
