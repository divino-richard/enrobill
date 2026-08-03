import { useQuery } from "@tanstack/react-query";
import { fetchReports, type ReportParams } from "./api";

export const reportsQueryKey = ["admin", "reports"] as const;

export function useReports(params: ReportParams) {
  return useQuery({
    queryKey: [...reportsQueryKey, params],
    queryFn: () => fetchReports(params),
    enabled: params.schoolYearId !== undefined,
  });
}
