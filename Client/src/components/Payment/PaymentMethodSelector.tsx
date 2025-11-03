import React from 'react';
import { PaymentProvider } from '@chargebd/shared';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentProvider | null;
  onSelectMethod: (method: PaymentProvider) => void;
  disabled?: boolean;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onSelectMethod,
  disabled = false,
}) => {
  const paymentMethods = [
    {
      id: PaymentProvider.BKASH,
      name: 'bKash',
      logo: '/payment-logos/bkash.png',
      description: 'Pay with bKash mobile wallet',
      badge: 'Popular',
    },
    {
      id: PaymentProvider.SSLCOMMERZ,
      name: 'Card Payment',
      logo: '/payment-logos/sslcommerz.png',
      description: 'Credit/Debit card, mobile banking',
      badge: 'All Cards',
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Select Payment Method</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentMethods.map((method) => (
          <button
            key={method.id}
            onClick={() => onSelectMethod(method.id)}
            disabled={disabled}
            className={`relative p-6 border-2 rounded-lg transition-all ${
              selectedMethod === method.id
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 hover:border-green-300 bg-white'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {method.badge && (
              <span className="absolute top-3 right-3 px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded">
                {method.badge}
              </span>
            )}
            
            <div className="flex items-center space-x-4">
              {/* Payment Logo Placeholder */}
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                {method.id === PaymentProvider.BKASH ? (
                  <span className="text-2xl font-bold text-pink-600">bKash</span>
                ) : (
                  <span className="text-xs font-semibold text-gray-600">CARDS</span>
                )}
              </div>
              
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">{method.name}</p>
                <p className="text-sm text-gray-600">{method.description}</p>
              </div>

              {/* Checkbox */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedMethod === method.id
                    ? 'border-green-600 bg-green-600'
                    : 'border-gray-300'
                }`}
              >
                {selectedMethod === method.id && (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Security Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg
            className="w-5 h-5 text-blue-600 mt-0.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <div>
            <p className="text-sm font-semibold text-blue-900">Secure Payment</p>
            <p className="text-xs text-blue-800">
              Your payment information is encrypted and secure. We never store your card details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
