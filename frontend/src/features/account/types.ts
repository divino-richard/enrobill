import type { Role } from "@/features/auth/types";

// The authenticated user's own account, including name parts for editing.
export interface AccountProfile {
  id: number;
  name: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  role: Role;
}

export interface ProfileFormValues {
  firstName: string;
  middleName: string;
  lastName: string;
}

export interface PasswordFormValues {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}
