import type { ReactNode } from 'react'
import axios from 'axios'
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

// The login API returns 403 + { code: 'email_unverified' } for unverified accounts.
function isUnverifiedError(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 403 &&
    (error.response?.data as { code?: string } | undefined)?.code ===
      'email_unverified'
  )
}

interface LoginFormProps {
  title: string
  description: string
  // The login mutation (useLogin).
  login: UseMutationResult<AuthResponse, Error, LoginCredentials>
  // Optional resend-verification mutation; enables the "resend" action when the
  // login fails because the email isn't verified.
  resend?: UseMutationResult<{ message: string }, Error, string>
  footer?: ReactNode
}

// Reusable credentials form. The portal supplies the title, copy, and mutation.
export function LoginForm({
  title,
  description,
  login,
  resend,
  footer,
}: LoginFormProps) {
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

          {login.isError &&
            (isUnverifiedError(login.error) ? (
              <div className="space-y-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 dark:border-amber-900/50 dark:bg-amber-950/40">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {getErrorMessage(login.error)}
                </p>
                {resend &&
                  (resend.isSuccess ? (
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
                      Verification email sent — check your inbox.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-sm font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 disabled:opacity-60 dark:text-amber-100 dark:hover:text-amber-50"
                      disabled={resend.isPending}
                      onClick={() =>
                        resend.mutate(form.getFieldValue('email'))
                      }
                    >
                      {resend.isPending
                        ? 'Sending…'
                        : 'Resend verification email'}
                    </Button>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-destructive">
                {getErrorMessage(login.error)}
              </p>
            ))}

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
