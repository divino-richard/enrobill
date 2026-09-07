import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type {
  AdminReferral,
  EnrollmentIncentives,
  MyReferralSummary,
  ReferralCodeValidation,
} from "./types";

interface Wrapped<T> {
  data: T;
}

export async function createMyReferralCode(
  targetSchoolYearId: number,
): Promise<MyReferralSummary> {
  const { data } = await api.post<Wrapped<MyReferralSummary>>(
    "/me/referral-codes",
    { targetSchoolYearId },
  );
  return data.data;
}

export async function fetchMyReferrals(
  schoolYearId?: number,
): Promise<MyReferralSummary> {
  const { data } = await api.get<Wrapped<MyReferralSummary>>("/me/referrals", {
    params: schoolYearId ? { schoolYearId } : undefined,
  });
  return data.data;
}

export async function validateReferralCode(input: {
  code: string;
  schoolYear: string;
}): Promise<ReferralCodeValidation> {
  const { data } = await api.post<Wrapped<ReferralCodeValidation>>(
    "/applications/referral-code/validate",
    input,
  );
  return data.data;
}

export interface AdminReferralListParams extends ListParams {
  schoolYearId?: number;
  status?: string;
}

export interface AdminReferralsPage {
  rows: AdminReferral[];
  meta: PageMeta;
}

export async function fetchAdminReferrals(
  params: AdminReferralListParams,
): Promise<AdminReferralsPage> {
  const { schoolYearId, status, ...listParams } = params;
  const { data } = await api.get<LaravelPaginated<AdminReferral>>(
    "/admin/referrals",
    {
      params: {
        ...listParamsToQuery(listParams),
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(status ? { status } : {}),
      },
    },
  );
  return { rows: data.data, meta: toPageMeta(data.meta) };
}

export async function updateApplicationReferral(
  applicationId: number,
  input: { referralCode: string | null; reason: string },
): Promise<void> {
  await api.put(
    `/admin/applications/${applicationId}/referral`,
    input,
  );
}

export async function fetchEnrollmentIncentives(
  enrollmentId: number,
): Promise<EnrollmentIncentives> {
  const { data } = await api.get<Wrapped<EnrollmentIncentives>>(
    `/admin/enrollments/${enrollmentId}/incentives`,
  );
  return data.data;
}
