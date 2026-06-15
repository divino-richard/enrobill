// Domain types for the auth feature.

// Roles: staff (admin, cashier) and portal users (student, applicant).
export type Role = 'admin' | 'cashier' | 'student' | 'applicant'

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
