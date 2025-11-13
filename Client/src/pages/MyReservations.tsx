import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Clock, AlertCircle, CheckCircle, XCircle, QrCode } from 'lucide-react';
import reservationService from '../services/reservationService';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Alert } from '../components/UI/Alert';
import { Button } from '../components/UI';
import { Link } from 'react-router-dom';

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
  estimatedCostBDT?: number;
}

export const MyReservations: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await reservationService.getUserReservations();
      setReservations(response.data?.reservations as any || []);
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: JSX.Element; label: string }> = {
      CONFIRMED: {
        color: 'bg-blue-100 text-blue-800',
        icon: <Clock className="w-4 h-4" />,
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
      CANCELLED: {
        color: 'bg-red-100 text-red-800',
        icon: <XCircle className="w-4 h-4" />,
        label: 'Cancelled',
      },
      NO_SHOW: {
        color: 'bg-yellow-100 text-yellow-800',
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'No Show',
      },
    };

    const config = statusConfig[status] || statusConfig.CONFIRMED;

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
                          {reservation.vehicleId?.make} {reservation.vehicleId?.model}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Connector: </span>
                        <span className="font-medium text-gray-900">
                          {reservation.connectorId?.standard} ({reservation.connectorId?.type})
                        </span>
                      </div>
                    </div>

                    {reservation.estimatedCostBDT && (
                      <div className="text-sm">
                        <span className="text-gray-600">Estimated Cost: </span>
                        <span className="font-semibold text-gray-900">
                          ৳{reservation.estimatedCostBDT.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Section */}
                  <div className="flex flex-col items-end gap-3">
                    {getStatusBadge(reservation.status)}

                    <div className="flex gap-2">
                      {['CONFIRMED', 'CHECKED_IN'].includes(reservation.status) && (
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
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
