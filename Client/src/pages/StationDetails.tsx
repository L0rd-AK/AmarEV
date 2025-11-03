import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { 
  MapPin, Star, Phone, 
  ChevronLeft, Navigation, Wifi, Coffee, ShoppingCart,
  Info, Check, X, AlertCircle
} from 'lucide-react';
import { Station, Connector, stationService } from '@/services/stationService';
import { Button, Card, LoadingSpinner, Alert } from '@/components/UI';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const amenityIcons: Record<string, React.ReactNode> = {
  'WiFi': <Wifi className="w-4 h-4" />,
  'Cafe': <Coffee className="w-4 h-4" />,
  'Restaurant': <Coffee className="w-4 h-4" />,
  'Shopping': <ShoppingCart className="w-4 h-4" />,
};

const getStatusColor = (status: Connector['status']) => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'occupied':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'offline':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'maintenance':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: Connector['status']) => {
  switch (status) {
    case 'available':
      return <Check className="w-4 h-4" />;
    case 'occupied':
      return <X className="w-4 h-4" />;
    case 'offline':
      return <AlertCircle className="w-4 h-4" />;
    case 'maintenance':
      return <Info className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
};

export const StationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    const fetchStation = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const response = await stationService.getStationById(id);
        
        if (response.success && response.data) {
          setStation(response.data.station);
        } else {
          setError('Failed to load station details');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load station details');
      } finally {
        setLoading(false);
      }
    };

    fetchStation();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !station) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert type="error" title="Error" message={error || 'Station not found'} />
        <Button onClick={() => navigate('/stations')} className="mt-4">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Stations
        </Button>
      </div>
    );
  }

  const [lng, lat] = station.location.coordinates;
  const isOpen = station.isActive && station.isPublic;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="outline"
            onClick={() => navigate('/stations')}
            className="mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Stations
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{station.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">
                    {station.address.area}, {station.address.city}
                  </span>
                </div>
                {station.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-medium">{station.rating.toFixed(1)}</span>
                    <span className="text-sm text-gray-500">
                      ({station.totalReviews} reviews)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isOpen
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {isOpen ? 'Open' : 'Closed'}
              </span>
              <span className="text-sm text-gray-600">
                {station.availableConnectors} / {station.totalConnectors} available
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Images */}
            {station.photos && station.photos.length > 0 && (
              <Card>
                <div className="relative">
                  <img
                    src={station.photos[selectedImage]}
                    alt={station.name}
                    className="w-full h-96 object-cover rounded-t-lg"
                  />
                  <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto">
                    {station.photos.map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                          selectedImage === idx
                            ? 'border-green-500'
                            : 'border-white'
                        }`}
                      >
                        <img
                          src={photo}
                          alt={`${station.name} ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Connectors */}
            <Card>
              <h2 className="text-xl font-semibold mb-4">Available Connectors</h2>
              <div className="space-y-4">
                {station.connectors && station.connectors.length > 0 ? (
                  station.connectors.map((connector) => (
                    <div
                      key={connector._id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {connector.type} - {connector.standard}
                          </h3>
                          <p className="text-gray-600 text-sm">
                            {connector.maxKw} kW Max Power
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1 ${getStatusColor(
                            connector.status
                          )}`}
                        >
                          {getStatusIcon(connector.status)}
                          {connector.status.charAt(0).toUpperCase() +
                            connector.status.slice(1)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Per kWh:</span>
                          <p className="font-semibold">৳{connector.pricePerKWhBDT}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Per Minute:</span>
                          <p className="font-semibold">৳{connector.pricePerMinuteBDT}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Session Fee:</span>
                          <p className="font-semibold">৳{connector.sessionFeeBDT}</p>
                        </div>
                      </div>

                      {connector.status === 'available' && (
                        <Button className="w-full mt-4" variant="primary">
                          Reserve This Connector
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600">No connectors available</p>
                )}
              </div>
            </Card>

            {/* Reviews */}
            {station.reviews && station.reviews.length > 0 && (
              <Card>
                <h2 className="text-xl font-semibold mb-4">Recent Reviews</h2>
                <div className="space-y-4">
                  {station.reviews.map((review) => (
                    <div key={review._id} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-700 font-semibold">
                              {typeof review.userId === 'object'
                                ? review.userId.displayName.charAt(0)
                                : 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold">
                              {typeof review.userId === 'object'
                                ? review.userId.displayName
                                : 'User'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-4 h-4 ${
                                idx < review.rating
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-gray-700">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Map */}
            <Card>
              <h2 className="text-lg font-semibold mb-4">Location</h2>
              <div className="h-64 rounded-lg overflow-hidden mb-4">
                <MapContainer
                  center={[lat, lng]}
                  zoom={15}
                  style={{ width: '100%', height: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[lat, lng]} />
                </MapContainer>
              </div>
              <div className="text-sm text-gray-700">
                <p className="font-medium">{station.address.street}</p>
                <p>
                  {station.address.area}, {station.address.city}
                </p>
                <p>{station.address.division}</p>
                {station.address.postalCode && <p>{station.address.postalCode}</p>}
              </div>
              <Button variant="outline" className="w-full mt-4">
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
            </Card>

            {/* Amenities */}
            {station.amenities && station.amenities.length > 0 && (
              <Card>
                <h2 className="text-lg font-semibold mb-4">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {station.amenities.map((amenity, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-center gap-2"
                    >
                      {amenityIcons[amenity] || <Info className="w-4 h-4" />}
                      {amenity}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Opening Hours */}
            {station.openingHours && (
              <Card>
                <h2 className="text-lg font-semibold mb-4">Opening Hours</h2>
                <div className="space-y-2 text-sm">
                  {Object.entries(station.openingHours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between">
                      <span className="capitalize font-medium text-gray-700">
                        {day}
                      </span>
                      <span className="text-gray-600">
                        {hours
                          ? `${hours.open} - ${hours.close}`
                          : 'Closed'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Contact */}
            <Card>
              <h2 className="text-lg font-semibold mb-4">Contact</h2>
              <div className="space-y-3">
                {typeof station.operatorId === 'object' && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Info className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">
                        {station.operatorId.displayName}
                      </span>
                    </div>
                    {station.operatorId.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {station.operatorId.email}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StationDetails;
