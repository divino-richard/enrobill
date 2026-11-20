import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/features/auth/store'
import { queryClient } from './query-client'

// Central axios instance used across the app to talk to the Laravel API.
//
// Auth strategy: token-based (Sanctum personal access tokens). The same API
// serves multiple clients (this SPA, plus future mobile/third-party clients),
// so we authenticate with a Bearer token rather than first-party cookies.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    Accept: 'application/json',
  },
})

// Attach the bearer token (if any) from the persisted auth store to every
// request. Read non-reactively via getState() since this runs outside React.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Revoked sessions must leave the signed-in UI on any protected request.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const { token, clearAuth } = useAuthStore.getState()
      const sentToken = error.config?.headers.Authorization
      const sessionRejected = error.response?.status === 401 || (
        error.response?.status === 403 &&
        error.response.data?.code === 'account_deactivated'
      )

      // Ignore failures from an older session after another account signs in.
      if (token && sentToken === `Bearer ${token}` && sessionRejected) {
        clearAuth()
        queryClient.clear()
      }
    }
    return Promise.reject(error)
  },
)

export default api
