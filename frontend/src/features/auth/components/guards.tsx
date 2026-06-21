import { Navigate, Outlet } from 'react-router-dom'
import { PORTAL_ROLES, STAFF_ROLES } from '../constants'
import { useAuthStore } from '../store'
import type { Role } from '../types'

// Route guard: requires an authenticated user whose role is allowed here.
// Unauthenticated → the shared login; wrong role → root (which re-routes them).
function RequireRole({ allow }: { allow: Role[] }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }
  if (!allow.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export function StaffGuard() {
  return <RequireRole allow={STAFF_ROLES} />
}

// Admin-only areas within the staff workspace (cashiers are redirected away).
export function AdminGuard() {
  return <RequireRole allow={['admin']} />
}

export function PortalGuard() {
  return <RequireRole allow={PORTAL_ROLES} />
}
