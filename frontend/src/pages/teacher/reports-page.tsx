import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BarChart3Icon, CalendarRangeIcon, FunnelXIcon, ReceiptTextIcon } from "lucide-react";
import {
  DashboardHeader,
  DashboardLoading,
  DashboardMetricStrip,
  DashboardPanel,
  type DashboardMetric,
} from "@/components/dashboard/dashboard-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { labelFor, YEAR_LEVEL_OPTIONS } from "@/features/applications/types";
import { formatDate } from "@/features/applications/utils";
import { useProgramLabel } from "@/features/programs/hooks";
import { SEMESTERS, semesterLabel, type Semester } from "@/features/student-documents/types";
import { useTeacherGrades } from "@/features/teacher-grades/hooks";
import { buildTeacherReport, GRADE_REPORT_STATUS_META, printTeacherReport, type GradeReportStatus } from "@/features/teacher-grades/report";
import { getTeacherRosterError, getTeacherRosterState } from "@/features/teacher-grades/roster-state";

const number = new Intl.NumberFormat("en-PH");
const statuses: GradeReportStatus[] = ["accepted", "pending", "returned", "missing"];
const gradeLabel = (value: string) => labelFor(YEAR_LEVEL_OPTIONS, value);

export default function TeacherReportsPage() {
  const [schoolYearId, setSchoolYearId] = useState<number>();
  const [yearLevel, setYearLevel] = useState("all");
  const [program, setProgram] = useState("all");
  const [sectionId, setSectionId] = useState("all");
  const [semester, setSemester] = useState<Semester | "all">("all");
  const [activeTab, setActiveTab] = useState("overview");
  const query = useTeacherGrades(schoolYearId);
  const programLabel = useProgramLabel();

  function resetFilters() {
    setSchoolYearId(undefined);
    setYearLevel("all");
    setProgram("all");
    setSectionId("all");
    setSemester("all");
  }

  if (query.isLoading) return <DashboardLoading />;

  if (query.isError || !query.data) {
    const error = getTeacherRosterError(query.error);
    return (
      <div className="space-y-4">
        <DashboardHeader title="Reports" />
        <Card role="alert" className="items-center gap-3 px-5 py-12 text-center">
          <h2 className="font-semibold">{error.title === "Couldn't load your students" ? "Reports unavailable" : error.title}</h2>
          <p className="text-muted-foreground max-w-md text-sm">{error.description}</p>
          <Button variant="outline" onClick={() => {
            if (error.resetYear && schoolYearId !== undefined) resetFilters();
            else void query.refetch();
          }}>{error.action}</Button>
        </Card>
      </div>
    );
  }

  const data = query.data;
  const selectedYear = data.schoolYears.find((year) => year.id === data.schoolYearId);
  const years = data.schoolYears.length
    ? data.schoolYears
    : [{ id: data.schoolYearId, schoolYear: data.schoolYear, isActive: false }];
  const programs = [...new Set(data.sections.map((section) => section.program))];
  const sections = data.sections.filter((section) =>
    (yearLevel === "all" || section.yearLevel === yearLevel) &&
    (program === "all" || section.program === program),
  );
  const selectedSection = sections.find((section) => String(section.id) === sectionId);
  const report = buildTeacherReport(
    sections.filter((section) => sectionId === "all" || String(section.id) === sectionId),
    semester === "all" ? SEMESTERS.map((item) => item.value) : [semester],
  );
  const summary = report.summary;
  const hasFilters = schoolYearId !== undefined || yearLevel !== "all" ||
    program !== "all" || sectionId !== "all" || semester !== "all";
  const filterLabels = [
    yearLevel === "all" ? "All grade levels" : gradeLabel(yearLevel),
    program === "all" ? "All programs / strands" : programLabel(program),
    sectionId === "all" ? "All sections" : `Section: ${selectedSection ? `${selectedSection.name} · ${gradeLabel(selectedSection.yearLevel)} · ${programLabel(selectedSection.program)}` : sectionId}`,
    semester === "all" ? "Both semesters" : semesterLabel(semester),
  ];
  const metrics: DashboardMetric[] = [
    { label: "Enrolled students", value: number.format(summary.students), detail: "Students in your selected advisory sections." },
    { label: "Grade completion", value: summary.expected ? `${summary.completion}%` : "—", detail: `${summary.accepted} of ${summary.expected} grade slips accepted.`, explanation: "Share of expected grade slips accepted by the registrar." },
    { label: "Submitted", value: number.format(summary.pending), detail: "Grade slips awaiting review." },
    { label: "Needs attention", value: number.format(summary.missing + summary.returned), detail: `${summary.missing} not uploaded and ${summary.returned} returned.`, explanation: "Grade slips that need an upload or a replacement." },
  ];
  const emptyState = getTeacherRosterState(data, "").emptyState;

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Reports"
        description="Grade slip completion for enrolled students in your advisory sections."
        context={selectedYear?.isActive ? <Badge variant="secondary">Active term</Badge> : null}
      />

      <Card className="grid gap-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-3">
        <ReportFilter label="Academic year" id="teacher-report-year">
          <Select value={String(data.schoolYearId)} onValueChange={(value) => {
            setSchoolYearId(Number(value));
            setYearLevel("all");
            setProgram("all");
            setSectionId("all");
          }}>
            <SelectTrigger id="teacher-report-year" className="w-full text-left *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1">
              <CalendarRangeIcon className="text-muted-foreground size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{years.map((year) => <SelectItem key={year.id} value={String(year.id)}>SY {year.schoolYear}</SelectItem>)}</SelectContent>
          </Select>
        </ReportFilter>
        <ReportFilter label="Grade level" id="teacher-report-grade">
          <Select value={yearLevel} onValueChange={(value) => { setYearLevel(value); setSectionId("all"); }}>
            <SelectTrigger id="teacher-report-grade" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All grade levels</SelectItem>
              {YEAR_LEVEL_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </ReportFilter>
        <ReportFilter label="Program / strand" id="teacher-report-program">
          <Select value={program} onValueChange={(value) => { setProgram(value); setSectionId("all"); }}>
            <SelectTrigger id="teacher-report-program" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All programs / strands</SelectItem>
              {programs.map((code) => <SelectItem key={code} value={code}>{programLabel(code)}</SelectItem>)}
            </SelectContent>
          </Select>
        </ReportFilter>
        <ReportFilter label="Section" id="teacher-report-section">
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger id="teacher-report-section" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sections.map((section) => <SelectItem key={section.id} value={String(section.id)}>{section.name} · {gradeLabel(section.yearLevel)} · {section.program.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </ReportFilter>
        <ReportFilter label="Semester" id="teacher-report-semester">
          <Select value={semester} onValueChange={(value) => setSemester(value as Semester | "all")}>
            <SelectTrigger id="teacher-report-semester" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Both semesters</SelectItem>
              {SEMESTERS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </ReportFilter>
        <div className="flex items-end gap-2">
          {hasFilters && <Button type="button" variant="outline" size="icon" onClick={resetFilters} aria-label="Reset filters" title="Reset filters"><FunnelXIcon /></Button>}
          <Button type="button" className="flex-1" disabled={query.isFetching || !report.records.length} onClick={() => printTeacherReport(report, { schoolYear: `SY ${data.schoolYear}`, filters: filterLabels }, programLabel)}>
            <ReceiptTextIcon /> Export snapshot
          </Button>
        </div>
      </Card>

      {query.isFetching && <p role="status" className="text-muted-foreground text-sm">Updating report…</p>}
      <div className="space-y-4" aria-busy={query.isFetching}>
        <DashboardMetricStrip metrics={metrics} footer={`SY ${data.schoolYear} · ${filterLabels[3]} · ${number.format(report.sections.length)} sections with enrolled students`} />

        {!summary.students ? (
          <Card className="items-center gap-3 px-5 py-12 text-center">
            <BarChart3Icon aria-hidden="true" className="text-muted-foreground size-8" />
            <h2 className="font-semibold">{data.sections.length ? "No students match these filters" : emptyState.title}</h2>
            <p className="text-muted-foreground max-w-md text-sm">{data.sections.length ? "Choose another grade level, program, or section to view your report." : emptyState.description}</p>
            {hasFilters && <Button variant="outline" onClick={resetFilters}>Reset filters</Button>}
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-3">
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-card p-1 shadow-xs ring-1 ring-foreground/10 sm:flex sm:w-fit">
              <TabsTrigger value="overview" className="px-4">Overview</TabsTrigger>
              <TabsTrigger value="grades" className="px-4">Grade slips</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <DashboardPanel title="Grade slip status" description={`${number.format(summary.expected)} expected grade slips · ${filterLabels[3]}`}>
                <Table>
                  <TableHeader><TableRow><TableHead className="px-4">Status</TableHead><TableHead className="text-right">Grade slips</TableHead><TableHead className="px-4 text-right">Share</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {statuses.map((status) => <TableRow key={status}>
                      <TableCell className="px-4 py-4"><Badge variant="outline" className={GRADE_REPORT_STATUS_META[status].className}>{GRADE_REPORT_STATUS_META[status].label}</Badge></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{number.format(summary[status])}</TableCell>
                      <TableCell className="text-muted-foreground px-4 text-right tabular-nums">{((summary[status] / summary.expected) * 100).toFixed(1)}%</TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              </DashboardPanel>
              <DashboardPanel title="Completion by section" description="Accepted grade slips out of those expected for the selected semesters">
                <Table className="min-w-[44rem]">
                  <TableHeader className="bg-muted/40"><TableRow>
                    <TableHead className="px-4">Section</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Accepted</TableHead><TableHead className="text-right">Submitted</TableHead><TableHead className="text-right">Returned</TableHead><TableHead className="text-right">Not uploaded</TableHead><TableHead className="px-4 text-right">Completion</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{report.sections.map((section) => <TableRow key={section.id}>
                    <TableCell className="px-4 py-3"><p className="font-medium">{section.name}</p><p className="text-muted-foreground text-xs">{gradeLabel(section.yearLevel)} · {programLabel(section.program)}</p></TableCell>
                    <TableCell className="text-right tabular-nums">{number.format(section.students)}</TableCell>
                    {statuses.map((status) => <TableCell key={status} className="text-right tabular-nums">{number.format(section[status])}</TableCell>)}
                    <TableCell className="px-4 text-right font-semibold tabular-nums">{section.completion}%<p className="text-muted-foreground text-xs font-normal">{section.accepted} of {section.expected}</p></TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </DashboardPanel>
            </TabsContent>
            <TabsContent value="grades">
              <DashboardPanel title="Student grade slips" description={`${number.format(report.records.length)} records · ${filterLabels[3]}`} action={<Button variant="outline" size="sm" asChild><Link to="/admin/my-students">Manage grades</Link></Button>}>
                <div className="max-h-[36rem] overflow-auto">
                  <Table className="min-w-[48rem]">
                    <TableHeader className="bg-muted/40"><TableRow><TableHead className="px-4">Student</TableHead><TableHead>Section</TableHead><TableHead>Semester</TableHead><TableHead>Status</TableHead><TableHead className="px-4 text-right">Uploaded</TableHead></TableRow></TableHeader>
                    <TableBody>{report.records.map((record) => <TableRow key={`${record.sectionId}-${record.studentId}-${record.semester}`}>
                      <TableCell className="px-4 py-3"><p className="font-medium">{record.studentName}</p><p className="text-muted-foreground text-xs tabular-nums">{record.studentNumber}</p></TableCell>
                      <TableCell><p>{record.sectionName}</p><p className="text-muted-foreground text-xs">{gradeLabel(record.yearLevel)} · {record.program.toUpperCase()}</p></TableCell>
                      <TableCell>{semesterLabel(record.semester)}</TableCell>
                      <TableCell><Badge variant="outline" className={GRADE_REPORT_STATUS_META[record.status].className}>{GRADE_REPORT_STATUS_META[record.status].label}</Badge>{record.status === "returned" && record.reviewNote && <p className="text-muted-foreground mt-1 max-w-64 whitespace-normal break-words text-xs">{record.reviewNote}</p>}</TableCell>
                      <TableCell className="text-muted-foreground px-4 text-right">{record.uploadedAt ? formatDate(record.uploadedAt) : "—"}</TableCell>
                    </TableRow>)}</TableBody>
                  </Table>
                </div>
              </DashboardPanel>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function ReportFilter({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id} className="text-muted-foreground block text-[0.8125rem] font-medium">{label}</Label>{children}</div>;
}
