import logoUrl from '@/assets/northlink-logo.png'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
}

// Northlink Technological College ("nTc") logo. Reusable across the app.
export function Logo({ className }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Northlink Technological College"
      className={cn('object-contain', className)}
    />
  )
}
