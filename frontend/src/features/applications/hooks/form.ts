import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { type ApplicationFormValues } from "../types";

export const DEFAULT_APPLICATION_FORM_VALUES: ApplicationFormValues = {
  enrollmentType: "senior_high",
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
  addressBarangay: "",
  addressCity: "",
  addressProvince: "",
  homeAddress: "",
  mailingAddress: "",
  phoneNumber: "",
  emailAddress: "",
  facebookAccount: "",
  guardianName: "",
  guardianRelation: "",
  guardianContactNumber: "",
  guardianAddress: "",
  guardianOccupation: "",
  prevSchoolName: "",
  prevSchoolGradeLevel: "",
  prevSchoolAddress: "",
  prevSchoolYearGraduated: "",
  prevSchoolGpa: "",
  prevSchoolType: "",
  documents: [],
  trackOrStrand: "",
  yearLevel: "",
  semester: "",
  schoolYear: "",
  declarationStudentName: "",
  declarationGuardianName: "",
  dateSigned: "",
  agreementAccepted: false,
};

// --- Draft persistence -------------------------------------------------------
// The in-progress application is auto-saved to localStorage so an applicant can
// leave and come back without losing work. Bump the version suffix whenever the
// field structure changes, so drafts saved against an older shape are ignored
// rather than restored into a mismatched form.
const DRAFT_STORAGE_KEY = "enrobill:application-draft:v1";

// How long to wait after the last change before writing to storage.
const DRAFT_SAVE_DEBOUNCE_MS = 500;

export function loadApplicationDraft(): ApplicationFormValues {
  if (typeof window === "undefined") return DEFAULT_APPLICATION_FORM_VALUES;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return DEFAULT_APPLICATION_FORM_VALUES;
    const parsed = JSON.parse(raw) as Partial<ApplicationFormValues>;
    // Merge over the defaults so any newly added field is always present.
    return { ...DEFAULT_APPLICATION_FORM_VALUES, ...parsed };
  } catch {
    return DEFAULT_APPLICATION_FORM_VALUES;
  }
}

export function saveApplicationDraft(values: ApplicationFormValues): void {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Best-effort: ignore quota / serialization errors.
  }
}

export function clearApplicationDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

// Single form instance for the whole multi-step application. Wrapping useForm in
// a hook lets us derive a precise `ApplicationFormApi` type for the step
// components without re-declaring TanStack Form's generics. It also restores any
// saved draft on mount and auto-saves changes back to localStorage.
export function useApplicationForm(
  onSubmit: (values: ApplicationFormValues) => void | Promise<void>,
) {
  // Restore the saved draft (if any) as the initial values, once.
  const [initialValues] = useState(loadApplicationDraft);

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  // Auto-save: debounce-write the latest values whenever the form changes.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const subscription = form.store.subscribe(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveApplicationDraft(form.state.values);
      }, DRAFT_SAVE_DEBOUNCE_MS);
    });
    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [form]);

  return form;
}

export type ApplicationFormApi = ReturnType<typeof useApplicationForm>;
