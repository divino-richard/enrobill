import api from "@/lib/api";
import type { AuthResponse, LoginCredentials } from "./types";

// POST /api/login — exchanges credentials for a Sanctum token + user.
export async function login(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/login", credentials);
  return data;
}
