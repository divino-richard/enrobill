import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { login } from './api'
import { LOGIN_MUTATION_KEY } from './constants'
import { useAuthStore } from './store'
import type { LoginCredentials } from './types'

// Login mutation: calls the API, stores the token/user, then redirects home.
export function useLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationKey: LOGIN_MUTATION_KEY,
    mutationFn: (credentials: LoginCredentials) => login(credentials),
    onSuccess: (data) => {
      setAuth(data)
      navigate('/')
    },
  })
}
