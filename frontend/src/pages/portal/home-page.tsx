import { useAuthStore } from '@/features/auth/store'

// Placeholder family portal home — self-service screens will be built here.
function PortalHomePage() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{user ? `, ${user.name}` : ''}
      </h1>
      <p className="text-muted-foreground">
        Your enrollment status, bills, and payments will appear here.
      </p>
    </div>
  )
}

export default PortalHomePage
