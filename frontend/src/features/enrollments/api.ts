import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type { Enrollment } from "./types";

export interface EnrollmentListParams extends ListParams {
  schoolYearId?: number;
}

export interface EnrollmentsPage {
  rows: Enrollment[];
  meta: PageMeta;
}

// Paginated / searchable / sortable global enrollment list (admin).
export async function fetchEnrollments(
  params: EnrollmentListParams,
): Promise<EnrollmentsPage> {
  const { schoolYearId, ...rest } = params;
  const { data } = await api.get<LaravelPaginated<Enrollment>>(
    "/admin/enrollments",
    {
      params: {
        ...listParamsToQuery(rest),
        ...(schoolYearId ? { school_year_id: schoolYearId } : {}),
      },
    },
  );
  return { rows: data.data, meta: toPageMeta(data.meta) };
}
