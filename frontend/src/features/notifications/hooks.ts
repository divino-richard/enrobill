import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./api";

export const myNotificationsQueryKey = ["me", "notifications"] as const;

// `enabled` defaults to true; pass `role === "student"` from callers (like the
// sidebar) that also render for roles this endpoint 404s for. Polls so new
// notifications (created from another session, or the due-date cron) show up
// without a manual reload — paused automatically while the tab isn't focused.
export function useMyNotifications(enabled = true) {
  return useQuery({
    queryKey: myNotificationsQueryKey,
    queryFn: fetchMyNotifications,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myNotificationsQueryKey });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myNotificationsQueryKey });
    },
  });
}

// Sidebar badge count — shares the cached list rather than firing a second
// request when the notifications page itself is also mounted.
export function useUnreadNotificationCount(enabled = true) {
  const { data } = useMyNotifications(enabled);
  return data?.filter((notification) => notification.unread).length ?? 0;
}
