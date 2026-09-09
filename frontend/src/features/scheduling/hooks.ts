import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/features/auth/store";
import type { ClassEntry, ClassTimetable, StudentSchedule } from "./types";

const scheduleKey = (sectionId: number) => ["admin", "class-schedule", sectionId] as const;

export function useClassSchedule(sectionId: number) {
  return useQuery({
    queryKey: scheduleKey(sectionId),
    queryFn: async () => (await api.get<{ data: ClassTimetable }>(`/admin/sections/${sectionId}/schedule`)).data.data,
  });
}

type ScheduleChange = { action: "save"; version: number; entries: ClassEntry[] } | { action: "publish" | "unpublish"; version: number };

export function useChangeSchedule(sectionId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (change: ScheduleChange) => {
      const path = `/admin/sections/${sectionId}/schedule`;
      const response = change.action === "save"
        ? await api.put<{ data: ClassTimetable }>(path, { version: change.version, entries: change.entries })
        : await api.post<{ data: ClassTimetable }>(`${path}/${change.action}`, { version: change.version });
      return response.data.data;
    },
    onSuccess: (data) => {
      client.setQueryData(scheduleKey(sectionId), data);
      client.invalidateQueries({ queryKey: ["me", "class-schedule"] });
    },
  });
}

export function useMyClassSchedule(enrollmentId?: number) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["me", "class-schedule", userId, enrollmentId],
    enabled: Boolean(userId),
    queryFn: async () => (await api.get<{ data: StudentSchedule }>("/me/schedule", { params: { enrollmentId } })).data.data,
    refetchOnWindowFocus: true,
  });
}
