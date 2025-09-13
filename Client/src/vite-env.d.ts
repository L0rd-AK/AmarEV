/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WEBSOCKET_URL: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_DEFAULT_MAP_CENTER_LAT: string
  readonly VITE_DEFAULT_MAP_CENTER_LNG: string
  readonly VITE_DEFAULT_MAP_ZOOM: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_MAPBOX_ACCESS_TOKEN: string
  readonly VITE_ENABLE_NOTIFICATIONS: string
  readonly VITE_ENABLE_OFFLINE_MODE: string
  readonly VITE_ENABLE_DEBUG_MODE: string
  readonly VITE_PAYMENT_SUCCESS_URL: string
  readonly VITE_PAYMENT_FAILURE_URL: string
  readonly VITE_PAYMENT_CANCEL_URL: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_FACEBOOK_APP_ID: string
  readonly VITE_GOOGLE_ANALYTICS_ID: string
  readonly VITE_ASSETS_BASE_URL: string
  readonly VITE_UPLOAD_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}