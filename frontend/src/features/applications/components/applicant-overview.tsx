import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  PlusIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/features/auth/store";
import { useApplications } from "../hooks/use-applications";
import {
  isActiveStatus,
  APPLICATION_STATUS_META,
  type ApplicationStatus,
} from "../types";
import { formatDate } from "../utils";
import { ApplicationStatusBadge } from "./application-status-badge";

// Applicant home: a snapshot of where their application stands, with a clear
// next action.
export function ApplicantOverview() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data, isLoading } = useApplications();

  const applications = data ?? [];
  const current = applications.find((app) => isActiveStatus(app.status));
  const latest = current ?? applications[0];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          Track your enrollment application and what to do next.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : latest ? (
        <Card className="border-primary/10 bg-linear-to-br from-primary/8 via-background to-muted/60">
          <CardHeader>
            <CardDescription className="text-xs font-medium tracking-wide uppercase">
              {latest.reference}
            </CardDescription>
            <CardTitle className="text-lg">{latest.program}</CardTitle>
            <CardAction>
              <ApplicationStatusBadge status={latest.status} />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground text-sm">
              {APPLICATION_STATUS_META[latest.status].description}
            </p>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field
                icon={CalendarDaysIcon}
                label="School Year"
                value={latest.schoolYear}
              />
              <Field
                icon={ClockIcon}
                label="Last updated"
                value={formatDate(latest.updatedAt)}
              />
            </dl>

            <ApplicationProgress status={latest.status} />

            <div className="flex justify-end">
              <Button
                variant={nextAction(latest.status).variant}
                onClick={() => navigate(`/portal/application/${latest.id}`)}
              >
                {nextAction(latest.status).label}
                <ArrowRightIcon />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <FileTextIcon className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Start your enrollment</h3>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                Submit an application to apply for admission. You can track its
                status here once submitted.
              </p>
            </div>
            <Button onClick={() => navigate("/portal/application")}>
              <PlusIcon />
              Start your application
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

type StepState =
  | "done"
  | "current"
  | "pending"
  | "returned"
  | "accepted"
  | "rejected";

const PROGRESS_STEPS = ["Submitted", "Under review", "Decision"] as const;

// The three lifecycle milestones' states for a given status. Handles the two
// branches off the happy path: "returned" (back to the applicant) and the
// accepted/rejected outcomes.
function stepStates(status: ApplicationStatus): [StepState, StepState, StepState] {
  switch (status) {
    case "draft":
      return ["current", "pending", "pending"];
    case "submitted":
    case "under_review":
      return ["done", "current", "pending"];
    case "returned":
      return ["done", "returned", "pending"];
    case "accepted":
      return ["done", "done", "accepted"];
    case "rejected":
      return ["done", "done", "rejected"];
  }
}

function ApplicationProgress({ status }: { status: ApplicationStatus }) {
  const states = stepStates(status);

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {PROGRESS_STEPS.map((label, index) => (
          <Fragment key={label}>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                nodeClass(states[index]),
              )}
            >
              {nodeIcon(states[index], index)}
            </span>
            {index < PROGRESS_STEPS.length - 1 && (
              <span
                className={cn(
                  "mx-2 h-0.5 flex-1 rounded-full",
                  isComplete(states[index]) ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </Fragment>
        ))}
      </div>
      <div className="flex justify-between">
        {PROGRESS_STEPS.map((label, index) => (
          <span
            key={label}
            className={cn(
              "text-[11px]",
              states[index] === "pending"
                ? "text-muted-foreground"
                : "font-medium",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function isComplete(state: StepState): boolean {
  return state === "done" || state === "accepted";
}

function nodeClass(state: StepState): string {
  switch (state) {
    case "done":
      return "border-primary bg-primary text-primary-foreground";
    case "current":
      return "border-primary bg-primary/10 text-primary";
    case "accepted":
      return "border-emerald-500 bg-emerald-500 text-white";
    case "returned":
      return "border-amber-500 bg-amber-500 text-white";
    case "rejected":
      return "border-red-500 bg-red-500 text-white";
    case "pending":
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

function nodeIcon(state: StepState, index: number) {
  switch (state) {
    case "done":
    case "accepted":
      return <CheckIcon className="size-3.5" />;
    case "rejected":
      return <XIcon className="size-3.5" />;
    case "returned":
      return <AlertTriangleIcon className="size-3.5" />;
    default:
      return index + 1;
  }
}

// The primary action to surface for each status: finish a draft, fix a returned
// application, or simply review an in-flight / decided one.
function nextAction(status: ApplicationStatus): {
  label: string;
  variant: "default" | "outline";
} {
  switch (status) {
    case "draft":
      return { label: "Continue application", variant: "default" };
    case "returned":
      return { label: "Update & resubmit", variant: "default" };
    default:
      return { label: "View application", variant: "outline" };
  }
}
