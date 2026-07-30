import { create } from "zustand";
import type { TransferRequest, TransferRequestStatus } from "./types";

// UI-preview only — no backend endpoint yet, so this is in-memory and resets on reload.
const INITIAL_REQUESTS: TransferRequest[] = [
  {
    id: 1,
    studentId: 9001,
    studentName: "Miguel Santos",
    studentNumber: "2024-00123",
    fromProgramCode: "stem",
    fromProgramName: "STEM (Science, Technology, Engineering, Mathematics)",
    toProgramCode: "ict",
    toProgramName: "ICT (Information & Communications Technology)",
    reason:
      "I've realized my interest leans toward software development rather than the pure sciences track.",
    status: "pending",
    requestedAt: "2026-07-21T09:15:00+08:00",
    decidedAt: null,
    decisionNote: null,
  },
  {
    id: 2,
    studentId: 9002,
    studentName: "Andrea Bautista",
    studentNumber: "2024-00456",
    fromProgramCode: "abm",
    fromProgramName: "BE-ABM (Accounting, Business & Management)",
    toProgramCode: "assh",
    toProgramName: "ASSH (Humanities & Social Sciences)",
    reason:
      "My family is relocating and our new school district only offers the humanities track.",
    status: "pending",
    requestedAt: "2026-07-24T13:40:00+08:00",
    decidedAt: null,
    decisionNote: null,
  },
  {
    id: 3,
    studentId: 9003,
    studentName: "Josef Lim",
    studentNumber: "2023-00789",
    fromProgramCode: "gas",
    fromProgramName: "GAS (General Academic Strand)",
    toProgramCode: "hospitality",
    toProgramName: "Hospitality",
    reason:
      "I want hands-on training that matches the college course I'm planning to take.",
    status: "approved",
    requestedAt: "2026-06-30T10:05:00+08:00",
    decidedAt: "2026-07-02T08:30:00+08:00",
    decisionNote: "Approved — slot available and prerequisites met.",
  },
  {
    id: 4,
    studentId: 9004,
    studentName: "Carla Mendoza",
    studentNumber: "2024-00988",
    fromProgramCode: "ict",
    fromProgramName: "ICT (Information & Communications Technology)",
    toProgramCode: "stem",
    toProgramName: "STEM (Science, Technology, Engineering, Mathematics)",
    reason: "I want to shift into the sciences track.",
    status: "rejected",
    requestedAt: "2026-07-10T11:00:00+08:00",
    decidedAt: "2026-07-12T15:20:00+08:00",
    decisionNote: "STEM is already at full section capacity for this year level.",
  },
];

interface TransferRequestInput {
  studentId: number;
  studentName: string;
  studentNumber: string;
  fromProgramCode: string;
  fromProgramName: string;
  toProgramCode: string;
  toProgramName: string;
  reason: string;
}

interface ProgramTransferState {
  requests: TransferRequest[];
  submitRequest: (input: TransferRequestInput) => void;
  decide: (
    id: number,
    status: Extract<TransferRequestStatus, "approved" | "rejected">,
    note: string | null,
  ) => void;
}

export const useProgramTransferStore = create<ProgramTransferState>((set) => ({
  requests: INITIAL_REQUESTS,
  submitRequest: (input) =>
    set((state) => ({
      requests: [
        {
          ...input,
          id: Math.max(0, ...state.requests.map((r) => r.id)) + 1,
          status: "pending",
          requestedAt: new Date().toISOString(),
          decidedAt: null,
          decisionNote: null,
        },
        ...state.requests,
      ],
    })),
  decide: (id, status, note) =>
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id
          ? { ...r, status, decidedAt: new Date().toISOString(), decisionNote: note }
          : r,
      ),
    })),
}));

export function usePendingTransferCount() {
  return useProgramTransferStore(
    (state) => state.requests.filter((r) => r.status === "pending").length,
  );
}
