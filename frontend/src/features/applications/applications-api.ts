import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type {
  AdminApplication,
  AdminApplicationDetail,
  Application,
  ApplicationDetail,
  ApplicationFormValues,
} from "./types";

// Laravel API resources wrap payloads in a `data` envelope.
interface Wrapped<T> {
  data: T;
}

export interface ApplicationsPage {
  rows: AdminApplication[];
  meta: PageMeta;
}

// The authenticated applicant's submitted applications, newest first.
export async function fetchApplications(): Promise<Application[]> {
  const { data } = await api.get<Wrapped<Application[]>>("/applications");
  return data.data;
}

// Paginated / searchable / sortable list of all applications (admin only).
export async function fetchAllApplications(
  params: ListParams,
): Promise<ApplicationsPage> {
  const { data } = await api.get<LaravelPaginated<AdminApplication>>(
    "/admin/applications",
    { params: listParamsToQuery(params) },
  );

  return { rows: data.data, meta: toPageMeta(data.meta) };
}

// A single application for staff review (admin only).
export async function fetchAdminApplication(
  id: number,
): Promise<AdminApplicationDetail> {
  const { data } = await api.get<Wrapped<AdminApplicationDetail>>(
    `/admin/applications/${id}`,
  );
  return data.data;
}

// Accept / reject an application — notifies the applicant by email (admin only).
// The downpayment waiver is decided later, at bill generation, by the voucher.
export async function decideApplication(
  id: number,
  decision: "accept" | "reject",
  options: { note?: string | null } = {},
): Promise<AdminApplicationDetail> {
  const body = decision === "accept" ? {} : { note: options.note ?? null };
  const { data } = await api.post<Wrapped<AdminApplicationDetail>>(
    `/admin/applications/${id}/${decision}`,
    body,
  );
  return data.data;
}

// A single application with its full submitted answers.
export async function fetchApplication(
  id: number,
): Promise<ApplicationDetail> {
  const { data } = await api.get<Wrapped<ApplicationDetail>>(
    `/applications/${id}`,
  );
  return data.data;
}

// Submit the completed application form.
export async function submitApplication(
  values: ApplicationFormValues,
): Promise<Application> {
  const { data } = await api.post<Wrapped<Application>>(
    "/applications",
    values,
  );
  return data.data;
}

// Edit and resubmit a rejected application.
export async function updateApplication(
  id: number,
  values: ApplicationFormValues,
): Promise<ApplicationDetail> {
  const { data } = await api.put<Wrapped<ApplicationDetail>>(
    `/applications/${id}`,
    values,
  );
  return data.data;
}
