import axios from 'axios';
import { config } from '../config';

const API_URL = `${config.apiBaseUrl}/sessions/charging`;

function getAuthHeader() {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export interface ChargingTelemetry {
  sessionId: string;
  reservationId: string;
  userId: string;
  stationName: string;
  connectorType: string;
  userName: string;
  voltage: number;
  current: number;
  power: number;
  energyKWh: number;
  temperature: number;
  connectorStatus: string;
  startedAt: string;
  lastUpdated: string;
  elapsedSeconds: number;
}

export interface ChargingStatus {
  isCharging: boolean;
  sessionId?: string;
  voltage?: number;
  current?: number;
  power?: number;
  energyKWh?: number;
  temperature?: number;
  connectorStatus?: string;
  startedAt?: string;
  elapsedSeconds?: number;
}

export const chargingSimulationService = {
  /**
   * Start a charging session for a reservation
   */
  async startCharging(reservationId: string): Promise<{
    sessionId: string;
    reservationId: string;
    startTime: string;
    estimatedEndTime: string;
  }> {
    const response = await axios.post(
      `${API_URL}/start`,
      { reservationId },
      getAuthHeader()
    );
    return response.data.data;
  },

  /**
   * Stop an active charging session
   */
  async stopCharging(sessionId: string): Promise<{
    sessionId: string;
    totalEnergyKWh: number;
    totalCostBDT: number;
    duration: number;
  }> {
    const response = await axios.post(
      `${API_URL}/stop`,
      { sessionId },
      getAuthHeader()
    );
    return response.data.data;
  },

  /**
   * Get charging status for a reservation
   */
  async getChargingStatus(reservationId: string): Promise<ChargingStatus> {
    const response = await axios.get(
      `${API_URL}/status/${reservationId}`,
      getAuthHeader()
    );
    return response.data.data;
  },

  /**
   * Get all active charging sessions (admin)
   */
  async getActiveChargingSessions(): Promise<ChargingTelemetry[]> {
    const response = await axios.get(
      `${API_URL}/active`,
      getAuthHeader()
    );
    return response.data?.data || [];
  },
};

export default chargingSimulationService;
