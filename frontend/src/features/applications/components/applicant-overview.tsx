import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, FileTextIcon, PlusIcon } from "lucide-react";
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
import { useAuthStore } from "@/features/auth/store";
import { useApplications } from "../hooks/use-applications";
import { isActiveStatus, APPLICATION_STATUS_META } from "../types";
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          Track your enrollment application and what to do next.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-44 w-full rounded-lg" />
      ) : latest ? (
        <Card className="border-l-primary border-l-4">
          <CardHeader>
            <CardDescription className="text-xs font-medium tracking-wide uppercase">
              {latest.reference}
            </CardDescription>
            <CardTitle className="text-lg">{latest.program}</CardTitle>
            <CardAction>
              <ApplicationStatusBadge status={latest.status} />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-muted-foreground text-sm">
              {APPLICATION_STATUS_META[latest.status].description}
            </p>
            <div className="flex justify-end">
              <Button onClick={() => navigate("/portal/application")}>
                View application
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
            <Button onClick={() => navigate("/portal/application/new")}>
              <PlusIcon />
              Start application
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
