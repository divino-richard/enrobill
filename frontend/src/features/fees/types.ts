import {
  TRACK_STRAND_OPTIONS,
  YEAR_LEVEL_OPTIONS,
  labelFor,
} from "@/features/applications/types";
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

export function programLabel(track: string, yearLevel: string): string {
  return `${labelFor(TRACK_STRAND_OPTIONS, track)} · ${labelFor(
    YEAR_LEVEL_OPTIONS,
    yearLevel,
  )}`;
}

export function structureTermLabel(structure: FeeStructure): string {
  if (!structure.schoolYear) return "—";
  return `${semesterLabel(structure.semester ?? "")} · SY ${structure.schoolYear}`;
}
