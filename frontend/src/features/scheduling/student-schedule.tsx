import { useState } from "react";
import { CalendarClockIcon, CircleAlertIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useMyEnrollments } from "@/features/students/hooks";
import { useMyClassSchedule } from "./hooks";
import { WeeklyTimetable } from "./weekly-timetable";

export function StudentClassSchedule() {
  const enrollments = useMyEnrollments();
  const [selected, setSelected] = useState("current");
  const query = useMyClassSchedule(selected === "current" ? undefined : Number(selected));
  const schedule = query.data;
  const record = enrollments.data?.find(item => item.id === schedule?.enrollmentId);
  const inactive = record?.status === "dropped" || record?.status === "withdrawn";
  const empty = inactive
    ? { title: "No saved schedule", description: "There is no published schedule saved for this enrollment." }
    : schedule?.status === "no_section"
      ? { title: "Section not assigned yet", description: "Your schedule will appear after you are assigned a section and the registrar publishes it." }
      : schedule?.status === "no_enrollment"
        ? { title: "No enrollment to display", description: "Your schedule will appear once you have an enrollment and a section." }
        : { title: "Schedule not published yet", description: "Your section’s classes will appear here once the registrar publishes the schedule." };

  return (
    <section aria-label="Class schedule" className="min-w-0">
      <Card className="shadow-none [--card-spacing:--spacing(5)]">
        <CardHeader className="flex flex-wrap items-start justify-between gap-4 border-b">
          <div className="min-w-0 space-y-1">
            <CardTitle><h2>Class schedule</h2></CardTitle>
            {schedule?.section && <CardDescription className="break-words">
              {schedule.section.program.toUpperCase()} · {schedule.section.name} · SY {schedule.schoolYear}
            </CardDescription>}
          </div>
          <div className="w-full sm:w-auto">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger aria-label="Schedule school year" className="w-full sm:w-60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current / latest enrollment</SelectItem>
                {enrollments.data?.map(enrollment => <SelectItem key={enrollment.id} value={String(enrollment.id)}>SY {enrollment.schoolYear}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {inactive && <p className="text-sm text-muted-foreground">Historical schedule for a closed enrollment. These classes are no longer active for you.</p>}
          {query.isLoading ? (
            <div role="status" aria-label="Loading your schedule" className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : query.isError ? (
            <div role="alert">
              <EmptyState icon={CircleAlertIcon} title="Schedule unavailable" description="We couldn’t load your schedule. Please try again."
                action={<Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button>} />
            </div>
          ) : schedule?.status === "published" ? (
            <>
              <WeeklyTimetable entries={schedule.entries} className="rounded-none border-0 p-0" />
              {schedule.publishedAt && <p className="text-xs text-muted-foreground">Published {new Date(schedule.publishedAt).toLocaleString()}</p>}
            </>
          ) : <EmptyState icon={CalendarClockIcon} {...empty} />}
        </CardContent>
      </Card>
    </section>
  );
}
