import { AuthLayout } from '@/features/auth/components/auth-layout'
import { LoginForm } from '@/features/auth/components/login-form'
import { useAdminLogin } from '@/features/auth/hooks'

// Staff portal login (admin + cashier).
function AdminLoginPage() {
  const login = useAdminLogin()

  return (
    <AuthLayout subtitle="Administration Console">
      <LoginForm
        login={login}
        title="Staff sign in"
        description="Use your Enrobill administrator account."
        footer={
          <p className="text-muted-foreground text-center text-sm">
            Forgot your password? Contact your administrator.
          </p>
        }
      />
    </AuthLayout>
  )
}

export default AdminLoginPage
