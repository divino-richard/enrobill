import { Link, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { LoginForm } from '@/features/auth/components/login-form'
import { useLogin, useResendVerification } from '@/features/auth/hooks'

// Single login for all users (admin, cashier, student, applicant).
// After authenticating, the role decides which area they land in.
function LoginPage() {
  const login = useLogin()
  const resend = useResendVerification()
  const [params] = useSearchParams()
  const justRegistered = params.get('registered') === '1'
  const justVerified = params.get('verified') === '1'

  return (
    <AuthLayout subtitle="Enrollment & Tuition Portal">
      {justVerified && (
        <div className="w-full max-w-sm rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Your email is verified. You can now sign in.
        </div>
      )}
      {justRegistered && (
        <div className="border-brand/20 bg-brand/5 text-foreground w-full max-w-sm rounded-md border px-4 py-3 text-sm">
          Registration successful — please check your email to verify your
          account before signing in.
        </div>
      )}

      <LoginForm
        login={login}
        resend={resend}
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
