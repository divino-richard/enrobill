import { useNavigate } from "react-router-dom";
import {
  GraduationCapIcon,
  UploadIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  DashboardError,
  DashboardHeader,
  DashboardLoading,
  DashboardMetricStrip,
  DashboardPanel,
  DashboardQueue,
  DashboardAttention,
  type DashboardAttentionItem,
  type DashboardMetric,
  type DashboardQueueItem,
} from "@/components/dashboard/dashboard-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useTeacherGrades } from "@/features/teacher-grades/hooks";

const chartConfig = {
  accepted: { label: "Accepted", color: "var(--color-primary)" },
  pending: { label: "In review", color: "var(--color-chart-2)" },
  returned: { label: "Returned", color: "var(--color-destructive)" },
  missing: { label: "Missing", color: "var(--color-muted-foreground)" },
} satisfies ChartConfig;

export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const query = useTeacherGrades();

  if (query.isLoading) return <DashboardLoading />;
  if (query.isError || !query.data) {
    return <DashboardError retry={() => query.refetch()} />;
  }

  const { sections, schoolYear } = query.data;
  const students = sections.flatMap((section) => section.students);
  const totalSlots = students.length * 2;
  const documents = students.flatMap((student) => student.documents);
  const uploaded = documents.length;
  const missing = Math.max(totalSlots - uploaded, 0);
  const returned = documents.filter((document) => document.reviewStatus === "returned").length;
  const accepted = documents.filter((document) => document.reviewStatus === "accepted").length;
  const pending = documents.filter((document) => document.reviewStatus === "pending").length;
  const completion = totalSlots ? Math.round((accepted / totalSlots) * 100) : 0;
  const sectionData = sections.map((section) => {
    const slots = section.students.length * 2;
    const sectionDocuments = section.students.flatMap((student) => student.documents);
    return {
      section: section.name,
      accepted: sectionDocuments.filter((document) => document.reviewStatus === "accepted").length,
      pending: sectionDocuments.filter((document) => document.reviewStatus === "pending").length,
      returned: sectionDocuments.filter((document) => document.reviewStatus === "returned").length,
      missing: Math.max(slots - sectionDocuments.length, 0),
    };
  });

  const metrics: DashboardMetric[] = [
    {
      label: "Handled students",
      value: students.length,
      detail: `${sections.length} advised ${sections.length === 1 ? "section" : "sections"}`,
      trend: sectionData.map((section) => section.accepted + section.pending + section.returned + section.missing),
    },
    {
      label: "Grade completion",
      value: `${completion}%`,
      detail: `${accepted} of ${totalSlots} grade slips accepted`,
      tone: completion === 100 ? "success" : "primary",
      trend: sectionData.map((section) => section.accepted),
    },
    {
      label: "Missing uploads",
      value: missing,
      detail: "Semester grade slips not uploaded",
      tone: missing ? "warning" : "success",
      trend: sectionData.map((section) => section.missing),
    },
    {
      label: "Returned files",
      value: returned,
      detail: `${accepted} grade slips accepted`,
      tone: returned ? "danger" : "success",
      trend: sectionData.map((section) => section.returned),
    },
  ];

  const queue: DashboardQueueItem[] = [];
  if (returned) {
    queue.push({
      value: returned,
      label: "Returned grade slips",
      detail: "Replace files using the reviewer notes.",
      actionLabel: "Review",
      onAction: () => navigate("/admin/my-students"),
      tone: "danger",
    });
  }
  queue.push(...sections
    .map((section) => {
      const expected = section.students.length * 2;
      const actual = section.students.reduce((sum, student) => sum + student.documents.length, 0);
      return { section, missing: Math.max(expected - actual, 0) };
    })
    .filter((item) => item.missing > 0)
    .map(({ section, missing: sectionMissing }) => ({
      value: sectionMissing,
      label: section.name,
      detail: `${section.program.toUpperCase()} · ${section.students.length} handled students`,
      actionLabel: "Upload grades",
      onAction: () => navigate("/admin/my-students"),
      tone: "warning" as const,
    })));

  const attentionItems: DashboardAttentionItem[] = [
    ...(returned ? [{ value: returned, label: "Returned grades", detail: "Replacement files required", onAction: () => navigate("/admin/my-students"), tone: "danger" as const }] : []),
    ...(missing ? [{ value: missing, label: "Missing uploads", detail: "Semester slips not uploaded", onAction: () => navigate("/admin/my-students"), tone: "warning" as const }] : []),
    ...(pending ? [{ value: pending, label: "In review", detail: "Files awaiting validation", onAction: () => navigate("/admin/my-students"), tone: "primary" as const }] : []),
  ];

  return (
    <div className="space-y-3">
      <DashboardHeader
        description="Grade completion for the sections where you are the assigned adviser."
        context={<Badge variant="secondary">Adviser</Badge>}
        actions={
          <Button onClick={() => navigate("/admin/my-students")}>
            <UploadIcon />
            Manage grades
          </Button>
        }
      />

      <DashboardAttention
        summary={missing + returned ? `${missing + returned} records` : "All clear"}
        items={attentionItems}
      />
      <DashboardMetricStrip metrics={metrics} />

      {sections.length ? (
        <>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.42fr)_minmax(18rem,.78fr)]">
          <DashboardPanel
            title="Grade completion by section"
            description={`SY ${schoolYear}`}
          >
            <div className="text-muted-foreground flex flex-wrap gap-4 px-4 pt-3 text-xs">
              <Legend label="Accepted" className="bg-primary" />
              <Legend label="In review" className="bg-chart-2" />
              <Legend label="Returned" className="bg-destructive" />
              <Legend label="Missing" className="bg-muted-foreground" />
            </div>
            <div className="h-64 px-3 pt-2">
              <ChartContainer config={chartConfig}>
                <BarChart accessibilityLayer data={sectionData} margin={{ left: 4, right: 12, top: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="section" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="accepted" stackId="grades" fill="var(--color-accepted)" maxBarSize={42} />
                  <Bar dataKey="pending" stackId="grades" fill="var(--color-pending)" maxBarSize={42} />
                  <Bar dataKey="returned" stackId="grades" fill="var(--color-returned)" maxBarSize={42} />
                  <Bar dataKey="missing" stackId="grades" fill="var(--color-missing)" radius={[4, 4, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ChartContainer>
            </div>
            <div className="mx-4 flex flex-wrap justify-between gap-2 border-t py-3 text-xs">
              <strong>{completion}% accepted-grade completion</strong>
              <span className="text-muted-foreground">SY {schoolYear}</span>
            </div>
          </DashboardPanel>
          <DashboardPanel
            title="Needs attention"
            description={`${missing + returned} grade records require action`}
          >
            <DashboardQueue items={queue} />
          </DashboardPanel>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <DashboardPanel title="Grade slip status" description="Live records">
            <div className="grid grid-cols-2">
              <StatusCell label="Accepted" value={accepted} tone="success" />
              <StatusCell label="In review" value={pending} />
              <StatusCell label="Returned" value={returned} tone={returned ? "danger" : "success"} />
              <StatusCell label="Missing" value={missing} tone={missing ? "warning" : "success"} />
            </div>
          </DashboardPanel>
          <DashboardPanel title="Adviser assignment" description="Current scope">
            <div className="grid grid-cols-2">
              <StatusCell label="Advised sections" value={sections.length} />
              <StatusCell label="Handled students" value={students.length} />
              <StatusCell label="School year" value={schoolYear} />
              <StatusCell label="Grade access" value="Adviser only" tone="success" />
            </div>
          </DashboardPanel>
        </div>
        </>
      ) : (
        <DashboardPanel title="No advised section" description={`SY ${schoolYear}`}>
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <GraduationCapIcon className="text-muted-foreground size-8" />
            <div>
              <p className="font-medium">You are not assigned as an adviser</p>
              <p className="text-muted-foreground mt-1 text-sm">
                An admin can assign an adviser from the Sections page.
              </p>
            </div>
          </div>
        </DashboardPanel>
      )}
    </div>
  );
}

function Legend({ label, className }: { label: string; className: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-1 w-3 ${className}`} />{label}</span>;
}

function StatusCell({ label, value, tone = "primary" }: { label: string; value: string | number; tone?: "primary" | "success" | "warning" | "danger" }) {
  const colors = { primary: "text-primary", success: "text-emerald-700 dark:text-emerald-300", warning: "text-amber-700 dark:text-amber-300", danger: "text-destructive" };
  return <div className="border-r border-b p-4 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0"><span className="text-muted-foreground block text-xs">{label}</span><strong className={`mt-1.5 block text-sm ${colors[tone]}`}>{value}</strong></div>;
}
