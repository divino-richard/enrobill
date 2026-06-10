import { LogOut } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/store'

// Self-service shell for the family portal (guardian + student).
export function PortalLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const handleSignOut = () => {
    clearAuth()
    navigate('/portal/login')
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="ring-border rounded-full bg-white p-0.5 ring-1">
            <Logo className="size-8 rounded-full" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Enrobill</p>
            <p className="text-muted-foreground text-xs">Family Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{user?.name ?? 'Signed in'}</p>
            <p className="text-muted-foreground text-xs capitalize">
              {user?.role}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
