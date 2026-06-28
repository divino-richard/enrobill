import api from "@/lib/api";
import type {
  Section,
  SectionFilters,
  SectionInput,
  SectionUpdateInput,
  UnsectionedStudent,
} from "./types";

interface Wrapped<T> {
  data: T;
}

function filterParams(filters: SectionFilters) {
  return {
    ...(filters.schoolYearId ? { schoolYearId: filters.schoolYearId } : {}),
    ...(filters.program ? { program: filters.program } : {}),
    ...(filters.yearLevel ? { yearLevel: filters.yearLevel } : {}),
  };
}

// Sections (with rosters + occupancy) for the given scope.
export async function fetchSections(
  filters: SectionFilters,
): Promise<Section[]> {
  const { data } = await api.get<Wrapped<Section[]>>("/admin/sections", {
    params: filterParams(filters),
  });
  return data.data;
}

// Enrolled students in scope not yet placed in a section.
export async function fetchUnsectioned(
  filters: SectionFilters,
): Promise<UnsectionedStudent[]> {
  const { data } = await api.get<Wrapped<UnsectionedStudent[]>>(
    "/admin/sections/unsectioned",
    { params: filterParams(filters) },
  );
  return data.data;
}

export async function createSection(input: SectionInput): Promise<Section> {
  const { data } = await api.post<Wrapped<Section>>("/admin/sections", input);
  return data.data;
}

export async function updateSection(
  id: number,
  input: SectionUpdateInput,
): Promise<Section> {
  const { data } = await api.put<Wrapped<Section>>(
    `/admin/sections/${id}`,
    input,
  );
  return data.data;
}

export async function deleteSection(id: number): Promise<void> {
  await api.delete(`/admin/sections/${id}`);
}

// Place / move (sectionId) or unassign (null) an enrollment.
export async function assignSection(
  enrollmentId: number,
  sectionId: number | null,
): Promise<void> {
  await api.put(`/admin/enrollments/${enrollmentId}/section`, { sectionId });
}
