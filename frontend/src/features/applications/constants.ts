import {
  BookOpenIcon,
  ClipboardCheckIcon,
  GraduationCapIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type {
  Application,
  ApplicationFormValues,
  TextFieldKey,
} from "./types";

export interface WizardStep {
  title: string;
  // Short label for the compact (mobile) stepper.
  shortTitle: string;
  description: string;
  icon: LucideIcon;
}

// The 4 content steps + a final review/preview step.
export const WIZARD_STEPS: WizardStep[] = [
  {
    title: "Personal & Address",
    shortTitle: "Personal",
    description: "Your basic personal details",
    icon: UserRoundIcon,
  },
  {
    title: "Contact & Guardian",
    shortTitle: "Contact",
    description: "How we can reach you",
    icon: UsersIcon,
  },
  {
    title: "Academic & Documents",
    shortTitle: "Academic",
    description: "School records and files",
    icon: GraduationCapIcon,
  },
  {
    title: "Course & Strand",
    shortTitle: "Course",
    description: "The program you're applying for",
    icon: BookOpenIcon,
  },
  {
    title: "Review",
    shortTitle: "Review",
    description: "Confirm and submit",
    icon: ClipboardCheckIcon,
  },
];

export const REVIEW_STEP = WIZARD_STEPS.length - 1;

// Fields validated when leaving each step (by index). Later steps are
// placeholders for now, so they have nothing to validate yet.
export const STEP_FIELDS: Record<number, TextFieldKey[]> = {
  0: [
    "surname",
    "givenName",
    "dateOfBirth",
    "gender",
    "nationality",
    "civilStatus",
    "placeOfBirth",
    "addressProvince",
    "addressCity",
    "addressBarangay",
    "addressStreet",
  ],
  1: [
    "homeAddress",
    "mailingAddress",
    "phoneNumber",
    "emailAddress",
    "guardianName",
    "guardianRelation",
    "guardianContactNumber",
    "guardianAddress",
    "guardianOccupation",
  ],
  2: [
    "prevSchoolName",
    "prevSchoolGradeLevel",
    "prevSchoolType",
    "prevSchoolAddress",
    "prevSchoolYearGraduated",
  ],
  3: [
    "trackOrStrand",
    "yearLevel",
    "schoolYear",
    "declarationStudentName",
    "declarationGuardianName",
  ],
  4: [],
};

// Fields validated when advancing a step but excluded from the text-based
// "filled" counter: non-text required fields (e.g. the document uploads on the
// academic step, which have their own progress indicator) and optional text
// fields that still enforce a format — middleName/religion reject digits but must
// not count toward the required total.
export const STEP_EXTRA_VALIDATED_FIELDS: Record<
  number,
  (keyof ApplicationFormValues)[]
> = {
  0: ["middleName", "religion"],
  2: [
    "prevSchoolGpa",
    "documents",
    "documentPromissoryNote",
    "documentPromissoryDate",
  ],
  3: ["agreementAccepted"],
};

// Mock applications for an aspiring student. One active (under review) plus a
// previous, rejected attempt from an earlier intake. Set this to [] to preview
// the empty state.
export const MOCK_APPLICATIONS: Application[] = [
  {
    id: 2,
    reference: "APP-2026-001245",
    program: "BS Information Technology",
    programCode: "STEM",
    yearLevel: "grade_12",
    schoolYear: "2026–2027",
    status: "under_review",
    decisionNote: null,
    submittedAt: "2026-06-12T08:30:00Z",
    updatedAt: "2026-06-14T10:05:00Z",
  },
  {
    id: 1,
    reference: "APP-2025-000871",
    program: "BS Information Technology",
    programCode: "STEM",
    yearLevel: "grade_11",
    schoolYear: "2025–2026",
    status: "rejected",
    decisionNote: "Incomplete documents — please attach your Grade 10 report card and resubmit.",
    submittedAt: "2025-06-03T02:15:00Z",
    updatedAt: "2025-06-20T07:40:00Z",
  },
];
