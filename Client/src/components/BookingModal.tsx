import React, { useState, useEffect } from 'react';
import { Button } from '../components/UI';
import reservationService from '../services/reservationService';
import vehicleService from '../services/vehicleService';

interface Connector {
  _id: string;
  type: 'AC' | 'DC';
  standard: string;
  maxKw: number;
  pricePerKWhBDT: number;
  pricePerMinuteBDT: number;
  sessionFeeBDT: number;
  status: string;
}

interface Vehicle {
  _id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  connectorType: string[];
  usableKWh: number;
  isDefault: boolean;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  stationId: string;
  stationName: string;
  connector: Connector;
  onSuccess?: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  stationId,
  stationName,
  connector,
  onSuccess,
}) => {
  const [step, setStep] = useState<'vehicle' | 'time' | 'confirm'>('vehicle');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  // Load user vehicles
  useEffect(() => {
    if (isOpen) {
      loadVehicles();
    }
  }, [isOpen]);

  const loadVehicles = async () => {
    try {
      // Fetch vehicles from API
      const userVehicles = await vehicleService.getUserVehicles();
      setVehicles(userVehicles);
      
      // Auto-select default vehicle or first compatible one
      const defaultVehicle = userVehicles.find(v => v.isDefault);
      const compatibleVehicle = userVehicles.find(v => 
        v.connectorType.includes(connector.standard)
      );
      
      if (compatibleVehicle) {
        setSelectedVehicle(compatibleVehicle._id);
      } else if (defaultVehicle) {
        setSelectedVehicle(defaultVehicle._id);
      } else if (userVehicles.length > 0) {
        setSelectedVehicle(userVehicles[0]._id);
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err);
      setError('Failed to load your vehicles');
    }
  };

  const calculateEstimatedCost = () => {
    if (!startTime || !endTime) return;

    const start = new Date(`${selectedDate}T${startTime}`);
    const end = new Date(`${selectedDate}T${endTime}`);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    if (durationHours <= 0) return;

    const vehicle = vehicles.find(v => v._id === selectedVehicle);
    if (!vehicle) return;

    const estimatedKWh = Math.min(vehicle.usableKWh, durationHours * connector.maxKw);
    const energyCost = estimatedKWh * connector.pricePerKWhBDT;
    const timeCost = (durationHours * 60) * connector.pricePerMinuteBDT;
    const total = energyCost + timeCost + connector.sessionFeeBDT;

    setEstimatedCost(Math.round(total));
  };

  useEffect(() => {
    calculateEstimatedCost();
  }, [startTime, endTime, selectedVehicle, selectedDate]);

  const handleNext = () => {
    if (step === 'vehicle') {
      if (!selectedVehicle) {
        setError('Please select a vehicle');
        return;
      }
      
      // Check compatibility
      const vehicle = vehicles.find(v => v._id === selectedVehicle);
      if (vehicle && !vehicle.connectorType.includes(connector.standard)) {
        setError(`Your vehicle is not compatible with ${connector.standard} connector`);
        return;
      }
      
      setError('');
      setStep('time');
    } else if (step === 'time') {
      if (!selectedDate || !startTime || !endTime) {
        setError('Please select date and time');
        return;
      }

      const start = new Date(`${selectedDate}T${startTime}`);
      const end = new Date(`${selectedDate}T${endTime}`);

      if (end <= start) {
        setError('End time must be after start time');
        return;
      }

      if (start < new Date()) {
        setError('Cannot book in the past');
        return;
      }

      setError('');
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'time') setStep('vehicle');
    else if (step === 'confirm') setStep('time');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    // Check if user is authenticated
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    console.log('Authentication check:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      accessToken: accessToken?.substring(0, 20) + '...',
    });

    if (!accessToken || !refreshToken) {
      setError('Please login to create a reservation');
      setLoading(false);
      return;
    }

    try {
      const startDateTime = new Date(`${selectedDate}T${startTime}`);
      const endDateTime = new Date(`${selectedDate}T${endTime}`);

      const response = await reservationService.createReservation({
        vehicleId: selectedVehicle,
        stationId,
        connectorId: connector._id,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });

      if (response.success && response.data) {
        alert('Booking successful! Check your reservations for the QR code.');
        onSuccess?.();
        onClose();
      } else {
        setError(response.message || 'Failed to create booking');
      }
    } catch (err: any) {
      console.error('Booking error:', err);
      // Handle different error response structures
      const errorMessage = 
        err.response?.data?.error?.message || 
        err.response?.data?.error || 
        err.response?.data?.message ||
        err.message ||
        'Failed to create booking';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedVehicleData = vehicles.find(v => v._id === selectedVehicle);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Book Charging Session</h2>
              <p className="text-gray-600 mt-1">{stationName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center mt-6 gap-2">
            <div className={`flex-1 h-2 rounded ${step === 'vehicle' ? 'bg-green-600' : step === 'time' || step === 'confirm' ? 'bg-green-600' : 'bg-gray-200'}`} />
            <div className={`flex-1 h-2 rounded ${step === 'time' ? 'bg-green-600' : step === 'confirm' ? 'bg-green-600' : 'bg-gray-200'}`} />
            <div className={`flex-1 h-2 rounded ${step === 'confirm' ? 'bg-green-600' : 'bg-gray-200'}`} />
          </div>
          <div className="flex items-center justify-between mt-2 text-sm">
            <span className={step === 'vehicle' ? 'text-green-600 font-semibold' : 'text-gray-500'}>Vehicle</span>
            <span className={step === 'time' ? 'text-green-600 font-semibold' : 'text-gray-500'}>Time</span>
            <span className={step === 'confirm' ? 'text-green-600 font-semibold' : 'text-gray-500'}>Confirm</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Connector Info */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-2">Connector Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Type:</span>
                <p className="font-semibold">{connector.type} - {connector.standard}</p>
              </div>
              <div>
                <span className="text-gray-600">Max Power:</span>
                <p className="font-semibold">{connector.maxKw} kW</p>
              </div>
              <div>
                <span className="text-gray-600">Per kWh:</span>
                <p className="font-semibold">৳{connector.pricePerKWhBDT}</p>
              </div>
              <div>
                <span className="text-gray-600">Per Minute:</span>
                <p className="font-semibold">৳{connector.pricePerMinuteBDT}</p>
              </div>
            </div>
          </div>

          {/* Step: Select Vehicle */}
          {step === 'vehicle' && (
            <div>
              <h3 className="font-semibold mb-4">Select Your Vehicle</h3>
              {vehicles.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No vehicles found</p>
                  <Button variant="primary" onClick={() => {/* Navigate to add vehicle */}}>
                    Add a Vehicle
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicles.map((vehicle) => {
                    const isCompatible = vehicle.connectorType.includes(connector.standard);
                    return (
                      <div
                        key={vehicle._id}
                        onClick={() => isCompatible && setSelectedVehicle(vehicle._id)}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedVehicle === vehicle._id
                            ? 'border-green-600 bg-green-50'
                            : isCompatible
                            ? 'border-gray-200 hover:border-green-300'
                            : 'border-gray-200 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {vehicle.make} {vehicle.model} ({vehicle.year})
                            </p>
                            <p className="text-sm text-gray-600">{vehicle.licensePlate}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Connectors: {vehicle.connectorType.join(', ')}
                            </p>
                          </div>
                          {isCompatible ? (
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedVehicle === vehicle._id ? 'border-green-600 bg-green-600' : 'border-gray-300'
                            }`}>
                              {selectedVehicle === vehicle._id && (
                                <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                  <path d="M5 13l4 4L19 7"></path>
                                </svg>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-red-600">Not Compatible</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step: Select Time */}
          {step === 'time' && (
            <div>
              <h3 className="font-semibold mb-4">Select Date & Time</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    placeholder="Select date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="--:--"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      placeholder="--:--"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {estimatedCost > 0 && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Estimated Cost:</span>
                      <span className="text-2xl font-bold text-green-700">৳{estimatedCost}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      * Actual cost may vary based on actual energy consumed
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && selectedVehicleData && (
            <div>
              <h3 className="font-semibold mb-4">Confirm Your Booking</h3>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">Booking Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vehicle:</span>
                      <span className="font-semibold">
                        {selectedVehicleData.make} {selectedVehicleData.model}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-semibold">
                        {new Date(selectedDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time:</span>
                      <span className="font-semibold">
                        {startTime} - {endTime}
                      </span>
                    </div>
                    <div className="flex justify-between pt-3 border-t">
                      <span className="text-gray-600">Estimated Cost:</span>
                      <span className="text-lg font-bold text-green-700">৳{estimatedCost}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Important:</strong> You can cancel this booking up to 1 hour before the start time.
                    A QR code will be generated for station access.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex items-center justify-between bg-gray-50">
          <Button
            variant="secondary"
            onClick={step === 'vehicle' ? onClose : handleBack}
            disabled={loading}
          >
            {step === 'vehicle' ? 'Cancel' : 'Back'}
          </Button>

          <Button
            variant="primary"
            onClick={step === 'confirm' ? handleConfirm : handleNext}
            disabled={loading || (step === 'vehicle' && !selectedVehicle)}
          >
            {loading ? 'Processing...' : step === 'confirm' ? 'Confirm Booking' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};
