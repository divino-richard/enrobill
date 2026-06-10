import api from '@/lib/api'
import type { AuthResponse, LoginCredentials } from './types'

// Staff portal (admin + cashier). Only staff accounts may authenticate here.
export async function loginAdmin(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/admin/login', credentials)
  return data
}

// Family portal (guardian + student). Only family accounts may authenticate here.
export async function loginPortal(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/portal/login', credentials)
  return data
}
