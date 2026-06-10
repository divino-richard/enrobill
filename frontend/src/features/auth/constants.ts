import type { Role } from './types'

// localStorage key used by the persisted Zustand auth store.
export const AUTH_STORAGE_KEY = 'enrobill-auth'

// Which roles belong to which portal.
export const STAFF_ROLES: Role[] = ['admin', 'cashier']
export const FAMILY_ROLES: Role[] = ['guardian', 'student']

// TanStack Query mutation keys per portal login.
export const ADMIN_LOGIN_MUTATION_KEY = ['auth', 'admin', 'login'] as const
export const PORTAL_LOGIN_MUTATION_KEY = ['auth', 'portal', 'login'] as const
