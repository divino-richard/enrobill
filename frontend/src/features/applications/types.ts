import type { UploadedDocument } from "./documents";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "returned"
  | "accepted"
  | "rejected";

export interface Application {
  id: number;
  reference: string;
  program: string;
  schoolYear: string;
  semester: string;
  status: ApplicationStatus;
  decisionNote: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

// A single application with its full submitted answers (detail / edit screens).
export interface ApplicationDetail extends Application {
  values: ApplicationFormValues;
}

// The applicant who owns an application (included in admin listings).
export interface ApplicationApplicant {
  id: number;
  name: string;
  email: string;
}

// An application as seen by staff, with the owning applicant attached.
export interface AdminApplication extends Application {
  applicant: ApplicationApplicant;
}

// A single application for staff review: full answers + the applicant.
export interface AdminApplicationDetail extends ApplicationDetail {
  applicant: ApplicationApplicant;
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
  addressBarangay: string;
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
  prevSchoolName: string;
  prevSchoolGradeLevel: string;
  prevSchoolAddress: string;
  prevSchoolYearGraduated: string;
  prevSchoolGpa: string;
  prevSchoolType: string;
  // Previous-school verification documents uploaded to S3.
  documents: UploadedDocument[];
  // Promissory note used when the applicant can't yet provide every required
  // document — a written commitment plus the estimated date to comply.
  documentPromissoryNote: string;
  documentPromissoryDate: string; // 'yyyy-MM-dd'
  // Course & Strand Selection
  trackOrStrand: string;
  yearLevel: string;
  semester: string;
  schoolYear: string;
  // Declaration / electronic signature
  declarationStudentName: string;
  declarationGuardianName: string;
  dateSigned: string; // ISO timestamp, auto-populated
  agreementAccepted: boolean;
}

// Keys of the form whose value is a plain string. The step counter and
// validation gate operate on these (the `documents` array is handled
// separately), so narrowing here keeps those helpers type-safe.
export type TextFieldKey = {
  [K in keyof ApplicationFormValues]: ApplicationFormValues[K] extends string
    ? K
    : never;
}[keyof ApplicationFormValues];

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

// Track / strand options come from the admin-managed program catalog
// (@/features/programs). Year level, semester and enrollment type are fixed.

export const YEAR_LEVEL_OPTIONS = [
  { value: "grade_11", label: "Grade 11" },
  { value: "grade_12", label: "Grade 12" },
] as const;

export const SEMESTER_OPTIONS = [
  { value: "first", label: "1st Semester" },
  { value: "second", label: "2nd Semester" },
] as const;

export const SCHOOL_TYPE_OPTIONS = [
  { value: "Public", label: "Public" },
  { value: "Private", label: "Private" },
  { value: "Vocational", label: "Vocational" },
] as const;

// Shown beside the agreement checkbox in the Declaration section.
export const DECLARATION_AGREEMENT_TEXT =
  "I agree that the information I provided will be processed and stored in " +
  "accordance with the school's data privacy, and I hereby declare that all " +
  "information provided is true and correct to the best of my knowledge. I " +
  "understand that any false information may result in the cancellation of my " +
  "enrollment.";

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
