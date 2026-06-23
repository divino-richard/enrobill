import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchEnrollments, type EnrollmentListParams } from "./api";

export const enrollmentsQueryKey = ["admin", "enrollments"] as const;

export function useEnrollments(params: EnrollmentListParams) {
  return useQuery({
    queryKey: [...enrollmentsQueryKey, "list", params],
    queryFn: () => fetchEnrollments(params),
    placeholderData: keepPreviousData,
  });
}
