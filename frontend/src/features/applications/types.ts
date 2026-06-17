export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "returned"
  | "accepted"
  | "rejected";

export interface Application {
  id: string;
  reference: string;
  program: string;
  schoolYear: string;
  semester: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  updatedAt: string;
}

// Statuses that count as an in-progress application (only one allowed at a time).
export const ACTIVE_STATUSES: ApplicationStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "returned",
];

export type EnrollmentType = "" | "senior_high" | "college";
export type Gender = "" | "male" | "female";

// Whole-application form values. Step 1 fields are implemented now; later steps
// (contact/guardian, academic/documents, course/strand) will add their fields.
export interface ApplicationFormValues {
  // Enrollment Information
  enrollmentType: EnrollmentType;
  // Personal Information
  surname: string;
  givenName: string;
  middleName: string;
  extension: string;
  dateOfBirth: string; // 'yyyy-MM-dd'
  age: string; // auto-calculated from dateOfBirth
  gender: Gender;
  nationality: string;
  civilStatus: string;
  placeOfBirth: string;
  religion: string;
  healthConcerns: string;
  addressStreet: string;
  addressBrangay: string;
  addressCity: string;
  addressProvince: string;
  homeAddress: string;
  mailingAddress: string;
  phoneNumber: string;
  emailAddress: string;
  facebookAccount: string;
  guardianName: string;
  guardianRelation: string;
  guardianContactNumber: string;
  guardianAddress: string;
  guardianOccupation: string;
}

export const ENROLLMENT_TYPE_OPTIONS = [
  { value: "senior_high", label: "Senior High School" },
  { value: "college", label: "College" },
] as const;

export const CIVIL_STATUS_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "divorced", label: "Divorced" },
] as const;

// Human-readable label lookups (used by the review step).
export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? "—";
}

export function isActiveStatus(status: ApplicationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

interface StatusMeta {
  label: string;
  // Soft badge colours per status.
  className: string;
  // Short explanation shown on the current-application card.
  description: string;
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  draft: {
    label: "Draft",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    description: "Finish and submit your application for review.",
  },
  submitted: {
    label: "Submitted",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    description:
      "Your application has been submitted and is queued for review.",
  },
  under_review: {
    label: "Under Review",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
    description: "The registrar is currently reviewing your application.",
  },
  returned: {
    label: "Returned",
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
    description: "Action needed — update the requested details and resubmit.",
  },
  accepted: {
    label: "Accepted",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    description: "Congratulations! Your application has been accepted.",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    description: "This application was not approved.",
  },
};
