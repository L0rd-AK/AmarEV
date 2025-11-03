import React, { useEffect, useState } from 'react';
import { LoadingSpinner, Card, Button } from '../components/UI';
import paymentService, { Payment, PaymentStats } from '../services/paymentService';
import { PaymentStatus } from '@chargebd/shared';
import { PaymentReceipt } from '../components/Payment';

export const TransactionHistory: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [paymentsData, statsData] = await Promise.all([
        paymentService.getPaymentHistory(page, 10),
        paymentService.getPaymentStats(),
      ]);
      
      setPayments(paymentsData.payments);
      setTotalPages(paymentsData.totalPages);
      setStats(statsData);
      setError('');
    } catch (err: any) {
      console.error('Load transaction history error:', err);
      setError('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

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
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowReceipt(true);
  };

  const handleDownloadReceipt = async (transactionId: string) => {
    try {
      await paymentService.downloadReceipt(transactionId);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (loading && page === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (showReceipt && selectedPayment) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowReceipt(false)}
            className="mb-4 text-green-600 hover:text-green-700 flex items-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Transactions
          </button>
          <PaymentReceipt
            payment={selectedPayment}
            onDownload={() => handleDownloadReceipt(selectedPayment.transactionId)}
            onClose={() => setShowReceipt(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Transaction History</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <div className="p-6">
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ৳{stats.totalSpent.toFixed(2)}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalTransactions}</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm text-gray-600">Successful</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.successfulPayments}</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm text-gray-600">Refunded</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  ৳{stats.refundedAmount.toFixed(2)}
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Transactions Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                        {payment.transactionId.slice(0, 16)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.provider.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ৳{payment.amountBDT.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleViewReceipt(payment)}
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
