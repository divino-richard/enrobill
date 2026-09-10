export type UserRole = "admin" | "cashier" | "teacher" | "student" | "applicant";

export interface User {
  id: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string | null;
}

export const USER_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "cashier", label: "Cashier" },
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "applicant", label: "Applicant" },
] as const;

export type CreatableUserRole = Extract<UserRole, "admin" | "cashier" | "teacher">;

export const CREATABLE_USER_ROLE_OPTIONS: ReadonlyArray<{
  value: CreatableUserRole;
  label: string;
}> = [
  { value: "admin", label: "Admin" },
  { value: "cashier", label: "Cashier" },
  { value: "teacher", label: "Teacher" },
];

// Soft badge colours per role.
export const USER_ROLE_META: Record<
  UserRole,
  { label: string; className: string }
> = {
  admin: {
    label: "Admin",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  },
  cashier: {
    label: "Cashier",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
  teacher: {
    label: "Teacher",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  student: {
    label: "Student",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  applicant: {
    label: "Applicant",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
  },
};

export interface CreateUserInput {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: CreatableUserRole;
  password: string;
  passwordConfirmation: string;
}
