import type { Role } from './types'

// localStorage key used by the persisted Zustand auth store.
export const AUTH_STORAGE_KEY = 'enrobill-auth'

// Role groups decide which area a user lands in after the shared login.
export const STAFF_ROLES: Role[] = ['admin', 'cashier']
export const PORTAL_ROLES: Role[] = ['student', 'applicant']

// TanStack Query mutation key for the single login.
export const LOGIN_MUTATION_KEY = ['auth', 'login'] as const
