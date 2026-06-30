import api from "@/lib/api";
import type { Role } from "@/features/auth/types";

export interface StaffDashboard {
  role: Role;
  openTerm: {
    schoolYear: string;
    semester: string;
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
    students: {
      total: number;
      admitted: number;
      enrolled: number;
      inactive: number;
      graduated: number;
      dropped: number;
    };
    applications: {
      pending: number;
      submitted: number;
      underReview: number;
      returned: number;
      total: number;
    };
    enrollments: {
      totalCurrent: number;
      pending: number;
      enrolled: number;
      completed: number;
      dropped: number;
      withdrawn: number;
    };
    sections: {
      active: number;
      unsectioned: number;
    };
    progression: {
      open: boolean;
      pendingDecisions: number;
      decided: number;
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
