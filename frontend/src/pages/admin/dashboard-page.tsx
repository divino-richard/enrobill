import { useAuthStore } from '@/features/auth/store'

// Placeholder admin dashboard — the staff workspace will be built here.
function DashboardPage() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome back{user ? `, ${user.name}` : ''}. Enrollment, fees, payments,
        and reporting tools will appear here.
      </p>
    </div>
  )
}

export default DashboardPage
