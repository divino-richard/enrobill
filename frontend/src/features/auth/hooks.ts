import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { loginAdmin, loginPortal } from './api'
import {
  ADMIN_LOGIN_MUTATION_KEY,
  PORTAL_LOGIN_MUTATION_KEY,
} from './constants'
import { useAuthStore } from './store'
import type { LoginCredentials } from './types'

// Staff login: authenticates, stores the session, and enters the admin portal.
export function useAdminLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationKey: ADMIN_LOGIN_MUTATION_KEY,
    mutationFn: (credentials: LoginCredentials) => loginAdmin(credentials),
    onSuccess: (data) => {
      setAuth(data)
      navigate('/admin')
    },
  })
}

// Family login: authenticates, stores the session, and enters the family portal.
export function usePortalLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationKey: PORTAL_LOGIN_MUTATION_KEY,
    mutationFn: (credentials: LoginCredentials) => loginPortal(credentials),
    onSuccess: (data) => {
      setAuth(data)
      navigate('/portal')
    },
  })
}
