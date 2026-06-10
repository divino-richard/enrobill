// Stable keys for the auth feature.

// localStorage key used by the persisted Zustand auth store.
export const AUTH_STORAGE_KEY = 'enrobill-auth'

// TanStack Query mutation key for the login request.
export const LOGIN_MUTATION_KEY = ['auth', 'login'] as const
