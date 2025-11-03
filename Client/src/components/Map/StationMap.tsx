import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Station } from '@/services/stationService';
import { MapPin, Zap, Star } from 'lucide-react';

// Fix for default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for different station states
const createCustomIcon = (availableCount: number, totalCount: number) => {
  const color = availableCount > 0 ? '#10b981' : totalCount > 0 ? '#f59e0b' : '#ef4444';
  const svgIcon = `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 26 16 26s16-17.163 16-26C32 7.163 24.837 0 16 0z" fill="${color}"/>
      <circle cx="16" cy="16" r="10" fill="white"/>
      <text x="16" y="21" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}">${availableCount}</text>
    </svg>
  `;
  
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  });
};

interface StationMapProps {
  stations: Station[];
  center?: [number, number];
  zoom?: number;
  onStationClick?: (station: Station) => void;
  selectedStation?: Station | null;
  showClustering?: boolean;
  onMapMove?: (bounds: L.LatLngBounds, center: L.LatLng, zoom: number) => void;
}

// Component to handle map events
const MapEventsHandler: React.FC<{
  onMapMove?: (bounds: L.LatLngBounds, center: L.LatLng, zoom: number) => void;
}> = ({ onMapMove }) => {
  const map = useMapEvents({
    moveend: () => {
      if (onMapMove) {
        const bounds = map.getBounds();
        const center = map.getCenter();
        const zoom = map.getZoom();
        onMapMove(bounds, center, zoom);
      }
    },
    zoomend: () => {
      if (onMapMove) {
        const bounds = map.getBounds();
        const center = map.getCenter();
        const zoom = map.getZoom();
        onMapMove(bounds, center, zoom);
      }
    },
  });

  return null;
};

// Component to update map center
const MapCenterController: React.FC<{ center: [number, number]; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
};

export const StationMap: React.FC<StationMapProps> = ({
  stations,
  center = [23.8103, 90.4125], // Dhaka, Bangladesh
  zoom = 11,
  onStationClick,
  selectedStation,
  showClustering = true,
  onMapMove,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>(center);
  const [mapZoom, setMapZoom] = useState(zoom);

  useEffect(() => {
    setMapCenter(center);
    setMapZoom(zoom);
  }, [center, zoom]);

  useEffect(() => {
    if (selectedStation && selectedStation.location) {
      const [lng, lat] = selectedStation.location.coordinates;
      setMapCenter([lat, lng]);
      setMapZoom(15);
    }
  }, [selectedStation]);

  const renderMarkers = () => {
    return stations.map((station) => {
      if (!station.location || !station.location.coordinates) return null;

      const [lng, lat] = station.location.coordinates;
      const available = station.availableConnectors || 0;
      const total = station.totalConnectors || 0;
      const icon = createCustomIcon(available, total);

      return (
        <Marker
          key={station._id}
          position={[lat, lng]}
          icon={icon}
          eventHandlers={{
            click: () => {
              if (onStationClick) {
                onStationClick(station);
              }
            },
          }}
        >
          <Popup>
            <div className="min-w-[250px]">
              <h3 className="font-semibold text-lg mb-2">{station.name}</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-700">
                    {station.address.street}, {station.address.area}, {station.address.city}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">
                    {available} / {total} connectors available
                  </span>
                </div>

                {station.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-gray-700">
                      {station.rating.toFixed(1)} ({station.totalReviews} reviews)
                    </span>
                  </div>
                )}

                {station.amenities && station.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
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
                        +{station.amenities.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => onStationClick && onStationClick(station)}
                className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                View Details
              </button>
            </div>
          </Popup>
        </Marker>
      );
    });
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: '100%', height: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCenterController center={mapCenter} zoom={mapZoom} />
        <MapEventsHandler onMapMove={onMapMove} />

        {showClustering ? (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
          >
            {renderMarkers()}
          </MarkerClusterGroup>
        ) : (
          renderMarkers()
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
        <h4 className="text-sm font-semibold mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <span>Busy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span>Offline</span>
          </div>
        </div>
      </div>

      {/* Station count */}
      <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
        <span className="text-sm font-medium">
          {stations.length} station{stations.length !== 1 ? 's' : ''} found
        </span>
      </div>
    </div>
  );
};

export default StationMap;
