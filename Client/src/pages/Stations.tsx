import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StationMap } from '@/components/Map';
import { Station, stationService, StationSearchParams } from '@/services/stationService';
import { Button, Card, LoadingSpinner, Input } from '@/components/UI';
import { 
  Search, MapPin, Zap, Star, Grid, Map as MapIcon, 
  X, SlidersHorizontal
} from 'lucide-react';
import L from 'leaflet';

type ViewMode = 'map' | 'list' | 'grid';

export const Stations: React.FC = () => {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<StationSearchParams>({
    limit: 50,
    offset: 0,
  });

  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([23.8103, 90.4125]);
  const [mapZoom, setMapZoom] = useState(11);

  const fetchStations = useCallback(async () => {
    try {
      setLoading(true);
      const params: StationSearchParams = {
        ...filters,
        search: searchQuery || undefined,
      };

      const response = await stationService.getStations(params);
      if (response.success && response.data) {
        setStations(response.data.stations);
      }
    } catch (error) {
      console.error('Failed to fetch stations:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const handleMapMove = useCallback(
    (bounds: L.LatLngBounds, center: L.LatLng, zoom: number) => {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;

      setFilters((prev) => ({
        ...prev,
        bbox,
        lat: center.lat,
        lng: center.lng,
      }));
      setMapCenter([center.lat, center.lng]);
      setMapZoom(zoom);
    },
    []
  );

  const handleStationClick = (station: Station) => {
    setSelectedStation(station);
    navigate(`/stations/${station._id}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStations();
  };

  const handleFilterChange = (key: keyof StationSearchParams, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      limit: 50,
      offset: 0,
    });
    setSearchQuery('');
  };

  const hasActiveFilters = () => {
    return (
      searchQuery ||
      filters.connector_type ||
      filters.ac_min_kw ||
      filters.dc_min_kw ||
      filters.city ||
      filters.area ||
      (filters.amenities && filters.amenities.length > 0)
    );
  };

  const renderStationCard = (station: Station) => {
    const available = station.availableConnectors || 0;
    const total = station.totalConnectors || 0;

    return (
      <div
        key={station._id}
        className="cursor-pointer"
        onClick={() => handleStationClick(station)}
      >
        <Card className="hover:shadow-lg transition-shadow h-full">
          {station.photos && station.photos.length > 0 && (
            <img
              src={station.photos[0]}
              alt={station.name}
              className="w-full h-48 object-cover rounded-t-lg"
            />
          )}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{station.name}</h3>
            {station.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium">{station.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {station.address.area}, {station.address.city}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Zap
                className={`w-4 h-4 ${
                  available > 0 ? 'text-green-500' : 'text-red-500'
                }`}
              />
              <span className="text-gray-700">
                {available} / {total} connectors available
              </span>
            </div>
          </div>

          {station.amenities && station.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {station.amenities.slice(0, 3).map((amenity, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                >
                  {amenity}
                </span>
              ))}
              {station.amenities.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  +{station.amenities.length - 3}
                </span>
              )}
            </div>
          )}

          <Button variant="primary" className="w-full mt-4">
            View Details
          </Button>
        </div>
      </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Charging Stations</h1>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'map' ? 'primary' : 'outline'}
                onClick={() => setViewMode('map')}
                size="sm"
              >
                <MapIcon className="w-4 h-4 mr-2" />
                Map
              </Button>
              <Button
                variant={viewMode === 'list' ? 'primary' : 'outline'}
                onClick={() => setViewMode('list')}
                size="sm"
              >
                <Grid className="w-4 h-4 mr-2" />
                List
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'primary' : 'outline'}
                onClick={() => setViewMode('grid')}
                size="sm"
              >
                <Grid className="w-4 h-4 mr-2" />
                Grid
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search stations by name, city, or area..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </form>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters() && (
                <span className="ml-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  !
                </span>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Filters</h3>
                {hasActiveFilters() && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="city-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <select
                    id="city-filter"
                    value={filters.city || ''}
                    onChange={(e) => handleFilterChange('city', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Cities</option>
                    {stationService.getDivisions().map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="connector-type-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Connector Type
                  </label>
                  <select
                    id="connector-type-filter"
                    value={filters.connector_type || ''}
                    onChange={(e) =>
                      handleFilterChange('connector_type', e.target.value || undefined)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Types</option>
                    {stationService.getConnectorTypes().map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min AC Power (kW)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="350"
                    value={filters.ac_min_kw || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'ac_min_kw',
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    placeholder="e.g., 7"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min DC Power (kW)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="350"
                    value={filters.dc_min_kw || ''}
                    onChange={(e) =>
                      handleFilterChange(
                        'dc_min_kw',
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    placeholder="e.g., 50"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.open_now || false}
                    onChange={(e) => handleFilterChange('open_now', e.target.checked)}
                    className="rounded text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Open Now</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {viewMode === 'map' && (
              <div className="h-[calc(100vh-250px)] rounded-lg overflow-hidden shadow-lg">
                <StationMap
                  stations={stations}
                  center={mapCenter}
                  zoom={mapZoom}
                  onStationClick={handleStationClick}
                  selectedStation={selectedStation}
                  onMapMove={handleMapMove}
                />
              </div>
            )}

            {viewMode === 'list' && (
              <div className="space-y-4">
                {stations.length > 0 ? (
                  stations.map((station) => renderStationCard(station))
                ) : (
                  <div className="text-center py-20 text-gray-500">
                    No stations found. Try adjusting your filters.
                  </div>
                )}
              </div>
            )}

            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stations.length > 0 ? (
                  stations.map((station) => renderStationCard(station))
                ) : (
                  <div className="col-span-full text-center py-20 text-gray-500">
                    No stations found. Try adjusting your filters.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Stations;
