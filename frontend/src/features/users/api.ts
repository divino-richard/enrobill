import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type { CreateUserInput, User, UserRole } from "./types";

interface Wrapped<T> {
  data: T;
}

export type UserListParams = ListParams & { verified?: string; joined?: string };

export interface UsersPage {
  rows: User[];
  meta: PageMeta;
}

// Paginated / searchable / sortable list of users (admin only).
export async function fetchUsers(params: UserListParams): Promise<UsersPage> {
  const { data } = await api.get<LaravelPaginated<User>>("/users", {
    params: { ...listParamsToQuery(params), verified: params.verified, joined: params.joined },
  });

  return { rows: data.data, meta: toPageMeta(data.meta) };
}

// A single user (admin only).
export async function fetchUser(id: number): Promise<User> {
  const { data } = await api.get<Wrapped<User>>(`/users/${id}`);
  return data.data;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const { data } = await api.post<Wrapped<User>>("/users", {
    first_name: input.firstName,
    middle_name: input.middleName || null,
    last_name: input.lastName,
    email: input.email,
    role: input.role,
    password: input.password,
    password_confirmation: input.passwordConfirmation,
  });
  return data.data;
}

// Update a user's role (admin only).
export async function updateUserRole(
  id: number,
  role: UserRole,
): Promise<User> {
  const { data } = await api.put<Wrapped<User>>(`/users/${id}`, { role });
  return data.data;
}
