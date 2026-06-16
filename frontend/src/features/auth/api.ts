import api from '@/lib/api'
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  RegisterResponse,
} from './types'

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
