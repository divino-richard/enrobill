import { createBrowserRouter } from 'react-router-dom'
import { FamilyGuard, StaffGuard } from './features/auth/components/guards'
import { StaffLayout } from './layouts/staff-layout'
import { PortalLayout } from './layouts/portal-layout'
import RootRedirect from './pages/root-redirect'
import NotFound from './pages/NotFound'
import AdminLoginPage from './pages/admin/login-page'
import DashboardPage from './pages/admin/dashboard-page'
import PortalLoginPage from './pages/portal/login-page'
import PortalHomePage from './pages/portal/home-page'

// Central route configuration. Two portals share one SPA:
//   - Staff  (admin + cashier) under /admin
//   - Family (guardian + student) under /portal
// Uses `Component` (not `element`) so this stays a plain .ts file with no JSX.
export const router = createBrowserRouter([
  // Entry point — redirects to the right place based on session + role.
  { path: '/', Component: RootRedirect },

  // --- Staff portal -------------------------------------------------------
  { path: '/admin/login', Component: AdminLoginPage },
  {
    path: '/admin',
    Component: StaffGuard,
    children: [
      {
        Component: StaffLayout,
        children: [{ index: true, Component: DashboardPage }],
      },
    ],
  },

  // --- Family portal ------------------------------------------------------
  { path: '/portal/login', Component: PortalLoginPage },
  {
    path: '/portal',
    Component: FamilyGuard,
    children: [
      {
        Component: PortalLayout,
        children: [{ index: true, Component: PortalHomePage }],
      },
    ],
  },

  { path: '*', Component: NotFound },
])
