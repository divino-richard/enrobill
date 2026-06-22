import api from "@/lib/api";
import type {
  InstallmentPolicyInput,
  OpenTerm,
  Term,
  TermInput,
} from "./types";

interface Wrapped<T> {
  data: T;
}

export async function fetchTerms(): Promise<Term[]> {
  const { data } = await api.get<Wrapped<Term[]>>("/admin/terms");
  return data.data;
}

// The currently open enrollment term, or null when enrollment is closed.
// Readable by applicants (not admin-only).
export async function fetchOpenTerm(): Promise<OpenTerm | null> {
  const { data } = await api.get<Wrapped<OpenTerm | null>>("/open-term");
  return data.data;
}

export async function createTerm(input: TermInput): Promise<Term> {
  const { data } = await api.post<Wrapped<Term>>("/admin/terms", input);
  return data.data;
}

// Toggle a term's active state and/or its admission window.
export async function updateTermStatus(
  id: number,
  changes: { isActive?: boolean; admissionOpen?: boolean },
): Promise<Term> {
  const { data } = await api.put<Wrapped<Term>>(`/admin/terms/${id}`, changes);
  return data.data;
}

export async function updateTermPolicy(
  id: number,
  input: InstallmentPolicyInput,
): Promise<Term> {
  const { data } = await api.put<Wrapped<Term>>(
    `/admin/terms/${id}/installment-policy`,
    input,
  );
  return data.data;
}

export async function deleteTerm(id: number): Promise<void> {
  await api.delete(`/admin/terms/${id}`);
}
