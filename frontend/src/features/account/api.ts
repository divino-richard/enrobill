import api from "@/lib/api";
import type {
  AccountProfile,
  PasswordFormValues,
  ProfileFormValues,
} from "./types";

interface Wrapped<T> {
  data: T;
}

// The authenticated user's account (GET /me).
export async function fetchAccount(): Promise<AccountProfile> {
  const { data } = await api.get<Wrapped<AccountProfile>>("/me");
  return data.data;
}

// Update the user's own name.
export async function updateProfile(
  values: ProfileFormValues,
): Promise<AccountProfile> {
  const { data } = await api.put<Wrapped<AccountProfile>>("/me/profile", values);
  return data.data;
}

// Change the user's own password.
export async function updatePassword(
  values: PasswordFormValues,
): Promise<{ message: string }> {
  const { data } = await api.put<{ message: string }>("/me/password", {
    currentPassword: values.currentPassword,
    password: values.password,
    password_confirmation: values.passwordConfirmation,
  });
  return data;
}
