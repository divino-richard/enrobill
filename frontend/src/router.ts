import { createBrowserRouter } from 'react-router-dom'
import {
  AdminGuard,
  PortalGuard,
  StaffGuard,
} from './features/auth/components/guards'
import { StaffLayout } from './layouts/staff-layout'
import { PortalLayout } from './layouts/portal-layout'
import RootRedirect from './pages/root-redirect'
import NotFound from './pages/NotFound'
import LoginPage from './pages/login-page'
import RegisterPage from './pages/register-page'
import DashboardPage from './pages/admin/dashboard-page'
import AdminReportsPage from './pages/admin/reports-page'
import AdminApplicationsPage from './pages/admin/applications-page'
import AdminApplicationDetailPage from './pages/admin/application-detail-page'
import AdminStudentsPage from './pages/admin/students-page'
import AdminStudentDetailPage from './pages/admin/student-detail-page'
import AdminEnrollmentsPage from './pages/admin/enrollments-page'
import AdminUsersPage from './pages/admin/users-page'
import AdminUserDetailPage from './pages/admin/user-detail-page'
import AdminTermsPage from './pages/admin/terms-page'
import AdminProgramsPage from './pages/admin/programs-page'
import AdminFeesPage from './pages/admin/fees-page'
import AdminDiscountsPage from './pages/admin/discounts-page'
import AdminBillingPage from './pages/admin/billing-page'
import AdminBillDetailPage from './pages/admin/bill-detail-page'
import AdminPaymentChannelsPage from './pages/admin/payment-channels-page'
import AccountPage from './pages/account-page'
import PortalHomePage from './pages/portal/home-page'
import PortalBillsPage from './pages/portal/bills-page'
import PortalProgramsPage from './pages/portal/programs-page'
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
        children: [
          // Shared with cashiers: dashboard + accounting screens.
          { index: true, Component: DashboardPage },
          { path: 'reports', Component: AdminReportsPage },
          { path: 'account', Component: AccountPage },
          { path: 'fees', Component: AdminFeesPage },
          { path: 'discounts', Component: AdminDiscountsPage },
          { path: 'enrollments', Component: AdminEnrollmentsPage },
          { path: 'billing', Component: AdminBillingPage },
          { path: 'billing/:id', Component: AdminBillDetailPage },
          { path: 'payment-methods', Component: AdminPaymentChannelsPage },

          // Admin-only areas (cashiers are redirected away).
          {
            Component: AdminGuard,
            children: [
              { path: 'applications', Component: AdminApplicationsPage },
              {
                path: 'applications/:id',
                Component: AdminApplicationDetailPage,
              },
              { path: 'students', Component: AdminStudentsPage },
              { path: 'students/:id', Component: AdminStudentDetailPage },
              { path: 'users', Component: AdminUsersPage },
              { path: 'users/:id', Component: AdminUserDetailPage },
              { path: 'terms', Component: AdminTermsPage },
              { path: 'programs', Component: AdminProgramsPage },
            ],
          },
        ],
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
          { path: 'account', Component: AccountPage },
          { path: 'bills', Component: PortalBillsPage },
          { path: 'programs', Component: PortalProgramsPage },
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
