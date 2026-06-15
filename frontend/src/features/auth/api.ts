import api from '@/lib/api'
import type { AuthResponse, LoginCredentials } from './types'

// POST /api/login — single login for all users (admin, cashier, student,
// applicant). The response role decides where the SPA routes them next.
export async function login(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/login', credentials)
  return data
}
