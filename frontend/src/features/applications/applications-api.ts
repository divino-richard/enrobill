import api from "@/lib/api";
import type {
  Application,
  ApplicationDetail,
  ApplicationFormValues,
} from "./types";

// Laravel API resources wrap payloads in a `data` envelope.
interface Wrapped<T> {
  data: T;
}

// The authenticated applicant's submitted applications, newest first.
export async function fetchApplications(): Promise<Application[]> {
  const { data } = await api.get<Wrapped<Application[]>>("/applications");
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
