import api from "@/lib/api";
import type { Role } from "@/features/auth/types";

export interface StaffDashboard {
  role: Role;
  openTerm: { schoolYear: string; semester: string } | null;
  finance: {
    billed: number;
    collected: number;
    outstanding: number;
    collectionRate: number;
    pendingPayments: number;
    bills: { total: number; unpaid: number; partial: number; paid: number };
  };
  // Admins only.
  enrollment?: {
    students: { total: number; enrolled: number; admitted: number };
    applications: { pending: number; total: number };
  };
}

interface Wrapped<T> {
  data: T;
}

export async function fetchStaffDashboard(): Promise<StaffDashboard> {
  const { data } = await api.get<Wrapped<StaffDashboard>>("/admin/dashboard");
  return data.data;
}
