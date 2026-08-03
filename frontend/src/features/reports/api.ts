import api from "@/lib/api";
import type { ReportDataset, ReportPeriod } from "./types";

interface Wrapped<T> {
  data: T;
}

export interface ReportParams {
  schoolYearId?: number;
  period: ReportPeriod;
}

export async function fetchReports(params: ReportParams): Promise<ReportDataset> {
  const { data } = await api.get<Wrapped<ReportDataset>>("/admin/reports", {
    params: {
      school_year_id: params.schoolYearId,
      period: params.period,
    },
  });
  return data.data;
}
