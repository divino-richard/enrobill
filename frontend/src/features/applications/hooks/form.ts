import { useForm } from "@tanstack/react-form";
import { type ApplicationFormValues } from "../types";

export const DEFAULT_APPLICATION_FORM_VALUES: ApplicationFormValues = {
  enrollmentType: "",
  surname: "",
  givenName: "",
  middleName: "",
  extension: "",
  dateOfBirth: "",
  age: "",
  gender: "",
  nationality: "Filipino",
  civilStatus: "",
  placeOfBirth: "",
  religion: "",
  healthConcerns: "",
  addressStreet: "",
  addressBrangay: "",
  addressCity: "",
  addressProvince: "",
};

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
