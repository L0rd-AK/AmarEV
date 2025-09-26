// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'operator' | 'admin';
  status: string;
  isEmailVerified: boolean;
  isPhoneVerified?: boolean;
  phone?: string;
  language: 'en' | 'bn';
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  language?: 'en' | 'bn';
}

export interface RegisterResponse {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  emailVerificationSent: boolean;
}

export interface UpdateProfileRequest {
  displayName?: string;
  phone?: string;
  language?: 'en' | 'bn';
}

// HTTP Client Configuration
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Get access token from localStorage
    const accessToken = localStorage.getItem('accessToken');
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add Authorization header if token exists
    if (accessToken) {
      defaultHeaders.Authorization = `Bearer ${accessToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data: ApiResponse<T> = await response.json();

      // Handle token refresh if access token is expired
      if (response.status === 401 && data.message?.includes('token')) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const refreshResponse = await this.refreshAccessToken();
            if (refreshResponse.success) {
              // Retry original request with new token
              const newToken = refreshResponse.data?.tokens.accessToken;
              if (newToken) {
                config.headers = {
                  ...config.headers,
                  Authorization: `Bearer ${newToken}`,
                };
                const retryResponse = await fetch(url, config);
                return await retryResponse.json();
              }
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.clearAuthData();
            window.location.href = '/login';
          }
        }
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw new Error('Network error. Please check your connection.');
    }
  }

  // Auth Methods
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
    return this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<ApiResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    
    // Clear local storage regardless of response
    this.clearAuthData();
    
    return response;
  }

  async refreshAccessToken(): Promise<ApiResponse<{ tokens: AuthTokens }>> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<{ tokens: AuthTokens }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (response.success && response.data) {
      // Update stored tokens
      localStorage.setItem('accessToken', response.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
    }

    return response;
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string): Promise<ApiResponse> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async verifyEmail(token: string): Promise<ApiResponse<{ user: User }>> {
    return this.request<{ user: User }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendEmailVerification(email: string): Promise<ApiResponse> {
    return this.request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    return this.request<{ user: User }>('/auth/profile');
  }

  async updateProfile(profileData: UpdateProfileRequest): Promise<ApiResponse<{ user: User }>> {
    return this.request<{ user: User }>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async googleAuth(credential: string): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }

  // Utility Methods
  private clearAuthData(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated(): boolean {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return !!(accessToken && refreshToken);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }
}

// Create and export API client instance
export const apiClient = new ApiClient(API_BASE_URL);

// Convenience auth service object
export const authService = {
  login: (credentials: LoginRequest) => apiClient.login(credentials),
  register: (userData: RegisterRequest) => apiClient.register(userData),
  googleAuth: (credential: string) => apiClient.googleAuth(credential),
  logout: () => apiClient.logout(),
  refreshToken: () => apiClient.refreshAccessToken(),
  forgotPassword: (email: string) => apiClient.forgotPassword(email),
  resetPassword: (token: string, password: string) => apiClient.resetPassword(token, password),
  verifyEmail: (token: string) => apiClient.verifyEmail(token),
  resendEmailVerification: (email: string) => apiClient.resendEmailVerification(email),
  getProfile: () => apiClient.getProfile(),
  updateProfile: (profileData: UpdateProfileRequest) => apiClient.updateProfile(profileData),
  changePassword: (currentPassword: string, newPassword: string) => 
    apiClient.changePassword(currentPassword, newPassword),
  isAuthenticated: () => apiClient.isAuthenticated(),
  getAccessToken: () => apiClient.getAccessToken(),
  getRefreshToken: () => apiClient.getRefreshToken(),
};

export default authService;