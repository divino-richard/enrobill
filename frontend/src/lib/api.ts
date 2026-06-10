import axios, { type InternalAxiosRequestConfig } from 'axios'

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

// Attach the stored bearer token (if any) to every request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
