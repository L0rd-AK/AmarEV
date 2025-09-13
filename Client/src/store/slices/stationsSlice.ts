import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Station {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  connectors: Connector[];
  amenities: string[];
  operatorId: string;
  status: 'active' | 'inactive' | 'maintenance';
  isPublic: boolean;
  rating: number;
  totalReviews: number;
  photos: string[];
}

export interface Connector {
  id: string;
  type: string;
  standard: string;
  powerRating: number;
  status: 'available' | 'occupied' | 'out_of_order' | 'maintenance';
  currentPrice: number;
}

interface StationsState {
  stations: Station[];
  filteredStations: Station[];
  selectedStation: Station | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    connectorTypes: string[];
    powerRating: number[];
    amenities: string[];
    radius: number;
    availableOnly: boolean;
  };
  searchQuery: string;
  mapCenter: {
    latitude: number;
    longitude: number;
  };
  mapZoom: number;
}

const initialState: StationsState = {
  stations: [],
  filteredStations: [],
  selectedStation: null,
  isLoading: false,
  error: null,
  filters: {
    connectorTypes: [],
    powerRating: [0, 350],
    amenities: [],
    radius: 25,
    availableOnly: false,
  },
  searchQuery: '',
  mapCenter: {
    latitude: 23.8103, // Dhaka, Bangladesh
    longitude: 90.4125,
  },
  mapZoom: 11,
};

export const stationsSlice = createSlice({
  name: 'stations',
  initialState,
  reducers: {
    setStations: (state, action: PayloadAction<Station[]>) => {
      state.stations = action.payload;
      state.filteredStations = action.payload;
    },
    setSelectedStation: (state, action: PayloadAction<Station | null>) => {
      state.selectedStation = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<typeof initialState.filters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setMapCenter: (state, action: PayloadAction<{ latitude: number; longitude: number }>) => {
      state.mapCenter = action.payload;
    },
    setMapZoom: (state, action: PayloadAction<number>) => {
      state.mapZoom = action.payload;
    },
    updateStationStatus: (state, action: PayloadAction<{ stationId: string; status: Station['status'] }>) => {
      const station = state.stations.find(s => s.id === action.payload.stationId);
      if (station) {
        station.status = action.payload.status;
      }
    },
    updateConnectorStatus: (state, action: PayloadAction<{ stationId: string; connectorId: string; status: Connector['status'] }>) => {
      const station = state.stations.find(s => s.id === action.payload.stationId);
      if (station) {
        const connector = station.connectors.find(c => c.id === action.payload.connectorId);
        if (connector) {
          connector.status = action.payload.status;
        }
      }
    },
  },
});