import { apiClient, ApiResponse } from './authService';
import { Reservation, ReservationStatus } from '@chargebd/shared';

export interface CreateReservationRequest {
  vehicleId: string;
  stationId: string;
  connectorId: string;
  startTime: Date | string;
  endTime: Date | string;
}

export interface CreateReservationResponse {
  reservation: Reservation;
  qrCodeDataURL: string;
  message: string;
}

export interface CheckAvailabilityRequest {
  stationId: string;
  connectorId: string;
  startTime: Date | string;
  endTime: Date | string;
}

export interface CheckAvailabilityResponse {
  available: boolean;
  connector: {
    id: string;
    type: string;
    maxKw: number;
    status: string;
  };
  conflictingReservations: Array<{
    startTime: Date;
    endTime: Date;
  }>;
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
}

export interface GetAvailableSlotsResponse {
  slots: TimeSlot[];
}

export interface GetReservationsResponse {
  reservations: Reservation[];
  count: number;
}

export interface GetReservationByIdResponse {
  reservation: Reservation;
  connector?: any;
  qrCodeDataURL?: string;
}

const reservationService = {
  /**
   * Check availability for a specific time slot
   */
  async checkAvailability(
    data: CheckAvailabilityRequest
  ): Promise<ApiResponse<CheckAvailabilityResponse>> {
    return apiClient['request']<CheckAvailabilityResponse>(
      '/reservations/check-availability',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Get available time slots for a connector on a specific date
   */
  async getAvailableSlots(
    stationId: string,
    connectorId: string,
    date: Date | string
  ): Promise<ApiResponse<GetAvailableSlotsResponse>> {
    const dateStr = date instanceof Date ? date.toISOString() : date;
    return apiClient['request']<GetAvailableSlotsResponse>(
      `/reservations/available-slots?stationId=${stationId}&connectorId=${connectorId}&date=${dateStr}`,
      { method: 'GET' }
    );
  },

  /**
   * Create a new reservation
   */
  async createReservation(
    data: CreateReservationRequest
  ): Promise<ApiResponse<CreateReservationResponse>> {
    return apiClient['request']<CreateReservationResponse>(
      '/reservations',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Get all reservations for the authenticated user
   */
  async getUserReservations(
    status?: ReservationStatus,
    upcoming?: boolean
  ): Promise<ApiResponse<GetReservationsResponse>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (upcoming) params.append('upcoming', 'true');
    
    return apiClient['request']<GetReservationsResponse>(
      `/reservations?${params.toString()}`,
      { method: 'GET' }
    );
  },

  /**
   * Get a specific reservation by ID
   */
  async getReservationById(
    id: string
  ): Promise<ApiResponse<GetReservationByIdResponse>> {
    return apiClient['request']<GetReservationByIdResponse>(
      `/reservations/${id}`,
      { method: 'GET' }
    );
  },

  /**
   * Update a reservation status
   */
  async updateReservation(
    id: string,
    status: ReservationStatus
  ): Promise<ApiResponse<{ reservation: Reservation; message: string }>> {
    return apiClient['request']<{ reservation: Reservation; message: string }>(
      `/reservations/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    );
  },

  /**
   * Cancel a reservation
   */
  async cancelReservation(
    id: string
  ): Promise<ApiResponse<{ reservation: Reservation; message: string }>> {
    return apiClient['request']<{ reservation: Reservation; message: string }>(
      `/reservations/${id}`,
      { method: 'DELETE' }
    );
  },

  /**
   * Get reservations for a specific station (operators only)
   */
  async getStationReservations(
    stationId: string,
    status?: ReservationStatus,
    date?: Date | string
  ): Promise<ApiResponse<GetReservationsResponse>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (date) {
      const dateStr = date instanceof Date ? date.toISOString() : date;
      params.append('date', dateStr);
    }
    
    return apiClient['request']<GetReservationsResponse>(
      `/reservations/station/${stationId}?${params.toString()}`,
      { method: 'GET' }
    );
  },
};

export default reservationService;
