import React from 'react';
import { Payment } from '../../services/paymentService';
import { PaymentStatus } from '@chargebd/shared';
import { Button } from '../UI';

interface PaymentReceiptProps {
  payment: Payment;
  onDownload?: () => void;
  onClose?: () => void;
}

export const PaymentReceipt: React.FC<PaymentReceiptProps> = ({
  payment,
  onDownload,
  onClose,
}) => {
  const getStatusBadge = (status: PaymentStatus) => {
    const statusConfig = {
      [PaymentStatus.COMPLETED]: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: 'Completed',
      },
      [PaymentStatus.PENDING]: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: 'Pending',
      },
      [PaymentStatus.FAILED]: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: 'Failed',
      },
      [PaymentStatus.REFUNDED]: {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        label: 'Refunded',
      },
      [PaymentStatus.CANCELED]: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        label: 'Canceled',
      },
    };

    const config = statusConfig[status] || statusConfig[PaymentStatus.PENDING];
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="border-b pb-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AmarEV</h1>
            <p className="text-sm text-gray-600 mt-1">EV Charging Network</p>
          </div>
          {getStatusBadge(payment.status)}
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mt-4">Payment Receipt</h2>
      </div>

      {/* Receipt Details */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Receipt Number</p>
            <p className="font-semibold text-gray-900">
              RCP-{payment._id.slice(-8).toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Transaction ID</p>
            <p className="font-semibold text-gray-900 text-sm break-all">
              {payment.transactionId}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Date</p>
            <p className="font-semibold text-gray-900">{formatDate(payment.createdAt)}</p>
          </div>
          {payment.paidAt && (
            <div>
              <p className="text-sm text-gray-600">Paid At</p>
              <p className="font-semibold text-gray-900">{formatDate(payment.paidAt)}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Payment Method</p>
            <p className="font-semibold text-gray-900">{payment.provider.toUpperCase()}</p>
          </div>
          {payment.gatewayTransactionId && (
            <div>
              <p className="text-sm text-gray-600">Gateway Transaction ID</p>
              <p className="font-semibold text-gray-900 text-sm break-all">
                {payment.gatewayTransactionId}
              </p>
            </div>
          )}
        </div>

        {/* Card Details */}
        {payment.cardDetails && (
          <div>
            <p className="text-sm text-gray-600">Card Details</p>
            <p className="font-semibold text-gray-900">
              {payment.cardDetails.cardBrand} {payment.cardDetails.cardType}
              {payment.cardDetails.lastFourDigits && ` ****${payment.cardDetails.lastFourDigits}`}
            </p>
          </div>
        )}

        {/* Amount */}
        <div className="border-t border-b py-4 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg text-gray-700">Amount</span>
            <span className="text-2xl font-bold text-gray-900">
              ৳{payment.amountBDT.toFixed(2)}
            </span>
          </div>
          {payment.refundedAmount && payment.refundedAmount > 0 && (
            <div className="flex justify-between items-center mt-2 text-purple-700">
              <span>Refunded</span>
              <span className="font-semibold">-৳{payment.refundedAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Refund Details */}
        {payment.status === PaymentStatus.REFUNDED && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">Refund Information</h3>
            <div className="space-y-2 text-sm">
              {payment.refundId && (
                <div className="flex justify-between">
                  <span className="text-purple-700">Refund ID:</span>
                  <span className="font-semibold text-purple-900">{payment.refundId}</span>
                </div>
              )}
              {payment.refundedAt && (
                <div className="flex justify-between">
                  <span className="text-purple-700">Refunded At:</span>
                  <span className="font-semibold text-purple-900">
                    {formatDate(payment.refundedAt)}
                  </span>
                </div>
              )}
              {payment.refundReason && (
                <div>
                  <span className="text-purple-700">Reason:</span>
                  <p className="font-semibold text-purple-900 mt-1">{payment.refundReason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Failure Details */}
        {payment.status === PaymentStatus.FAILED && payment.failureReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">Failure Reason</h3>
            <p className="text-sm text-red-700">{payment.failureReason}</p>
          </div>
        )}

        {/* Timeline */}
        {payment.timeline && payment.timeline.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Payment Timeline</h3>
            <div className="space-y-3">
              {payment.timeline.map((event, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full bg-green-600 mt-2"></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-gray-900 capitalize">
                        {event.status.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-gray-600">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {event.note && <p className="text-sm text-gray-600 mt-1">{event.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 flex space-x-4">
        {onDownload && (
          <Button variant="primary" onClick={onDownload} className="flex-1">
            <svg
              className="w-5 h-5 mr-2 inline"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Download Receipt
          </Button>
        )}
        {onClose && (
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Close
          </Button>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
        <p>Thank you for using AmarEV!</p>
        <p className="mt-1">For support, contact us at support@amarev.com</p>
      </div>
    </div>
  );
};
