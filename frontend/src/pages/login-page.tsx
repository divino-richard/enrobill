import { AuthLayout } from '@/features/auth/components/auth-layout'
import { LoginForm } from '@/features/auth/components/login-form'
import { useLogin } from '@/features/auth/hooks'

// Single login for all users (admin, cashier, student, applicant).
// After authenticating, the role decides which area they land in.
function LoginPage() {
  const login = useLogin()

  return (
    <AuthLayout subtitle="Enrollment & Tuition Portal">
      <LoginForm
        login={login}
        title="Sign in"
        description="Access your Enrobill account."
        footer={
          <p className="text-muted-foreground text-center text-sm">
            Forgot your password? Contact your administrator.
          </p>
        }
      />
    </AuthLayout>
  )
}

export default LoginPage
