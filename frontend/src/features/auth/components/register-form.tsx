import { useForm } from '@tanstack/react-form'
import { Link } from 'react-router-dom'
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
import { useRegister } from '../hooks'
import { validatePassword } from '../password'
import { PasswordRequirements } from './password-requirements'

function required(label: string) {
  return (value: string) => (value.trim() ? undefined : `${label} is required`)
}

function validateEmail(value: string): string | undefined {
  if (!value) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email'
  return undefined
}

export function RegisterForm() {
  const register = useRegister()

  const form = useForm({
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      password: '',
      passwordConfirmation: '',
    },
    onSubmit: async ({ value }) => {
      await register.mutateAsync(value)
    },
  })

  return (
    <Card className="w-full overflow-hidden border-t-4 border-t-brand-accent shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Register as a student aspirant to begin your application.
        </CardDescription>
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
          <div className="grid gap-4 sm:grid-cols-3">
          <form.Field
            name="firstName"
            validators={{ onChange: ({ value }) => required('First name')(value) }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>First name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  autoComplete="given-name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="middleName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  Middle name{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  autoComplete="additional-name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Field
            name="lastName"
            validators={{ onChange: ({ value }) => required('Last name')(value) }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Last name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  autoComplete="family-name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>
          </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
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
                    autoComplete="new-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.isTouched && !field.state.value && (
                    <p className="text-sm text-destructive">
                      Password is required
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="passwordConfirmation"
              validators={{
                onChangeListenTo: ['password'],
                onChange: ({ value, fieldApi }) => {
                  const password = fieldApi.form.getFieldValue('password')
                  // Nothing to confirm yet while the password is empty.
                  if (!password) return undefined
                  if (!value) return 'Please confirm your password'
                  if (value !== password) return 'Passwords do not match'
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Confirm password</Label>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="new-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldInfo field={field} />
                </div>
              )}
            </form.Field>
          </div>

          <form.Subscribe selector={(state) => state.values.password}>
            {(password) => (
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs">
                  Choose a strong password:
                </p>
                <PasswordRequirements value={password} />
              </div>
            )}
          </form.Subscribe>

          {register.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(register.error)}
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
                disabled={!canSubmit || register.isPending}
              >
                {isSubmitting || register.isPending
                  ? 'Creating account…'
                  : 'Create account'}
              </Button>
            )}
          </form.Subscribe>

          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-brand font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
