import api from "@/lib/api";
import type { Application, ApplicationFormValues } from "./types";

// Laravel API resources wrap payloads in a `data` envelope.
interface Wrapped<T> {
  data: T;
}

// The authenticated applicant's submitted applications, newest first.
export async function fetchApplications(): Promise<Application[]> {
  const { data } = await api.get<Wrapped<Application[]>>("/applications");
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
