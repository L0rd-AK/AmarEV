import axios from 'axios';
import { config } from '../config';

const API_URL = `${config.apiBaseUrl}/admin`;

export interface DashboardAnalytics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
    totalStations: number;
    activeStations: number;
    totalConnectors: number;
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    totalReservations: number;
    activeReservations: number;
    totalRevenue: number;
    totalEnergyDelivered: number;
    averageSessionCost: number;
    averageSessionDuration: number;
    totalReviews: number;
    averageRating: number;
  };
  growth: {
    users: Array<{ _id: { year: number; month: number }; count: number }>;
    revenue: Array<{
      _id: { year: number; month: number; day?: number };
      revenue: number;
      count: number;
    }>;
  };
  topStations: Array<{
    id: string;
    name: string;
    location: string;
    totalSessions: number;
    totalRevenue: number;
    totalEnergy: number;
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    displayName?: string;
    role: string;
    status: string;
    joinedAt: Date;
  }>;
}

export interface SystemStats {
  sessions: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  revenue: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  users: {
    newLast24h: number;
    newLast7d: number;
    newLast30d: number;
  };
  alerts: {
    flaggedReviews: number;
    pendingReservations: number;
  };
}

export interface User {
  _id: string;
  email: string;
  displayName?: string;
  role: string;
  status: string;
  createdAt: Date;
}

export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class AdminService {
  private getAuthHeader() {
    const token = localStorage.getItem('accessToken');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  async getDashboardAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    period?: 'day' | 'week' | 'month';
  }): Promise<DashboardAnalytics> {
    const response = await axios.get(`${API_URL}/dashboard`, {
      ...this.getAuthHeader(),
      params,
    });
    return response.data.data;
  }

  async getSystemStats(): Promise<SystemStats> {
    const response = await axios.get(`${API_URL}/system-stats`, this.getAuthHeader());
    return response.data.data;
  }

  async getAllUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<UsersResponse> {
    const response = await axios.get(`${API_URL}/users`, {
      ...this.getAuthHeader(),
      params,
    });
    return response.data.data;
  }

  async updateUserStatus(userId: string, status: string): Promise<User> {
    const response = await axios.put(
      `${API_URL}/users/${userId}/status`,
      { status },
      this.getAuthHeader()
    );
    return response.data.data.user;
  }
}

export const adminService = new AdminService();
