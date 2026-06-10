import { AuthLayout } from '@/features/auth/components/auth-layout'
import { LoginForm } from '@/features/auth/components/login-form'
import { usePortalLogin } from '@/features/auth/hooks'

// Family portal login (guardian + student).
function PortalLoginPage() {
  const login = usePortalLogin()

  return (
    <AuthLayout subtitle="Guardian & Student Portal">
      <LoginForm
        login={login}
        title="Sign in"
        description="Access your enrollment and tuition records."
      />
    </AuthLayout>
  )
}

export default PortalLoginPage
