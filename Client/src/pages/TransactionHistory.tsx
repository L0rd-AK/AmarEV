import React, { useEffect, useState } from 'react';
import { LoadingSpinner, Card, Button } from '../components/UI';
import paymentService, { Payment, PaymentStats } from '../services/paymentService';
import reservationService from '../services/reservationService';
import { PaymentStatus, ReservationStatus } from '@chargebd/shared';
import { PaymentReceipt } from '../components/Payment';
import { Calendar, MapPin, Clock, CheckCircle, Zap } from 'lucide-react';

interface CompletedReservation {
  _id: string;
  stationId: {
    _id: string;
    name: string;
    address: { area: string; city: string };
  };
  connectorId: {
    _id: string;
    standard: string;
    type: string;
  };
  vehicleId: {
    _id: string;
    make: string;
    model: string;
    licensePlate: string;
  };
  startTime: string;
  endTime: string;
  status: string;
  totalCostBDT?: number;
  estimatedCostBDT?: number;
  isPaid?: boolean;
  createdAt: string;
}

export const TransactionHistory: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [completedReservations, setCompletedReservations] = useState<CompletedReservation[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payments' | 'completed'>('payments');
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [paymentsData, statsData, reservationsResponse] = await Promise.all([
        paymentService.getPaymentHistory(page, 10),
        paymentService.getPaymentStats(),
        reservationService.getUserReservations(ReservationStatus.COMPLETED),
      ]);
      
      setPayments(paymentsData.payments);
      setTotalPages(paymentsData.totalPages);
      setStats(statsData);
      
      // Extract completed reservations
      const resData = (reservationsResponse as any).reservations || reservationsResponse.data?.reservations || [];
      setCompletedReservations(resData);
      
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

  const handleRetryVerification = async (transactionId: string) => {
    try {
      setVerifying(transactionId);
      await paymentService.reVerifyPayment(transactionId);
      // Reload data after verification
      await loadData();
      alert('Payment verification completed. Status updated.');
    } catch (error: any) {
      console.error('Retry verification error:', error);
      alert(error.response?.data?.error || 'Failed to verify payment. Please try again.');
    } finally {
      setVerifying(null);
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

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'payments'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Payment Records
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100">{payments.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'completed'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Completed Reservations
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100">{completedReservations.length}</span>
            </button>
          </nav>
        </div>

        {/* Completed Reservations Tab */}
        {activeTab === 'completed' && (
          <div className="space-y-4">
            {completedReservations.length === 0 ? (
              <Card>
                <div className="p-12 text-center">
                  <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No completed reservations</h3>
                  <p className="text-gray-600">Your completed charging sessions will appear here.</p>
                </div>
              </Card>
            ) : (
              completedReservations.map((reservation) => (
                <Card key={reservation._id}>
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-green-600" />
                          <h3 className="font-semibold text-lg text-gray-900">
                            {reservation.stationId?.name || 'Unknown Station'}
                          </h3>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {reservation.stationId?.address?.area}, {reservation.stationId?.address?.city}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(reservation.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {new Date(reservation.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {new Date(reservation.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Zap className="w-4 h-4 text-gray-400" />
                            {reservation.connectorId?.standard} ({reservation.connectorId?.type})
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          Vehicle: {reservation.vehicleId?.make} {reservation.vehicleId?.model} ({reservation.vehicleId?.licensePlate})
                        </p>
                      </div>
                      <div className="text-right">
                        {(reservation.totalCostBDT || reservation.estimatedCostBDT) && (
                          <p className="text-xl font-bold text-gray-900">
                            ৳{(reservation.totalCostBDT || reservation.estimatedCostBDT)?.toFixed(2)}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(reservation.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Transactions Table */}
        {activeTab === 'payments' && (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => handleViewReceipt(payment)}
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          View Receipt
                        </button>
                        {payment.status === PaymentStatus.PENDING && (
                          <>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => handleRetryVerification(payment.transactionId)}
                              disabled={verifying === payment.transactionId}
                              className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {verifying === payment.transactionId ? 'Verifying...' : 'Retry Verify'}
                            </button>
                          </>
                        )}
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
        )}
      </div>
    </div>
  );
};
