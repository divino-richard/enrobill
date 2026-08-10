import api from "@/lib/api";
import type { StudentNotification } from "./types";

interface Wrapped<T> {
  data: T;
}

// The authenticated student's own notifications.
export async function fetchMyNotifications(): Promise<StudentNotification[]> {
  const { data } = await api.get<Wrapped<StudentNotification[]>>(
    "/me/notifications",
  );
  return data.data;
}

export async function markNotificationRead(
  id: number,
): Promise<StudentNotification> {
  const { data } = await api.post<Wrapped<StudentNotification>>(
    `/me/notifications/${id}/read`,
  );
  return data.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/me/notifications/mark-all-read");
}
