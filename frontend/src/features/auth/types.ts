// Domain types for the auth feature.

// Roles span two portals: staff (admin, cashier) and family (guardian, student).
export type Role = 'admin' | 'cashier' | 'guardian' | 'student'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}
