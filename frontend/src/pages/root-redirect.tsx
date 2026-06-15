import { Navigate } from 'react-router-dom'
import { STAFF_ROLES } from '@/features/auth/constants'
import { useAuthStore } from '@/features/auth/store'

// Entry point: signed-out visitors go to the shared login; signed-in users go
// to their area based on role.
function RootRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (isAuthenticated && user) {
    const target = STAFF_ROLES.includes(user.role) ? '/admin' : '/portal'
    return <Navigate to={target} replace />
  }

  return <Navigate to="/login" replace />
}

export default RootRedirect
