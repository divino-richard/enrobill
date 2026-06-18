import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { fetchCurrentUser, login, register, resendVerification } from './api'
import {
  LOGIN_MUTATION_KEY,
  REGISTER_MUTATION_KEY,
  STAFF_ROLES,
} from './constants'
import { useAuthStore } from './store'
import type { LoginCredentials, RegisterCredentials } from './types'

// Single login: authenticates, stores the session, then routes by role —
// staff (admin/cashier) to /admin, portal users (student/applicant) to /portal.
export function useLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationKey: LOGIN_MUTATION_KEY,
    mutationFn: (credentials: LoginCredentials) => login(credentials),
    onSuccess: (data) => {
      setAuth(data)
      navigate(STAFF_ROLES.includes(data.user.role) ? '/admin' : '/portal')
    },
  })
}

// Public applicant registration: creates the account (unverified) and sends a
// verification email. Does NOT sign the user in — it sends them to the login
// page, which prompts them to verify their email first.
export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationKey: REGISTER_MUTATION_KEY,
    mutationFn: (input: RegisterCredentials) => register(input),
    onSuccess: () => {
      navigate('/login?registered=1')
    },
  })
}

// Resend the verification email for an unverified account.
export function useResendVerification() {
  return useMutation({
    mutationKey: ['auth', 'resend-verification'],
    mutationFn: (email: string) => resendVerification(email),
  })
}

// Keeps the cached user (especially their role) in sync with the server.
//
// Sanctum tokens aren't tied to a role — the backend reads it live from the
// database on every request — so a server-side role change (e.g. applicant →
// student when an application is accepted) is picked up here without forcing a
// re-login. Re-fetches on mount and on window focus; a 401 means the token is
// no longer valid, so we clear the session. Call once from a top-level component.
export function useSessionSync() {
  const token = useAuthStore((state) => state.token)
  const setUser = useAuthStore((state) => state.setUser)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const { data, error } = useQuery({
    queryKey: ['me'],
    queryFn: fetchCurrentUser,
    enabled: Boolean(token),
    retry: false,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (data) setUser(data)
  }, [data, setUser])

  useEffect(() => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAuth()
    }
  }, [error, clearAuth])
}
