import { Navigate, Outlet } from 'react-router-dom'
import { FAMILY_ROLES, STAFF_ROLES } from '../constants'
import { useAuthStore } from '../store'
import type { Role } from '../types'

interface RequireRoleProps {
  allow: Role[]
  loginPath: string
}

// Route guard: requires an authenticated user whose role is allowed here.
// Unauthenticated → portal login; wrong role → root (which re-routes them).
function RequireRole({ allow, loginPath }: RequireRoleProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (!isAuthenticated || !user) {
    return <Navigate to={loginPath} replace />
  }
  if (!allow.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export function StaffGuard() {
  return <RequireRole allow={STAFF_ROLES} loginPath="/admin/login" />
}

export function FamilyGuard() {
  return <RequireRole allow={FAMILY_ROLES} loginPath="/portal/login" />
}
