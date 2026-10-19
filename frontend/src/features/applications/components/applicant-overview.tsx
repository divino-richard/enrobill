import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  Clock3Icon,
  FilePenLineIcon,
  FileTextIcon,
  PlusIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/store";
import { cn } from "@/lib/utils";
import { useApplications } from "../hooks/use-applications";
import { isActiveStatus, type ApplicationStatus } from "../types";
import { formatDate } from "../utils";

type OverviewState = {
  title: string;
  description: string;
  action: string;
  edit?: boolean;
  step: number;
  stepStatus: string;
  icon: LucideIcon;
};

const overviewStates: Record<ApplicationStatus, OverviewState> = {
  draft: {
    title: "Finish your application",
    description: "Complete your details and required documents, then submit your application.",
    action: "Continue application",
    edit: true,
    step: 0,
    stepStatus: "Not submitted",
    icon: FilePenLineIcon,
  },
  submitted: {
    title: "Application submitted",
    description: "Your application is waiting for review. No action is needed right now.",
    action: "View application",
    step: 0,
    stepStatus: "Awaiting review",
    icon: Clock3Icon,
  },
  under_review: {
    title: "Application under review",
    description: "The registrar is reviewing your application. No action is needed right now.",
    action: "View application",
    step: 1,
    stepStatus: "In progress",
    icon: Clock3Icon,
  },
  returned: {
    title: "Update your application",
    description: "Review the requested corrections, update your application, and submit it again.",
    action: "Update application",
    edit: true,
    step: 1,
    stepStatus: "Action needed",
    icon: TriangleAlertIcon,
  },
  accepted: {
    title: "Application accepted",
    description: "View the admission decision and check your application for any outstanding documents.",
    action: "View decision",
    step: 2,
    stepStatus: "Accepted",
    icon: CircleCheckIcon,
  },
  rejected: {
    title: "Application not accepted",
    description: "View the admission decision for details and any available next steps.",
    action: "View decision",
    step: 2,
    stepStatus: "Not accepted",
    icon: CircleXIcon,
  },
};

function statusTone(status: ApplicationStatus) {
  if (status === "returned") return "text-amber-700 dark:text-amber-300";
  if (status === "accepted") return "text-emerald-700 dark:text-emerald-300";
  if (status === "rejected") return "text-destructive";
  return "text-primary";
}

function ApplicationProgress({ status }: { status: ApplicationStatus }) {
  const state = overviewStates[status];
  const steps = ["Submission", status === "returned" ? "Corrections" : "Review", "Decision"];

  return (
    <section aria-labelledby="application-progress-heading" className="border-t bg-muted/20 p-5 sm:p-6">
      <h3 id="application-progress-heading" className="mb-5 text-sm font-semibold">Application progress</h3>
      <ol role="list" className="grid gap-5 sm:grid-cols-3 sm:gap-4">
        {steps.map((label, index) => {
          const complete = index < state.step;
          const current = index === state.step;
          return (
            <li key={index} aria-current={current ? "step" : undefined} className="relative flex min-w-0 items-start gap-3 sm:flex-col">
              {index < steps.length - 1 && <span aria-hidden="true" className={cn(
                "absolute top-10 -bottom-3 left-4 w-px bg-border sm:top-4 sm:right-0 sm:bottom-auto sm:left-11 sm:h-px sm:w-auto",
                complete && "bg-primary/30",
              )} />}
              <span aria-hidden="true" className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold text-muted-foreground",
                complete && "border-primary/30 text-primary",
                current && "border-current",
                current && statusTone(status),
              )}>
                {complete ? <CheckIcon className="size-4" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", !complete && !current && "text-muted-foreground")}>{label}</p>
                <p className={cn("mt-1 text-xs leading-relaxed text-muted-foreground", current && statusTone(status))}>
                  {current && <span className="sr-only">Current stage: </span>}
                  {complete ? "Completed" : current ? state.stepStatus : "Upcoming"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ApplicantOverview() {
  const user = useAuthStore((state) => state.user);
  const query = useApplications();
  const applications = query.data ?? [];
  const current = applications.find((application) => isActiveStatus(application.status));
  const latest = current ?? applications[0];
  const state = latest ? overviewStates[latest.status] : null;
  const StatusIcon = state?.icon ?? FileTextIcon;
  const note = latest && (latest.status === "returned" || latest.status === "rejected")
    ? latest.decisionNote?.trim()
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader title="My application" description={<span className="wrap-anywhere">{user?.name ?? "Track your enrollment application."}</span>} />

      {query.isLoading ? (
        <Card role="status" aria-busy="true" className="gap-6 p-5 sm:p-6">
          <span className="sr-only">Loading your application</span>
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-11 w-40" />
          <div className="grid gap-5 border-t pt-6 sm:grid-cols-3">
            {[0, 1, 2].map(item => <Skeleton key={item} className="h-16 w-full" />)}
          </div>
        </Card>
      ) : query.isError ? (
        <Card role="alert" className="items-start gap-3 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Application unavailable</h2>
          <p className="text-sm text-muted-foreground">Your application could not be loaded. Please try again.</p>
          <Button variant="outline" className="mt-1 min-h-11" onClick={() => query.refetch()}>Try again</Button>
        </Card>
      ) : !latest || !state ? (
        <Card className="p-5 sm:p-6">
          <EmptyState
            icon={FileTextIcon}
            title="No application yet"
            description="Choose a program and submit your requirements to begin."
            action={<Button asChild className="min-h-11"><Link to="/portal/application/new"><PlusIcon aria-hidden="true" />Start application</Link></Button>}
          />
        </Card>
      ) : (
        <Card className="gap-0 py-0" aria-labelledby="application-status-heading">
          <div className={cn("space-y-5 p-5 sm:p-6", latest.status === "returned" && "bg-amber-500/5")}>
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className={cn("mt-0.5 size-6 shrink-0", statusTone(latest.status))} />
              <div role="status" aria-atomic="true" className="min-w-0 space-y-2">
                <h2 id="application-status-heading" className="text-xl font-semibold wrap-anywhere">{state.title}</h2>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{state.description}</p>
              </div>
            </div>

            {note && <section aria-labelledby="application-note-heading" className="space-y-2 border-t pt-4">
              <h3 id="application-note-heading" className="text-sm font-semibold">{latest.status === "returned" ? "Requested corrections" : "Note from the registrar"}</h3>
              <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{note}</p>
            </section>}

            <Button asChild variant={state.edit ? "default" : "outline"} className="min-h-11 w-full sm:w-auto">
              <Link to={`/portal/application/${latest.id}${state.edit ? "/edit" : ""}`}>
                {state.action}<ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <ApplicationProgress status={latest.status} />

          <dl className="grid gap-x-6 gap-y-5 border-t p-5 text-sm sm:grid-cols-3 sm:p-6">
            <div className="min-w-0 sm:col-span-3">
              <dt className="text-muted-foreground">Program</dt>
              <dd className="mt-1 font-medium wrap-anywhere">{latest.program}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Application reference</dt>
              <dd className="mt-1 font-medium wrap-anywhere">{latest.reference}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">School year</dt>
              <dd className="mt-1 font-medium wrap-anywhere">{latest.schoolYear}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="mt-1 font-medium">{formatDate(latest.updatedAt)}</dd>
            </div>
          </dl>
        </Card>
      )}
    </div>
  );
}
