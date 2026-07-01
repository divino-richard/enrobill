import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { type ApplicationFormValues } from "../types";

export const DEFAULT_APPLICATION_FORM_VALUES: ApplicationFormValues = {
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
  documentPromissoryNote: "",
  documentPromissoryDate: "",
  trackOrStrand: "",
  yearLevel: "",
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
const DRAFT_STORAGE_KEY = "enrobill:application-draft:v3";

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

interface UseApplicationFormOptions {
  // Seed the form with these values instead of the saved draft (edit mode).
  initialValues?: ApplicationFormValues;
  // Whether to restore/auto-save the localStorage draft. Off for editing an
  // existing application so we don't clobber a new-application draft.
  persistDraft?: boolean;
  // In create mode, the contact email is locked to the applicant's verified
  // account email so the application always carries their login address.
  accountEmail?: string;
}

// Single form instance for the whole multi-step application. Wrapping useForm in
// a hook lets us derive a precise `ApplicationFormApi` type for the step
// components without re-declaring TanStack Form's generics. In create mode it
// restores any saved draft and auto-saves changes; in edit mode it is seeded
// with the application's values and does not touch the draft.
export function useApplicationForm(
  onSubmit: (values: ApplicationFormValues) => void | Promise<void>,
  options: UseApplicationFormOptions = {},
) {
  const { initialValues, persistDraft = true, accountEmail } = options;

  // Seed once: provided values (edit) or the saved draft (create). In create
  // mode, force the contact email to the verified account email so it can't
  // drift from the applicant's login.
  const [defaults] = useState(() => {
    const base = initialValues ?? loadApplicationDraft();
    return !initialValues && accountEmail
      ? { ...base, emailAddress: accountEmail }
      : base;
  });

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  // Auto-save: debounce-write the latest values whenever the form changes.
  useEffect(() => {
    if (!persistDraft) return;
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
  }, [form, persistDraft]);

  return form;
}

export type ApplicationFormApi = ReturnType<typeof useApplicationForm>;
