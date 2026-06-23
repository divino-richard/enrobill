import api from "@/lib/api";
import type { Freebie, FreebieUpsertInput } from "./types";

interface Wrapped<T> {
  data: T;
}

// All freebies (promos) configured for a school year.
export async function fetchSchoolYearFreebies(
  schoolYearId: number,
): Promise<Freebie[]> {
  const { data } = await api.get<{ data: Freebie[] }>(
    `/admin/school-years/${schoolYearId}/freebies`,
  );
  return data.data;
}

// Create or update a school year's freebie of a given type.
export async function upsertFreebie(
  schoolYearId: number,
  input: FreebieUpsertInput,
): Promise<Freebie> {
  const { data } = await api.put<Wrapped<Freebie>>(
    `/admin/school-years/${schoolYearId}/freebies`,
    input,
  );
  return data.data;
}

// The freebies a pending enrollment qualifies for (shown at bill generation).
export async function fetchEligibleFreebies(
  enrollmentId: number,
): Promise<Freebie[]> {
  const { data } = await api.get<{ data: Freebie[] }>(
    `/admin/enrollments/${enrollmentId}/freebies`,
  );
  return data.data;
}
