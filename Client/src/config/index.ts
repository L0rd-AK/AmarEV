// Environment configuration utility
export const config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  websocketUrl: import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:5000',
  
  // App Configuration
  appName: import.meta.env.VITE_APP_NAME || 'ChargeBD',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  // Map Configuration
  defaultMapCenter: {
    lat: parseFloat(import.meta.env.VITE_DEFAULT_MAP_CENTER_LAT) || 23.8103,
    lng: parseFloat(import.meta.env.VITE_DEFAULT_MAP_CENTER_LNG) || 90.4125,
  },
  defaultMapZoom: parseInt(import.meta.env.VITE_DEFAULT_MAP_ZOOM) || 11,
  
  // External Services
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '',
  
  // Feature Flags
  features: {
    notifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS === 'true',
    offlineMode: import.meta.env.VITE_ENABLE_OFFLINE_MODE === 'true',
    debugMode: import.meta.env.VITE_ENABLE_DEBUG_MODE === 'true',
  },
  
  // Payment URLs
  paymentUrls: {
    success: import.meta.env.VITE_PAYMENT_SUCCESS_URL || '/payment/success',
    failure: import.meta.env.VITE_PAYMENT_FAILURE_URL || '/payment/failure',
    cancel: import.meta.env.VITE_PAYMENT_CANCEL_URL || '/payment/cancel',
  },
  
  // Social Login
  socialLogin: {
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    facebookAppId: import.meta.env.VITE_FACEBOOK_APP_ID || '',
  },
  
  // Analytics
  googleAnalyticsId: import.meta.env.VITE_GOOGLE_ANALYTICS_ID || '',
  
  // Assets
  assetsBaseUrl: import.meta.env.VITE_ASSETS_BASE_URL || '',
  uploadBaseUrl: import.meta.env.VITE_UPLOAD_BASE_URL || '/uploads',
  
  // Environment
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
} as const;

// API endpoints configuration
export const apiEndpoints = {
  // Auth endpoints
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    verify: '/auth/verify',
  },
  
  // User endpoints
  users: {
    profile: '/users/profile',
    update: '/users/profile',
    vehicles: '/users/vehicles',
    preferences: '/users/preferences',
  },
  
  // Station endpoints
  stations: {
    list: '/stations',
    details: (id: string) => `/stations/${id}`,
    search: '/stations/search',
    nearby: '/stations/nearby',
    filters: '/stations/filters',
  },
  
  // Reservation endpoints
  reservations: {
    list: '/reservations',
    create: '/reservations',
    details: (id: string) => `/reservations/${id}`,
    cancel: (id: string) => `/reservations/${id}/cancel`,
    verify: (id: string) => `/reservations/${id}/verify`,
  },
  
  // Session endpoints
  sessions: {
    list: '/sessions',
    start: '/sessions/start',
    stop: (id: string) => `/sessions/${id}/stop`,
    details: (id: string) => `/sessions/${id}`,
  },
  
  // Payment endpoints
  payments: {
    initiate: '/payments/initiate',
    execute: '/payments/bkash/execute',
    verify: '/payments/verify',
    history: '/payments/history',
    details: (id: string) => `/payments/${id}`,
  },
  
  // Route endpoints
  routes: {
    calculate: '/routes/calculate',
    planCharging: '/routes/plan-charging',
    stationsNearby: '/routes/stations/nearby',
    isochrone: '/routes/isochrone',
    saved: '/routes/saved',
  },
  
  // Review endpoints
  reviews: {
    station: (stationId: string) => `/reviews/station/${stationId}`,
    create: '/reviews',
    update: (id: string) => `/reviews/${id}`,
    delete: (id: string) => `/reviews/${id}`,
  },
} as const;

// Local storage keys
export const storageKeys = {
  authToken: 'chargebd_auth_token',
  refreshToken: 'chargebd_refresh_token',
  userPreferences: 'chargebd_user_preferences',
  mapState: 'chargebd_map_state',
  recentSearches: 'chargebd_recent_searches',
  offlineData: 'chargebd_offline_data',
} as const;

// Default values
export const defaults = {
  pagination: {
    pageSize: 10,
    maxPageSize: 100,
  },
  map: {
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
    minZoom: 6,
  },
  search: {
    radius: 25, // km
    maxResults: 50,
  },
  reservation: {
    maxAdvanceBooking: 7, // days
    minDuration: 30, // minutes
    maxDuration: 480, // minutes (8 hours)
  },
} as const;

export default config;