import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stationService } from '@/services/stationService';
import { Card, Button, LoadingSpinner } from '@/components/UI';
import { 
  Plus, MapPin, Zap, TrendingUp, DollarSign, 
  Activity, Edit, Trash2, BarChart3, Eye 
} from 'lucide-react';

interface StationStats {
  _id: string;
  name: string;
  address: {
    street: string;
    area: string;
    city: string;
    division: string;
    postalCode?: string;
  };
  isActive: boolean;
  amenities: string[];
  connectors: number;
  availableConnectors: number;
  totalSessions: number;
  activeSessions: number;
  totalRevenue: number;
}

export const OperatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stations, setStations] = useState<StationStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await stationService.getOperatorStations();
      
      if (response.success && response.data) {
        setStations(response.data.stations as any);
      } else {
        setError('Failed to load stations');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStation = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this station?')) {
      return;
    }

    try {
      await stationService.deleteStation(id);
      await fetchStations();
    } catch (err: any) {
      alert(err.message || 'Failed to delete station');
    }
  };

  const getTotalStats = () => {
    return stations.reduce(
      (acc, station) => ({
        totalStations: acc.totalStations + 1,
        totalConnectors: acc.totalConnectors + station.connectors,
        totalSessions: acc.totalSessions + station.totalSessions,
        totalRevenue: acc.totalRevenue + station.totalRevenue,
        activeStations: acc.activeStations + (station.isActive ? 1 : 0),
      }),
      {
        totalStations: 0,
        totalConnectors: 0,
        totalSessions: 0,
        totalRevenue: 0,
        activeStations: 0,
      }
    );
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Station Management</h1>
              <p className="text-gray-600 mt-1">
                Manage your charging stations and monitor performance
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate('/operator/stations/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Station
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Stations</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalStations}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  {stats.activeStations} active
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Connectors</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalConnectors}
                </p>
                <p className="text-sm text-gray-500 mt-1">Across all stations</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalSessions.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">All time</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ৳{stats.totalRevenue.toLocaleString()}
                </p>
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Lifetime earnings
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Stations List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Your Stations</h2>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {stations.length === 0 ? (
            <Card className="p-12 text-center">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No stations yet
              </h3>
              <p className="text-gray-600 mb-6">
                Get started by adding your first charging station
              </p>
              <Button
                variant="primary"
                onClick={() => navigate('/operator/stations/new')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Station
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {stations.map((station) => (
                <Card key={station._id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {station.name}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            station.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {station.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {station.address.area}, {station.address.city},{' '}
                          {station.address.division}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/stations/${station._id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/operator/stations/${station._id}/analytics`)}
                      >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Analytics
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/operator/stations/${station._id}/edit`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteStation(station._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Connectors</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {station.connectors}
                      </p>
                      <p className="text-sm text-green-600">
                        {station.availableConnectors} available
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">Active Sessions</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {station.activeSessions}
                      </p>
                      <p className="text-sm text-gray-500">Right now</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Sessions</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {station.totalSessions.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">All time</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ৳{station.totalRevenue.toLocaleString()}
                      </p>
                      <p className="text-sm text-green-600">Total earned</p>
                    </div>
                  </div>

                  {station.amenities && station.amenities.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-600 mb-2">Amenities:</p>
                      <div className="flex flex-wrap gap-2">
                        {station.amenities.map((amenity, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperatorDashboard;
