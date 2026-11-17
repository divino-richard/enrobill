import api from "@/lib/api";
import type { YearLevel } from "@/features/applications/types";
import type { BillStatus } from "@/features/bills/types";
import type { EnrollmentStatus } from "@/features/enrollments/types";
import type { ReportDataset, ReportPeriod } from "./types";

interface Wrapped<T> {
  data: T;
}

export interface ReportParams {
  schoolYearId?: number;
  period: ReportPeriod;
  yearLevel?: YearLevel;
  program?: string;
  sectionId?: string;
  enrollmentStatus?: EnrollmentStatus;
  billingStatus?: BillStatus | "unbilled";
}

export async function fetchReports(params: ReportParams): Promise<ReportDataset> {
  const { data } = await api.get<Wrapped<ReportDataset>>("/admin/reports", {
    params: {
      school_year_id: params.schoolYearId,
      period: params.period,
      year_level: params.yearLevel,
      program: params.program,
      section_id: params.sectionId,
      enrollment_status: params.enrollmentStatus,
      billing_status: params.billingStatus,
    },
  });
  return data.data;
}
