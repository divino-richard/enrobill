// Password strength policy, shared by the register form's validator and the
// live requirements checklist. Mirrors the backend rules:
// at least 8 characters, with an uppercase letter, and a number.
export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
]

export function passwordIsStrong(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required'
  if (!passwordIsStrong(value)) {
    return 'Use 8+ characters with an uppercase letter and a number'
  }
  return undefined
}
