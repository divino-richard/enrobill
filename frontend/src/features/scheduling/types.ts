export const SCHEDULE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface ClassEntry {
  id: string;
  day: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
}

export interface ClassTimetable {
  sectionId: number;
  version: number;
  entries: ClassEntry[];
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
}

export interface StudentSchedule {
  enrollmentId: number | null;
  schoolYear: string | null;
  section: { id: number; name: string; program: string; yearLevel: string } | null;
  status: "no_enrollment" | "no_section" | "not_published" | "published";
  publishedAt: string | null;
  entries: ClassEntry[];
}

export function scheduleTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function classMinutes(entry: Pick<ClassEntry, "startTime" | "endTime">): number {
  const minutes = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  };
  return minutes(entry.endTime) - minutes(entry.startTime);
}

export function scheduleDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""].filter(Boolean).join(" ") || "0m";
}
