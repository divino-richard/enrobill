import { Link } from 'react-router-dom'
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
          <div className="space-y-2 text-center text-sm">
            <p className="text-muted-foreground">
              New student aspirant?{' '}
              <Link
                to="/register"
                className="text-brand font-medium hover:underline"
              >
                Create an account
              </Link>
            </p>
            <p className="text-muted-foreground">
              Forgot your password? Contact your administrator.
            </p>
          </div>
        }
      />
    </AuthLayout>
  )
}

export default LoginPage
