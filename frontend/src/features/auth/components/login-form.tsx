import type { ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'
import type { UseMutationResult } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/form/password-input'
import { FieldInfo } from '@/components/form/field-info'
import { getErrorMessage } from '@/lib/get-error-message'
import type { AuthResponse, LoginCredentials } from '../types'

function validateEmail(value: string): string | undefined {
  if (!value) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email'
  return undefined
}

function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required'
  if (value.length < 6) return 'Password must be at least 6 characters'
  return undefined
}

interface LoginFormProps {
  title: string
  description: string
  // The login mutation (useLogin).
  login: UseMutationResult<AuthResponse, Error, LoginCredentials>
  footer?: ReactNode
}

// Reusable credentials form. The portal supplies the title, copy, and mutation.
export function LoginForm({ title, description, login, footer }: LoginFormProps) {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      await login.mutateAsync(value)
    },
  })

  return (
    <Card className="w-full max-w-sm overflow-hidden border-t-4 border-t-brand-accent shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field
            name="email"
            validators={{ onChange: ({ value }) => validateEmail(value) }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{ onChange: ({ value }) => validatePassword(value) }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Password</Label>
                <PasswordInput
                  id={field.name}
                  name={field.name}
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          {login.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(login.error)}
            </p>
          )}

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit || login.isPending}
              >
                {isSubmitting || login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            )}
          </form.Subscribe>

          {footer}
        </form>
      </CardContent>
    </Card>
  )
}
