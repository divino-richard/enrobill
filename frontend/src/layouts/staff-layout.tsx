import {
  BarChart3,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  ReceiptText,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/store'

// Active route gets a real link; the rest are placeholders until built.
const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, ready: true },
  { label: 'Enrollments', icon: ClipboardList, ready: false },
  { label: 'Fees & Assessments', icon: ReceiptText, ready: false },
  { label: 'Payments', icon: CreditCard, ready: false },
  { label: 'Reports', icon: BarChart3, ready: false },
] as const

// Back-office shell for the staff portal (admin + cashier).
export function StaffLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const handleSignOut = () => {
    clearAuth()
    navigate('/admin/login')
  }

  return (
    <div className="flex min-h-svh">
      <aside className="bg-card hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2.5 border-b px-5 py-4">
          <div className="ring-border rounded-full bg-white p-0.5 ring-1">
            <Logo className="size-8 rounded-full" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Enrobill</p>
            <p className="text-muted-foreground text-xs">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) =>
            item.ready ? (
              <NavLink
                key={item.label}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ) : (
              <div
                key={item.label}
                className="text-muted-foreground/50 flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium"
                title="Coming soon"
              >
                <item.icon className="size-4" />
                {item.label}
                <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[0.625rem] font-medium">
                  Soon
                </span>
              </div>
            ),
          )}
        </nav>

        <div className="border-t p-3">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <p className="text-muted-foreground text-sm">Staff portal</p>
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{user?.name ?? 'Signed in'}</p>
            <p className="text-muted-foreground text-xs capitalize">
              {user?.role}
            </p>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
