import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createMyReferralCode,
  fetchAdminReferrals,
  fetchEnrollmentIncentives,
  fetchMyReferrals,
  updateApplicationReferral,
  validateReferralCode,
  type AdminReferralListParams,
} from "./api";

export const myReferralsQueryKey = ["me", "referrals"] as const;
export const adminReferralsQueryKey = ["admin", "referrals"] as const;
export const enrollmentIncentivesQueryKey = [
  "admin",
  "enrollment-incentives",
] as const;

export function useMyReferrals(schoolYearId?: number, enabled = true) {
  return useQuery({
    queryKey: [...myReferralsQueryKey, schoolYearId],
    queryFn: () => fetchMyReferrals(schoolYearId),
    enabled,
  });
}

export function useCreateMyReferralCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetSchoolYearId: number) =>
      createMyReferralCode(targetSchoolYearId),
    onSuccess: (summary) => {
      queryClient.setQueryData(
        [...myReferralsQueryKey, summary.code?.targetSchoolYear?.id],
        summary,
      );
      queryClient.invalidateQueries({ queryKey: myReferralsQueryKey });
    },
  });
}

export function useValidateReferralCode() {
  return useMutation({ mutationFn: validateReferralCode });
}

export function useAdminReferrals(params: AdminReferralListParams) {
  return useQuery({
    queryKey: [...adminReferralsQueryKey, "list", params],
    queryFn: () => fetchAdminReferrals(params),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateApplicationReferral(applicationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { referralCode: string | null; reason: string }) =>
      updateApplicationReferral(applicationId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminReferralsQueryKey });
      queryClient.invalidateQueries({
        queryKey: ["admin", "applications", "detail", applicationId],
      });
      queryClient.invalidateQueries({
        queryKey: enrollmentIncentivesQueryKey,
      });
    },
  });
}

export function useEnrollmentIncentives(enrollmentId?: number) {
  return useQuery({
    queryKey: [...enrollmentIncentivesQueryKey, enrollmentId],
    queryFn: () => fetchEnrollmentIncentives(enrollmentId as number),
    enabled: enrollmentId != null,
  });
}
