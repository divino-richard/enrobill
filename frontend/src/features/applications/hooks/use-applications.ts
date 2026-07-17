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
