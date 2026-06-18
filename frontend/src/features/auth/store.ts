import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AUTH_STORAGE_KEY } from './constants'
import type { AuthResponse, AuthUser } from './types'

interface AuthState {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  setAuth: (payload: AuthResponse) => void
  // Refresh just the cached user (e.g. after a server-side role change).
  setUser: (user: AuthUser) => void
  clearAuth: () => void
}

// Persisted auth store. The token + user survive page reloads via localStorage.
// Read the token outside React with `useAuthStore.getState().token`
// (see src/lib/api.ts).
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: ({ token, user }) => set({ token, user, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
