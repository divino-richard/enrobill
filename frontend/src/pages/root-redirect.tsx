import { Navigate } from 'react-router-dom'
import { STAFF_ROLES } from '@/features/auth/constants'
import { useAuthStore } from '@/features/auth/store'

// Entry point: send users to the right portal based on session + role.
// Signed-out visitors default to the staff login (admin-first).
function RootRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (isAuthenticated && user) {
    const target = STAFF_ROLES.includes(user.role) ? '/admin' : '/portal'
    return <Navigate to={target} replace />
  }

  return <Navigate to="/admin/login" replace />
}

export default RootRedirect
