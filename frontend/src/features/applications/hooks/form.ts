import { useForm } from "@tanstack/react-form";
import {
  DEFAULT_APPLICATION_FORM_VALUES,
  type ApplicationFormValues,
} from "../types";

// Single form instance for the whole multi-step application. Wrapping useForm in
// a hook lets us derive a precise `ApplicationFormApi` type for the step
// components without re-declaring TanStack Form's generics.
export function useApplicationForm(
  onSubmit: (values: ApplicationFormValues) => void | Promise<void>,
) {
  return useForm({
    defaultValues: DEFAULT_APPLICATION_FORM_VALUES,
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}

export type ApplicationFormApi = ReturnType<typeof useApplicationForm>;
