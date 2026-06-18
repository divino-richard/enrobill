import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchApplication,
  fetchApplications,
  submitApplication,
  updateApplication,
} from "../applications-api";
import type { ApplicationFormValues } from "../types";

export const applicationsQueryKey = ["applications"] as const;

// Load the authenticated applicant's applications.
export function useApplications() {
  return useQuery({
    queryKey: applicationsQueryKey,
    queryFn: fetchApplications,
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
