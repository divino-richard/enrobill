// Shared field validators for the application wizard.
type FieldValidator = (ctx: { value: string }) => string | undefined;

// Presence check — the field must hold non-whitespace text.
export function required(message: string): FieldValidator {
  return ({ value }) => (value && value.trim() ? undefined : message);
}

// Rejects any digit (0-9).
export function noDigits(message: string): FieldValidator {
  return ({ value }) => (value && /\d/.test(value) ? message : undefined);
}

// Requires a number within [min, max] inclusive (decimals allowed).
export function numericRange(
  min: number,
  max: number,
  message: string,
): FieldValidator {
  return ({ value }) => {
    if (!value || !value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      return message;
    }
    return undefined;
  };
}

// Requires a proper "YYYY-YYYY" school year whose two years are consecutive
// (e.g. 2024-2025). A blank value passes, so pair it with `required` when the
// field is mandatory.
const SCHOOL_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;

export function schoolYear(message: string): FieldValidator {
  return ({ value }) => {
    if (!value || !value.trim()) return undefined;
    const match = SCHOOL_YEAR_PATTERN.exec(value.trim());
    if (!match || Number(match[2]) !== Number(match[1]) + 1) {
      return message;
    }
    return undefined;
  };
}

// Runs validators left to right and returns the first error, so a name field can
// require presence and reject digits from one `onChange`.
export function compose(...validators: FieldValidator[]): FieldValidator {
  return (ctx) => {
    for (const validate of validators) {
      const error = validate(ctx);
      if (error) return error;
    }
    return undefined;
  };
}
