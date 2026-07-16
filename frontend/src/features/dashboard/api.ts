import api from "@/lib/api";
import type { Role } from "@/features/auth/types";

export interface StaffDashboard {
  role: Role;
  openTerm: {
    schoolYear: string;
    admissionOpen: boolean;
    progressionOpen: boolean;
  } | null;
  finance: {
    billed: number;
    collected: number;
    outstanding: number;
    collectionRate: number;
    pendingPayments: number;
    bills: { total: number; unpaid: number; partial: number; paid: number };
  };
  operations: {
    pendingEnrollments: number;
  };
  trend: {
    admissions: Array<{
      month: string;
      submitted: number;
      admitted: number;
      enrolled: number;
    }>;
    finance: Array<{
      month: string;
      billed: number;
      collected: number;
    }>;
  };
  // Admins only.
  enrollment?: {
    applications: {
      pending: number;
      submitted: number;
      underReview: number;
      returned: number;
      total: number;
    };
    sections: {
      unsectioned: number;
    };
    progression: {
      open: boolean;
      pendingDecisions: number;
      nextYearReady: boolean;
    };
  };
}

interface Wrapped<T> {
  data: T;
}

export async function fetchStaffDashboard(): Promise<StaffDashboard> {
  const { data } = await api.get<Wrapped<StaffDashboard>>("/admin/dashboard");
  return data.data;
}
