import { createBrowserRouter } from 'react-router-dom'
import { PortalGuard, StaffGuard } from './features/auth/components/guards'
import { StaffLayout } from './layouts/staff-layout'
import { PortalLayout } from './layouts/portal-layout'
import RootRedirect from './pages/root-redirect'
import NotFound from './pages/NotFound'
import LoginPage from './pages/login-page'
import RegisterPage from './pages/register-page'
import DashboardPage from './pages/admin/dashboard-page'
import PortalHomePage from './pages/portal/home-page'
import ApplicationPage from './pages/portal/application-page'
import ApplicationNewPage from './pages/portal/application-new-page'
import ApplicationDetailPage from './pages/portal/application-detail-page'
import ApplicationEditPage from './pages/portal/application-edit-page'

// Central route configuration. One shared login; two areas behind role guards:
//   - Staff  (admin + cashier) under /admin
//   - Portal (student + applicant) under /portal
// Uses `Component` (not `element`) so this stays a plain .ts file with no JSX.
export const router = createBrowserRouter([
  // Entry point — redirects to login or the user's area based on session + role.
  { path: '/', Component: RootRedirect },

  // Shared login for every user; public applicant registration.
  { path: '/login', Component: LoginPage },
  { path: '/register', Component: RegisterPage },

  // --- Staff area ---------------------------------------------------------
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

  // --- Portal area (students + applicants) --------------------------------
  {
    path: '/portal',
    Component: PortalGuard,
    children: [
      {
        Component: PortalLayout,
        children: [
          { index: true, Component: PortalHomePage },
          { path: 'application', Component: ApplicationPage },
          { path: 'application/new', Component: ApplicationNewPage },
          { path: 'application/:id', Component: ApplicationDetailPage },
          { path: 'application/:id/edit', Component: ApplicationEditPage },
        ],
      },
    ],
  },

  { path: '*', Component: NotFound },
])
