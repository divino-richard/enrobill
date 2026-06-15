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

// Student-aspirant (applicant) registration input. camelCase here; the API
// client maps it to the backend's snake_case payload.
export interface RegisterCredentials {
  firstName: string
  middleName: string
  lastName: string
  email: string
  password: string
  passwordConfirmation: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}
