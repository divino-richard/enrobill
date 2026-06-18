import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApplications, submitApplication } from "../applications-api";

export const applicationsQueryKey = ["applications"] as const;

// Load the authenticated applicant's applications.
export function useApplications() {
  return useQuery({
    queryKey: applicationsQueryKey,
    queryFn: fetchApplications,
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
