import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useMyEnrollments } from "@/features/students/hooks";
import { useMyClassSchedule } from "./hooks";
import { WeeklyTimetable } from "./weekly-timetable";

export function StudentClassSchedule() {
  const enrollments = useMyEnrollments();
  const [selected, setSelected] = useState("current");
  const query = useMyClassSchedule(selected === "current" ? undefined : Number(selected));
  const schedule = query.data;
  return <section aria-label="Class schedule" className="min-w-0 space-y-3 pt-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="min-w-0 break-words text-sm font-medium">{schedule?.section ? `${schedule.section.program.toUpperCase()} · ${schedule.section.name} · SY ${schedule.schoolYear}` : "Class schedule"}</h2>
      <div className="w-full sm:w-auto">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger aria-label="Schedule school year" className="w-full sm:w-60"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="current">Current / latest enrollment</SelectItem>{enrollments.data?.map((record) => <SelectItem key={record.id} value={String(record.id)}>SY {record.schoolYear}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
    <div className="space-y-3">
      {query.isLoading ? <p role="status" className="text-muted-foreground text-sm">Loading your schedule…</p>
        : query.isError ? <div role="alert" className="space-y-3"><p>We couldn't load your schedule.</p><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button></div>
        : schedule?.status === "published" ? <><WeeklyTimetable entries={schedule.entries} /><p className="text-muted-foreground text-xs">Published {new Date(schedule.publishedAt!).toLocaleString()}</p></>
        : <p className="text-muted-foreground py-6 text-sm">{schedule?.status === "no_section" ? "You haven't been assigned a section yet. Your schedule will appear after section assignment and publication." : schedule?.status === "no_enrollment" ? "Your schedule will appear once you have an enrollment and a section." : "Your section's schedule hasn't been published yet. Check back after the registrar publishes it."}</p>}
    </div>
  </section>;
}
