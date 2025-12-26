export const config = {
  // Empty string = relative to current origin (works from any host)
  apiUrl: import.meta.env.VITE_API_URL || '',
  wsUrl: import.meta.env.VITE_WS_URL || '/',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
} as const
