import { semesterLabel } from "@/features/terms/types";

export interface FeeStructureItem {
  id?: number;
  name: string;
  amount: number;
}

export interface FeeStructure {
  id: number;
  termId: number;
  schoolYear: string | null;
  semester: string | null;
  track: string;
  yearLevel: string;
  items: FeeStructureItem[];
  total: number;
  createdAt: string | null;
}

export function structureTermLabel(structure: FeeStructure): string {
  if (!structure.schoolYear) return "—";
  return `${semesterLabel(structure.semester ?? "")} · SY ${structure.schoolYear}`;
}
