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
  const { data } = await api.get<Wrapped<Term[]>>("/admin/school-years");
  return data.data;
}

// The school year currently admitting, or null when admissions are closed.
// Readable by applicants (not admin-only).
export async function fetchOpenTerm(): Promise<OpenTerm | null> {
  const { data } = await api.get<Wrapped<OpenTerm | null>>("/open-term");
  return data.data;
}

export async function createTerm(input: TermInput): Promise<Term> {
  const { data } = await api.post<Wrapped<Term>>("/admin/school-years", input);
  return data.data;
}

// Toggle a school year's active state, admission window, or progression window.
export async function updateTermStatus(
  id: number,
  changes: {
    isActive?: boolean;
    admissionOpen?: boolean;
    // null clears the override (follow the schedule); true/false force it.
    progressionOpen?: boolean | null;
  },
): Promise<Term> {
  const { data } = await api.put<Wrapped<Term>>(
    `/admin/school-years/${id}`,
    changes,
  );
  return data.data;
}

export async function updateTermPolicy(
  id: number,
  input: InstallmentPolicyInput,
): Promise<Term> {
  const { data } = await api.put<Wrapped<Term>>(
    `/admin/school-years/${id}/installment-policy`,
    input,
  );
  return data.data;
}

export async function deleteTerm(id: number): Promise<void> {
  await api.delete(`/admin/school-years/${id}`);
}
