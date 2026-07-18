import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  decideApplication,
  fetchAdminApplication,
  fetchAllApplications,
  fetchApplication,
  fetchApplications,
  markApplicationUnderReview,
  submitApplication,
  updateApplication,
} from "../applications-api";
import type { ListParams } from "@/lib/pagination";
import type { ApplicationFormValues } from "../types";

export const applicationsQueryKey = ["applications"] as const;
export const adminApplicationsQueryKey = ["admin", "applications"] as const;

// Load the authenticated applicant's applications.
export function useApplications() {
  return useQuery({
    queryKey: applicationsQueryKey,
    queryFn: fetchApplications,
  });
}

// Load every applicant's applications (admin), paginated/searchable/sortable.
export function useAllApplications(params: ListParams) {
  return useQuery({
    queryKey: [...adminApplicationsQueryKey, "list", params],
    queryFn: () => fetchAllApplications(params),
    placeholderData: keepPreviousData,
  });
}

// How often the sidebar badge polls for newly submitted applications, so the
// count moves without the admin taking an action or reloading.
const NEW_APPLICATIONS_POLL_MS = 15_000;

// Count of new (submitted, not-yet-reviewed) applications, for the sidebar
// notification badge. Reuses the list endpoint with perPage: 1 and reads
// meta.total, so it stays cheap and needs no dedicated backend route. Keyed under
// the admin-applications prefix so deciding an application refreshes it too, and
// polled on an interval so freshly submitted applications appear on their own.
export function useNewApplicationsCount(enabled: boolean) {
  return useQuery({
    queryKey: [...adminApplicationsQueryKey, "new-count"],
    queryFn: () => fetchAllApplications({ status: "submitted", perPage: 1 }),
    select: (page) => page.meta.total,
    enabled,
    refetchInterval: NEW_APPLICATIONS_POLL_MS,
  });
}

// Load a single application for staff review (admin).
export function useAdminApplication(id: number) {
  return useQuery({
    queryKey: [...adminApplicationsQueryKey, "detail", id],
    queryFn: () => fetchAdminApplication(id),
  });
}

// Accept / reject an application; refreshes the admin list and detail.
export function useDecideApplication(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      decision,
      note,
      discountId,
    }: {
      decision: "accept" | "reject";
      note?: string | null;
      discountId?: number | null;
    }) => decideApplication(id, decision, { note, discountId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminApplicationsQueryKey });
    },
  });
}

// Mark a submitted application as under review when the admin opens it. Refreshes
// the admin list, detail, and the new-applications count (all under the same
// prefix) so the badge decrements on view, before any accept/reject.
export function useMarkApplicationUnderReview(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markApplicationUnderReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminApplicationsQueryKey });
    },
  });
}

// Load a single application with its full answers.
export function useApplication(id: number) {
  return useQuery({
    queryKey: [...applicationsQueryKey, id],
    queryFn: () => fetchApplication(id),
  });
}

// Submit a new application and refresh the cached list on success.
export function useSubmitApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationsQueryKey });
    },
  });
}

// Edit and resubmit a rejected application.
export function useUpdateApplication(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ApplicationFormValues) => updateApplication(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationsQueryKey });
    },
  });
}
