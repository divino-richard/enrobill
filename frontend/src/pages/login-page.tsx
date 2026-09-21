import { bannerStyles } from "@/components/ui/banner";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { LoginForm } from "@/features/auth/components/login-form";
import { useLogin, useResendVerification } from "@/features/auth/hooks";

// Single login for all users (admin, cashier, student, applicant).
// After authenticating, the role decides which area they land in.
function LoginPage() {
  const login = useLogin();
  const resend = useResendVerification();
  const [params] = useSearchParams();
  const justRegistered = params.get("registered") === "1";
  const justVerified = params.get("verified") === "1";

  return (
    <AuthLayout subtitle="Enrollment & Tuition Portal">
      {justVerified && (
        <div className={bannerStyles({ tone: "success", className: "mb-4 w-full max-w-sm" })}>
          Your email is verified. You can now sign in.
        </div>
      )}
      {justRegistered && (
        <div className={bannerStyles({ className: "mb-4 w-full max-w-sm" })}>
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
              New student aspirant?{" "}
              <Link
                to="/register"
                className="text-brand font-medium hover:underline"
              >
                Create an account
              </Link>
            </p>
            <p className="text-muted-foreground mt-10">
              Forgot your password? Contact your administrator.
            </p>
          </div>
        }
      />
    </AuthLayout>
  );
}

export default LoginPage;
