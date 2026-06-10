import { Logo } from '@/components/brand/logo'
import { LoginForm } from '@/features/auth/components/login-form'

// Standalone, centered auth page with a subtle dotted-texture background.
function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-linear-to-b from-primary/5 via-background to-background p-4">
      {/* Dotted texture across the whole page. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] bg-size-[22px_22px]" />
      {/* Soft brand-orange glow up top to echo the logo's accent. */}
      <div className="bg-brand-accent/20 pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="ring-border rounded-full bg-white p-1.5 shadow-sm ring-1">
            <Logo className="size-20 rounded-full" />
          </div>
          <div className="space-y-1">
            <h1 className="text-brand text-3xl font-bold tracking-tight">
              Enrobill
            </h1>
            <p className="text-foreground text-sm font-medium">
              Northlink Technological College
            </p>
            <p className="text-muted-foreground text-sm">
              Enrollment &amp; Tuition Portal
            </p>
          </div>
        </div>

        <LoginForm />

        <p className="text-muted-foreground text-xs">
          © {new Date().getFullYear()} Northlink Technological College
        </p>
      </div>
    </div>
  )
}

export default LoginPage
