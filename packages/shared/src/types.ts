// User Roles
export enum UserRole {
  USER = 'user',
  OPERATOR = 'operator',
  ADMIN = 'admin'
}

// User Account Status
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

// Token Types
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset'
}

// Connector Types
export enum ConnectorType {
  AC = 'AC',
  DC = 'DC'
}

export enum ConnectorStandard {
  TYPE2 = 'Type2',
  CCS2 = 'CCS2',
  CHADEMO = 'CHAdeMO'
}

// Station and Connector Status
export enum ConnectorStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance'
}

// Reservation Status
export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  EXPIRED = 'expired'
}

// Session Status
export enum SessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Payment Status
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELED = 'canceled'
}

// Payment Providers
export enum PaymentProvider {
  SSLCOMMERZ = 'sslcommerz',
  BKASH = 'bkash'
}

// Pricing Rate Types
export enum PricingRateType {
  PER_KWH = 'kWh',
  PER_MINUTE = 'minute'
}

// Base Interfaces
export interface User {
  _id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  displayName?: string;
  language: 'en' | 'bn';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  loginAttempts?: number;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// JWT Token Interface
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  type: TokenType;
  iat: number;
  exp: number;
}

// Refresh Token Interface
export interface RefreshToken {
  _id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Vehicle {
  _id: string;
  userId: string;
  make: string;
  model: string;
  year?: number;
  connectorType: ConnectorStandard[];
  usableKWh: number;
  maxACkW: number;
  maxDCkW: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Station {
  _id: string;
  name: string;
  operatorId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface Connector {
  _id: string;
  stationId: string;
  type: ConnectorType;
  standard: ConnectorStandard;
  maxKw: number;
  pricePerKWhBDT: number;
  pricePerMinuteBDT: number;
  sessionFeeBDT: number;
  status: ConnectorStatus;
  lastMaintenanceDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reservation {
  _id: string;
  userId: string;
  vehicleId: string;
  stationId: string;
  connectorId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  qrCode?: string;
  otp?: string;
  totalCostBDT?: number;
  notes?: string;
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'expired';
  paymentDeadline?: Date;
  isPaid?: boolean;
  paymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionEvent {
  timestamp: Date;
  powerKw: number;
  voltage: number;
  current: number;
  energyKWh: number;
}

export interface Session {
  _id: string;
  reservationId?: string;
  userId: string;
  stationId: string;
  connectorId: string;
  vehicleId: string;
  startTime: Date;
  endTime?: Date;
  totalEnergyKWh: number;
  averagePowerKw: number;
  totalCostBDT: number;
  status: SessionStatus;
  events: SessionEvent[];
  paymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingWindow {
  _id: string;
  stationId: string;
  connectorType?: ConnectorType;
  fromTime: string; // HH:mm format
  toTime: string; // HH:mm format
  dayOfWeek?: number[]; // 0-6, Sunday to Saturday
  rateType: PricingRateType;
  rateBDT: number;
  isActive: boolean;
  validFrom: Date;
  validTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  _id: string;
  userId: string;
  provider: PaymentProvider;
  amountBDT: number;
  currency: string;
  status: PaymentStatus;
  transactionId: string;
  gatewayTransactionId?: string;
  metadata: Record<string, any>;
  idempotencyKey: string;
  reservationId?: string;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  _id: string;
  userId: string;
  stationId: string;
  rating: number; // 1-5
  comment?: string;
  photos: string[];
  flagged: boolean;
  flaggedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  language?: 'en' | 'bn';
  role?: UserRole;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash' | 'emailVerificationToken' | 'passwordResetToken'>;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  phone?: string;
  language?: 'en' | 'bn';
}

// Authentication State Interface
export interface AuthState {
  user: Omit<User, 'passwordHash' | 'emailVerificationToken' | 'passwordResetToken'> | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface StationSearchParams {
  bbox?: string; // "swLng,swLat,neLng,neLat"
  lat?: number;
  lng?: number;
  radius?: number; // in meters
  ac_min_kw?: number;
  dc_min_kw?: number;
  connector_type?: ConnectorStandard;
  open_now?: boolean;
  price_min?: number;
  price_max?: number;
  amenities?: string[];
  limit?: number;
  offset?: number;
}

export interface ReservationRequest {
  stationId: string;
  connectorId: string;
  vehicleId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  notes?: string;
}

export interface PaymentIntentRequest {
  provider: PaymentProvider;
  amount: number;
  currency: string;
  reservationId?: string;
  sessionId?: string;
}

export interface PaymentIntentResponse {
  paymentId: string;
  gatewayUrl?: string;
  gatewayData?: Record<string, any>;
}

export interface RoutePlanRequest {
  origin: {
    lat: number;
    lng: number;
  };
  destination: {
    lat: number;
    lng: number;
  };
  vehicle: {
    currentSocPercent: number;
    usableKWh: number;
    maxACkW: number;
    maxDCkW: number;
    connectorTypes: ConnectorStandard[];
  };
  waypoints?: Array<{
    lat: number;
    lng: number;
  }>;
  maxStops?: number;
}

export interface RoutePlanResponse {
  route: {
    distance: number; // meters
    duration: number; // seconds
    geometry: any; // GeoJSON geometry
  };
  chargingStops: Array<{
    station: Station;
    connector: Connector;
    arrivalSoc: number;
    departureSoc: number;
    chargingTime: number; // minutes
    location: {
      lat: number;
      lng: number;
    };
  }>;
  totalDistance: number;
  totalDuration: number;
  totalChargingTime: number;
}

// WebSocket Events
export interface SocketEvents {
  // Client to Server
  join_station: { stationId: string };
  leave_station: { stationId: string };
  subscribe_user: { userId: string };
  unsubscribe_user: { userId: string };

  // Server to Client
  'station.status': {
    stationId: string;
    connectors: Array<{
      id: string;
      status: ConnectorStatus;
    }>;
  };
  'reservation.created': Reservation;
  'reservation.updated': Reservation;
  'session.updated': Session;
  'pricing.updated': {
    stationId: string;
    window: PricingWindow;
  };
}

// Utility Types
export type CreateUserRequest = Omit<User, '_id' | 'passwordHash' | 'createdAt' | 'updatedAt' | 'emailVerificationToken' | 'passwordResetToken' | 'lastLogin' | 'loginAttempts' | 'lockUntil'> & {
  password: string;
};

export type UpdateUserRequest = Partial<Pick<User, 'displayName' | 'phone' | 'language'>>;

// Role Permission Types
export type Permission = 
  | 'user:read' | 'user:write' | 'user:delete'
  | 'station:read' | 'station:write' | 'station:delete'
  | 'reservation:read' | 'reservation:write' | 'reservation:delete'
  | 'session:read' | 'session:write'
  | 'payment:read' | 'payment:write' | 'payment:refund'
  | 'review:read' | 'review:write' | 'review:delete'
  | 'admin:all';

export interface RolePermissions {
  [UserRole.USER]: Permission[];
  [UserRole.OPERATOR]: Permission[];
  [UserRole.ADMIN]: Permission[];
}

export type CreateStationRequest = Omit<Station, '_id' | 'createdAt' | 'updatedAt'>;

export type UpdateStationRequest = Partial<CreateStationRequest>;

export type CreateVehicleRequest = Omit<Vehicle, '_id' | 'userId' | 'createdAt' | 'updatedAt'>;

export type UpdateVehicleRequest = Partial<CreateVehicleRequest>;

// Error Types
export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Constants
export const CONSTANTS = {
  PAGINATION: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
  SEARCH: {
    DEFAULT_RADIUS: 5000, // 5km
    MAX_RADIUS: 50000, // 50km
  },
  RESERVATION: {
    MAX_DURATION_HOURS: 8,
    MIN_DURATION_MINUTES: 15,
    GRACE_PERIOD_MINUTES: 15,
  },
  SESSION: {
    MAX_DURATION_HOURS: 12,
    IDLE_TIMEOUT_MINUTES: 30,
  },
  PAYMENT: {
    CURRENCY: 'BDT',
    MIN_AMOUNT: 10,
    MAX_AMOUNT: 100000,
  },
  FILE_UPLOAD: {
    MAX_SIZE_MB: 10,
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const;