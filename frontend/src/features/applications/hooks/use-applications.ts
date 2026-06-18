import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideApplication,
  fetchAdminApplication,
  fetchAllApplications,
  fetchApplication,
  fetchApplications,
  submitApplication,
  updateApplication,
} from "../applications-api";
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

// Load every applicant's applications (admin).
export function useAllApplications() {
  return useQuery({
    queryKey: adminApplicationsQueryKey,
    queryFn: fetchAllApplications,
  });
}

// Load a single application for staff review (admin).
export function useAdminApplication(id: number) {
  return useQuery({
    queryKey: [...adminApplicationsQueryKey, id],
    queryFn: () => fetchAdminApplication(id),
  });
}

// Accept / reject an application; refreshes the admin list and detail.
export function useDecideApplication(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (decision: "accept" | "reject") =>
      decideApplication(id, decision),
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
