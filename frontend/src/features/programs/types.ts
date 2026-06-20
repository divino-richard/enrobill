export interface ProgramFeeItem {
  id?: number;
  name: string;
  amount: number;
}

export interface Program {
  id: number;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  feeItems?: ProgramFeeItem[];
}

export interface ProgramGroup {
  label: string;
  options: { value: string; label: string }[];
}

// Group active programs by category for grouped <Select> dropdowns.
export function groupActivePrograms(programs: Program[]): ProgramGroup[] {
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const program of programs) {
    if (!program.isActive) continue;
    const options = groups.get(program.category) ?? [];
    options.push({ value: program.code, label: program.name });
    groups.set(program.category, options);
  }
  return [...groups.entries()].map(([label, options]) => ({ label, options }));
}
