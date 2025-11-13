import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Clock, AlertCircle, CheckCircle, XCircle, QrCode, CreditCard, Timer } from 'lucide-react';
import reservationService from '../services/reservationService';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Alert } from '../components/UI/Alert';
import { Button } from '../components/UI';
import { Link } from 'react-router-dom';
import { config } from '../config';
import { PaymentIntegration } from '../components/Payment/PaymentIntegration';

interface Reservation {
  _id: string;
  stationId: {
    _id: string;
    name: string;
    address: {
      area: string;
      city: string;
    };
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
  qrCode?: string;
  verificationCode?: string;
  createdAt: string;
  totalCostBDT?: number;
  estimatedCostBDT?: number; // Alias for compatibility
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'expired';
  paymentDeadline?: string;
  isPaid?: boolean;
}

// Countdown Timer Component
const CountdownTimer: React.FC<{ deadline: string; onExpire: () => void }> = ({ deadline, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft('Expired');
        onExpire();
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setIsUrgent(minutes < 5);
      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  return (
    <div className={`flex items-center gap-2 ${isExpired ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-yellow-600'}`}>
      <Timer className="w-4 h-4" />
      <span className="font-mono font-semibold">{timeLeft}</span>
    </div>
  );
};

export const MyReservations: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [payingReservation, setPayingReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching reservations from:', config.apiBaseUrl);
      console.log('Access Token:', localStorage.getItem('accessToken') ? 'Present' : 'Missing');
      const response = await reservationService.getUserReservations();
      console.log('Reservations API Response:', response);
      console.log('Response success:', response.success);
      console.log('Response message:', response.message);
      console.log('Response data:', response.data);
      console.log('Response reservations:', (response as any).reservations);
      
      // Handle error response
      if (response.success === false && response.message) {
        setError(response.message);
        setReservations([]);
        return;
      }
      
      // Backend returns { reservations: [...], count: N } directly
      // Not wrapped in { success, data: { reservations } }
      const reservationsData = (response as any).reservations || response.data?.reservations || [];
      console.log('Extracted reservations:', reservationsData);
      setReservations(reservationsData);
    } catch (err) {
      console.error('Error fetching reservations:', err);
      setError('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;

    try {
      await reservationService.cancelReservation(reservationId);
      await fetchReservations();
    } catch (err: any) {
      console.error('Error canceling reservation:', err);
      alert(err.response?.data?.message || 'Failed to cancel reservation');
    }
  };

  const getStatusBadge = (status: string, paymentStatus?: string) => {
    const statusConfig: Record<string, { color: string; icon: JSX.Element; label: string }> = {
      PENDING: {
        color: 'bg-yellow-100 text-yellow-800',
        icon: <Clock className="w-4 h-4" />,
        label: paymentStatus === 'pending' ? 'Awaiting Payment' : 'Pending',
      },
      CONFIRMED: {
        color: 'bg-blue-100 text-blue-800',
        icon: <CheckCircle className="w-4 h-4" />,
        label: 'Confirmed',
      },
      CHECKED_IN: {
        color: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="w-4 h-4" />,
        label: 'Checked In',
      },
      COMPLETED: {
        color: 'bg-gray-100 text-gray-800',
        icon: <CheckCircle className="w-4 h-4" />,
        label: 'Completed',
      },
      CANCELED: {
        color: 'bg-red-100 text-red-800',
        icon: <XCircle className="w-4 h-4" />,
        label: 'Cancelled',
      },
      EXPIRED: {
        color: 'bg-orange-100 text-orange-800',
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Expired - Payment Not Completed',
      },
      NO_SHOW: {
        color: 'bg-yellow-100 text-yellow-800',
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'No Show',
      },
    };

    const config = statusConfig[status] || statusConfig.PENDING;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const filteredReservations = reservations.filter((reservation) => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') {
      return ['CONFIRMED', 'CHECKED_IN'].includes(reservation.status);
    }
    if (filter === 'completed') return reservation.status === 'COMPLETED';
    if (filter === 'cancelled') {
      return ['CANCELLED', 'NO_SHOW'].includes(reservation.status);
    }
    return true;
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
    };
  };

  const getDuration = (start: string, end: string) => {
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Reservations</h1>
        <p className="mt-2 text-gray-600">View and manage your charging reservations</p>
      </div>

      {error && (
        <div className="mb-6">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'All' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                filter === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100">
                {
                  reservations.filter((r) => {
                    if (tab.key === 'all') return true;
                    if (tab.key === 'upcoming') return ['CONFIRMED', 'CHECKED_IN'].includes(r.status);
                    if (tab.key === 'completed') return r.status === 'COMPLETED';
                    if (tab.key === 'cancelled') return ['CANCELLED', 'NO_SHOW'].includes(r.status);
                    return false;
                  }).length
                }
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Reservations List */}
      {filteredReservations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No {filter !== 'all' && filter} reservations
          </h3>
          <p className="text-gray-600 mb-6">
            {filter === 'all'
              ? "You haven't made any reservations yet"
              : `You don't have any ${filter} reservations`}
          </p>
          <Link to="/stations">
            <Button>Find Charging Stations</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReservations.map((reservation) => {
            const startDateTime = formatDateTime(reservation.startTime);
            const endDateTime = formatDateTime(reservation.endTime);
            const duration = getDuration(reservation.startTime, reservation.endTime);

            return (
              <div
                key={reservation._id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left Section */}
                  <div className="flex-1 space-y-3">
                    {/* Station Info */}
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">
                          {reservation.stationId?.name || 'Unknown Station'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {reservation.stationId?.address?.area}, {reservation.stationId?.address?.city}
                        </p>
                      </div>
                    </div>

                    {/* Time & Duration */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{startDateTime.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">
                          {startDateTime.time} - {endDateTime.time}
                        </span>
                      </div>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {duration}
                      </span>
                    </div>

                    {/* Vehicle & Connector */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Vehicle: </span>
                        <span className="font-medium text-gray-900">
                          {reservation.vehicleId && typeof reservation.vehicleId === 'object'
                            ? `${reservation.vehicleId.make} ${reservation.vehicleId.model}`
                            : 'Vehicle info unavailable'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Connector: </span>
                        <span className="font-medium text-gray-900">
                          {reservation.connectorId && typeof reservation.connectorId === 'object'
                            ? `${reservation.connectorId.standard} (${reservation.connectorId.type})`
                            : 'Connector info unavailable'}
                        </span>
                      </div>
                    </div>

                    {(reservation.totalCostBDT || reservation.estimatedCostBDT) && (
                      <div className="text-sm">
                        <span className="text-gray-600">Estimated Cost: </span>
                        <span className="font-semibold text-gray-900">
                          ৳{(reservation.totalCostBDT || reservation.estimatedCostBDT)?.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Payment Countdown for Pending Payments */}
                    {reservation.status === 'PENDING' && 
                     !reservation.isPaid && 
                     reservation.paymentDeadline && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-900">Complete payment to confirm your reservation</span>
                        </div>
                        <CountdownTimer 
                          deadline={reservation.paymentDeadline} 
                          onExpire={() => fetchReservations()}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Section */}
                  <div className="flex flex-col items-end gap-3">
                    {getStatusBadge(reservation.status, reservation.paymentStatus)}

                    <div className="flex gap-2 flex-wrap justify-end">
                      {/* Pay Now Button for Pending Payments - Show for all PENDING that aren't paid */}
                      {(reservation.status === 'PENDING' || reservation.status === 'pending') && !reservation.isPaid && (
                        <Button
                          onClick={() => setPayingReservation(reservation)}
                          className="text-sm flex items-center gap-2 bg-green-600 hover:bg-green-700 font-semibold shadow-lg animate-pulse hover:animate-none"
                        >
                          <CreditCard className="w-4 h-4" />
                          Pay Now ৳{(reservation.totalCostBDT || reservation.estimatedCostBDT || 0).toFixed(0)}
                        </Button>
                      )}

                      {/* View QR for Confirmed/Checked-In */}
                      {['CONFIRMED', 'CHECKED_IN', 'confirmed', 'checked_in'].includes(reservation.status) && (
                        <>
                          <Button
                            onClick={() => setSelectedReservation(reservation)}
                            className="text-sm flex items-center gap-2"
                          >
                            <QrCode className="w-4 h-4" />
                            View QR
                          </Button>
                          <Button
                            onClick={() => handleCancelReservation(reservation._id)}
                            className="text-sm bg-red-600 hover:bg-red-700"
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {/* Cancel for Pending Reservations */}
                      {(reservation.status === 'PENDING' || reservation.status === 'pending') && (
                        <Button
                          onClick={() => handleCancelReservation(reservation._id)}
                          className="text-sm bg-gray-500 hover:bg-gray-600"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Modal */}
      {payingReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Complete Payment</h2>
                <button
                  onClick={() => setPayingReservation(null)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close payment modal"
                  title="Close"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <PaymentIntegration
                reservationId={payingReservation._id}
                amount={payingReservation.totalCostBDT || payingReservation.estimatedCostBDT || 0}
                description={`Charging at ${payingReservation.stationId?.name || 'Station'}`}
                onPaymentSuccess={() => {
                  setPayingReservation(null);
                  fetchReservations();
                }}
                onPaymentCancel={() => setPayingReservation(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedReservation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedReservation(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reservation QR Code</h3>
            
            {selectedReservation.qrCode ? (
              <div className="text-center">
                <img
                  src={selectedReservation.qrCode}
                  alt="Reservation QR Code"
                  className="w-64 h-64 mx-auto mb-4"
                />
                {selectedReservation.verificationCode && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">Verification Code:</p>
                    <p className="text-2xl font-bold text-gray-900 tracking-wider">
                      {selectedReservation.verificationCode}
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  Show this QR code at the station to start your charging session
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">QR code not available</p>
              </div>
            )}

            <Button
              onClick={() => setSelectedReservation(null)}
              className="w-full mt-4"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyReservations;
