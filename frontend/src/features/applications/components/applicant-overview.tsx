import { useNavigate } from "react-router-dom";
import {
  CheckCircle2Icon,
  FileTextIcon,
  PlusIcon,
} from "lucide-react";
import {
  DashboardAttention,
  DashboardError,
  DashboardHeader,
  DashboardLoading,
  DashboardMetricStrip,
  DashboardPanel,
  DashboardQueue,
  type DashboardMetric,
  type DashboardAttentionItem,
  type DashboardQueueItem,
} from "@/components/dashboard/dashboard-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store";
import { cn } from "@/lib/utils";
import { useApplications } from "../hooks/use-applications";
import {
  APPLICATION_STATUS_META,
  isActiveStatus,
  type ApplicationStatus,
} from "../types";
import { ApplicationStatusBadge } from "./application-status-badge";
import { formatDate } from "../utils";

const steps = ["Submitted", "Under review", "Decision"];

export function ApplicantOverview() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const query = useApplications();

  if (query.isLoading) return <DashboardLoading />;
  if (query.isError) return <DashboardError retry={() => query.refetch()} />;

  const applications = query.data ?? [];
  const current = applications.find((application) => isActiveStatus(application.status));
  const latest = current ?? applications[0];

  if (!latest) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <DashboardHeader
          description="Start and track your enrollment application."
          context={<Badge variant="secondary">Applicant</Badge>}
        />
        <DashboardPanel title="Start your enrollment">
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <FileTextIcon className="text-primary size-9" />
            <p className="mt-4 font-medium">No application yet</p>
            <p className="text-muted-foreground mt-1 max-w-md text-sm">
              Choose a program and submit your requirements to begin.
            </p>
            <Button className="mt-5" onClick={() => navigate("/portal/application")}>
              <PlusIcon />
              Start application
            </Button>
          </div>
        </DashboardPanel>
      </div>
    );
  }

  const currentStep = stepFor(latest.status);
  const next = actionFor(latest.status);
  const metrics: DashboardMetric[] = [
    {
      label: "Application status",
      value: APPLICATION_STATUS_META[latest.status].label,
      detail: latest.reference,
      tone: latest.status === "returned" ? "warning" : latest.status === "accepted" ? "success" : "primary",
    },
    {
      label: "Program",
      value: latest.program,
      detail: "Selected program",
    },
    {
      label: "School year",
      value: latest.schoolYear,
      detail: "Enrollment intake",
    },
    {
      label: "Last updated",
      value: formatDate(latest.updatedAt),
      detail: latest.status === "returned" ? "Your action is required" : "Application activity",
      tone: latest.status === "returned" ? "warning" : "primary",
    },
  ];
  const queue: DashboardQueueItem[] = next
    ? [
        {
          label: next.title,
          detail: next.detail,
          actionLabel: next.label,
          onAction: () => navigate(`/portal/application/${latest.id}${next.edit ? "/edit" : ""}`),
          tone: latest.status === "returned" ? "warning" : "default",
        },
      ]
    : [];
  const attentionItems: DashboardAttentionItem[] = [
    {
      value: currentStep,
      label: APPLICATION_STATUS_META[latest.status].label,
      detail: latest.status === "returned" ? "Corrections are required" : `Application ${latest.reference}`,
      onAction: () => navigate(`/portal/application/${latest.id}${next?.edit ? "/edit" : ""}`),
      tone: latest.status === "returned" ? "warning" : "primary",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <DashboardHeader
        description={`Application ${latest.reference} · ${user?.name ?? "Applicant"}`}
        context={<ApplicationStatusBadge status={latest.status} />}
        actions={
          <Button variant="outline" onClick={() => navigate(`/portal/application/${latest.id}`)}>
            View application
          </Button>
        }
      />

      <DashboardAttention
        label={latest.status === "draft" || latest.status === "returned" ? "Needs attention" : "Application status"}
        summary={latest.status === "draft" || latest.status === "returned" ? "1 item" : "On track"}
        items={attentionItems}
      />
      <DashboardMetricStrip metrics={metrics} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.42fr)_minmax(18rem,.78fr)]">
        <DashboardPanel title="Application progress" description="Your position in the admission process">
          <div className="p-5 sm:p-7">
            <div className="relative grid grid-cols-3 gap-2">
              <div className="bg-border absolute top-4 right-[16%] left-[16%] h-0.5" />
              <div className="bg-primary absolute top-4 left-[16%] h-0.5 transition-all" style={{ width: `${Math.max(0, currentStep - 1) * 34}%` }} />
              {steps.map((label, index) => {
                const number = index + 1;
                const complete = number < currentStep || latest.status === "accepted";
                const active = number === currentStep;
                return (
                  <div key={label} className="relative flex flex-col items-center text-center">
                    <span className={cn("bg-background text-muted-foreground flex size-8 items-center justify-center rounded-full border text-xs font-semibold", complete && "border-primary bg-primary text-primary-foreground", active && "border-primary bg-primary/10 text-primary")}>
                      {complete ? <CheckCircle2Icon className="size-4" /> : number}
                    </span>
                    <p className={cn("text-muted-foreground mt-2 text-xs", (complete || active) && "text-foreground font-medium")}>{label}</p>
                  </div>
                );
              })}
            </div>
            <div className="bg-muted/40 mt-7 border px-4 py-3">
              <p className="text-sm font-medium">{APPLICATION_STATUS_META[latest.status].label}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">{APPLICATION_STATUS_META[latest.status].description}</p>
            </div>
          </div>
        </DashboardPanel>
        <DashboardPanel title="Next step" description="What you can do now">
          <DashboardQueue items={queue} />
        </DashboardPanel>
      </div>
    </div>
  );
}

function stepFor(status: ApplicationStatus) {
  if (status === "draft") return 1;
  if (status === "submitted" || status === "under_review" || status === "returned") return 2;
  return 3;
}

function actionFor(status: ApplicationStatus): {
  title: string;
  detail: string;
  label: string;
  edit?: boolean;
} | null {
  if (status === "draft") return { title: "Finish your application", detail: "Complete the remaining fields and requirements.", label: "Continue", edit: true };
  if (status === "returned") return { title: "Correct returned requirements", detail: "Follow the reviewer note and resubmit the requested information.", label: "Fix application", edit: true };
  if (status === "submitted" || status === "under_review") return { title: "Review your submission", detail: "No changes are required while the admission team reviews it.", label: "View" };
  return null;
}
