import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { login, register } from './api'
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
