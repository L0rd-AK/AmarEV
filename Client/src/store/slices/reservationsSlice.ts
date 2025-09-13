import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Reservation {
  id: string;
  userId: string;
  stationId: string;
  connectorId: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  totalCost: number;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  qrCode?: string;
  verificationCode?: string;
  createdAt: string;
  updatedAt: string;
}

interface ReservationsState {
  reservations: Reservation[];
  activeReservation: Reservation | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ReservationsState = {
  reservations: [],
  activeReservation: null,
  isLoading: false,
  error: null,
};

export const reservationsSlice = createSlice({
  name: 'reservations',
  initialState,
  reducers: {
    setReservations: (state, action: PayloadAction<Reservation[]>) => {
      state.reservations = action.payload;
    },
    addReservation: (state, action: PayloadAction<Reservation>) => {
      state.reservations.unshift(action.payload);
    },
    updateReservation: (state, action: PayloadAction<{ id: string; updates: Partial<Reservation> }>) => {
      const reservation = state.reservations.find(r => r.id === action.payload.id);
      if (reservation) {
        Object.assign(reservation, action.payload.updates);
      }
    },
    setActiveReservation: (state, action: PayloadAction<Reservation | null>) => {
      state.activeReservation = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});