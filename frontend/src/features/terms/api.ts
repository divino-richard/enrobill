import api from "@/lib/api";
import type { Term, TermInput } from "./types";

interface Wrapped<T> {
  data: T;
}

export async function fetchTerms(): Promise<Term[]> {
  const { data } = await api.get<Wrapped<Term[]>>("/admin/terms");
  return data.data;
}

export async function createTerm(input: TermInput): Promise<Term> {
  const { data } = await api.post<Wrapped<Term>>("/admin/terms", input);
  return data.data;
}

export async function setTermOpen(id: number, isOpen: boolean): Promise<Term> {
  const { data } = await api.put<Wrapped<Term>>(`/admin/terms/${id}`, {
    isOpen,
  });
  return data.data;
}

export async function deleteTerm(id: number): Promise<void> {
  await api.delete(`/admin/terms/${id}`);
}
