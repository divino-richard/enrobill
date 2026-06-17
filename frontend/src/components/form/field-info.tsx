import type { AnyFieldApi } from "@tanstack/react-form";

interface FieldInfoProps {
  field: AnyFieldApi;
}

// Renders validation errors for a TanStack Form field, once it's been touched.
// Reusable across any feature's forms.
export function FieldInfo({ field }: FieldInfoProps) {
  const { isTouched, errors } = field.state.meta;

  if (!isTouched || errors.length === 0) return null;

  return (
    <p className="text-xs text-destructive">
      {errors.filter(Boolean).join(", ")}
    </p>
  );
}
