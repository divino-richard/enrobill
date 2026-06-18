import api from '@/lib/api'
import type {
  AuthResponse,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
  RegisterResponse,
} from './types'

// GET /api/me — the authenticated user, with their role read live from the
// database. Used to re-sync the cached session after a role change.
export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<{ data: AuthUser }>('/me')
  return data.data
}

// POST /api/login — single login for all users (admin, cashier, student,
// applicant). The response role decides where the SPA routes them next.
export async function login(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/login', credentials)
  return data
}

// POST /api/register — public student-aspirant (applicant) registration.
// Returns a message + the created user (no token; email must be verified first).
export async function register(
  input: RegisterCredentials,
): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>('/register', {
    first_name: input.firstName,
    middle_name: input.middleName || null,
    last_name: input.lastName,
    email: input.email,
    password: input.password,
    password_confirmation: input.passwordConfirmation,
  })
  return data
}

// POST /api/email/resend — resend the verification email for an unverified account.
export async function resendVerification(
  email: string,
): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/email/resend', { email })
  return data
}
