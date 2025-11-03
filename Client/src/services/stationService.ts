import { apiClient } from './authService';

export interface Location {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Station {
  _id: string;
  name: string;
  operatorId: string | { displayName: string; email: string };
  location: Location;
  address: {
    street: string;
    area: string;
    city: string;
    division: string;
    postalCode?: string;
  };
  amenities: string[];
  photos: string[];
  timezone: string;
  isPublic: boolean;
  isActive: boolean;
  openingHours?: {
    [key: string]: { open: string; close: string } | null;
  };
  connectors?: Connector[];
  availableConnectors?: number;
  totalConnectors?: number;
  rating?: number;
  totalReviews?: number;
  reviews?: Review[];
  createdAt: string;
  updatedAt: string;
}

export interface Connector {
  _id: string;
  stationId: string;
  type: 'AC' | 'DC';
  standard: 'Type2' | 'CCS2' | 'CHAdeMO';
  maxKw: number;
  pricePerKWhBDT: number;
  pricePerMinuteBDT: number;
  sessionFeeBDT: number;
  status: 'available' | 'occupied' | 'offline' | 'maintenance';
  lastMaintenanceDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  _id: string;
  userId: string | { displayName: string };
  stationId: string;
  rating: number;
  comment?: string;
  photos: string[];
  flagged: boolean;
  flaggedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StationSearchParams {
  bbox?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  ac_min_kw?: number;
  dc_min_kw?: number;
  connector_type?: string;
  open_now?: boolean;
  amenities?: string[];
  limit?: number;
  offset?: number;
  city?: string;
  area?: string;
  search?: string;
}

export interface StationsResponse {
  stations: Station[];
  total: number;
  offset: number;
  limit: number;
}

export interface StationAnalytics {
  overview: {
    totalSessions: number;
    completedSessions: number;
    totalRevenue: number;
    totalEnergy: number;
    avgSessionCost: number;
    avgEnergyDelivered: number;
  };
  connectorStats: Array<{
    connectorId: string;
    type: string;
    standard: string;
    status: string;
    sessionsCount: number;
    totalEnergy: number;
  }>;
  timeSeries: Array<{
    _id: any;
    sessions: number;
    revenue: number;
    energy: number;
  }>;
}

export interface CreateStationRequest {
  name: string;
  location: Location;
  address: {
    street: string;
    area: string;
    city: string;
    division: string;
    postalCode?: string;
  };
  amenities?: string[];
  photos?: string[];
  timezone?: string;
  isPublic?: boolean;
  openingHours?: {
    [key: string]: { open: string; close: string } | null;
  };
}

export interface CreateConnectorRequest {
  type: 'AC' | 'DC';
  standard: 'Type2' | 'CCS2' | 'CHAdeMO';
  maxKw: number;
  pricePerKWhBDT: number;
  pricePerMinuteBDT: number;
  sessionFeeBDT?: number;
  status?: 'available' | 'occupied' | 'offline' | 'maintenance';
}

class StationService {
  /**
   * Get all stations with optional filters
   */
  async getStations(params?: StationSearchParams) {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()));
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });
    }

    return apiClient['request']<StationsResponse>(
      `/stations?${queryParams.toString()}`,
      { method: 'GET' }
    );
  }

  /**
   * Get station by ID
   */
  async getStationById(id: string) {
    return apiClient['request']<{ station: Station }>(
      `/stations/${id}`,
      { method: 'GET' }
    );
  }

  /**
   * Search nearby stations
   */
  async searchNearby(lat: number, lng: number, radius: number = 5000, limit: number = 20) {
    return apiClient['request']<StationsResponse>(
      `/stations/search/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`,
      { method: 'GET' }
    );
  }

  /**
   * Create new station (Operator/Admin only)
   */
  async createStation(data: CreateStationRequest) {
    return apiClient['request']<{ station: Station }>(
      '/stations',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Update station (Operator/Admin only)
   */
  async updateStation(id: string, data: Partial<CreateStationRequest>) {
    return apiClient['request']<{ station: Station }>(
      `/stations/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete station (Operator/Admin only)
   */
  async deleteStation(id: string) {
    return apiClient['request'](
      `/stations/${id}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Get operator's stations
   */
  async getOperatorStations() {
    return apiClient['request']<{ stations: Station[] }>(
      '/stations/operator/my-stations',
      { method: 'GET' }
    );
  }

  /**
   * Get station analytics
   */
  async getStationAnalytics(
    id: string,
    startDate?: string,
    endDate?: string,
    period: 'hour' | 'day' | 'month' = 'day'
  ) {
    const queryParams = new URLSearchParams({ period });
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    return apiClient['request']<StationAnalytics>(
      `/stations/${id}/analytics?${queryParams.toString()}`,
      { method: 'GET' }
    );
  }

  /**
   * Add connector to station
   */
  async addConnector(stationId: string, data: CreateConnectorRequest) {
    return apiClient['request']<{ connector: Connector }>(
      `/stations/${stationId}/connectors`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Update connector
   */
  async updateConnector(
    stationId: string,
    connectorId: string,
    data: Partial<CreateConnectorRequest>
  ) {
    return apiClient['request']<{ connector: Connector }>(
      `/stations/${stationId}/connectors/${connectorId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Get available amenities list
   */
  getAmenitiesList() {
    return [
      'WiFi',
      'Restrooms',
      'Cafe',
      'Restaurant',
      'Shopping',
      'ATM',
      'Parking',
      'Wheelchair Accessible',
      'EV Lounge',
      '24/7 Access',
      'Security',
      'Waiting Area',
      'Vending Machine',
      'Air Conditioning',
    ];
  }

  /**
   * Get connector types
   */
  getConnectorTypes() {
    return ['Type2', 'CCS2', 'CHAdeMO'];
  }

  /**
   * Get divisions (Bangladesh)
   */
  getDivisions() {
    return [
      'Dhaka',
      'Chattogram',
      'Rajshahi',
      'Khulna',
      'Barishal',
      'Sylhet',
      'Rangpur',
      'Mymensingh',
    ];
  }
}

export const stationService = new StationService();
export default stationService;
