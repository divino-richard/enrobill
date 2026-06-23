import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
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
import { ApplicationSummary } from "@/features/applications/components/application-summary";
import { ApplicationStatusBadge } from "@/features/applications/components/application-status-badge";
import { DocumentViewerDialog } from "@/features/applications/components/document-viewer-dialog";
import {
  useApplication,
  useApplications,
} from "@/features/applications/hooks/use-applications";
import {
  APPLICATION_STATUS_META,
  isActiveStatus,
} from "@/features/applications/types";
import type { UploadedDocument } from "@/features/applications/documents";
import { useAuthStore } from "@/features/auth/store";
import { formatDate } from "@/features/applications/utils";

function ApplicationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: application, isLoading, isError, refetch } = useApplication(
    Number(id),
  );
  const { data: applications } = useApplications();
  const [viewingDocument, setViewingDocument] =
    useState<UploadedDocument | null>(null);
  const isStudent = useAuthStore((state) => state.user?.role) === "student";

  // Only applicants edit/resubmit a rejected application.
  const isRejected = application?.status === "rejected" && !isStudent;
  // Another in-progress application blocks resubmitting this one.
  const activeApplication = applications?.find((app) =>
    isActiveStatus(app.status),
  );
  const hasOtherActive =
    activeApplication != null && activeApplication.id !== application?.id;
  // An accepted application anywhere means the user is enrolled — no resubmit.
  const hasAccepted =
    applications?.some((app) => app.status === "accepted") ?? false;
  const resubmitBlocked = hasOtherActive || hasAccepted;

  return (
    <div className="mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => navigate("/portal/application")}
      >
        <ArrowLeftIcon />
        Back to Applications
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : isError || !application ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <p className="text-muted-foreground text-sm">
              We couldn't load this application. Please try again.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card
            className={
              isRejected ? "border-l-destructive border-l-4" : "border-l-primary border-l-4"
            }
          >
            <CardHeader>
              <CardDescription className="text-xs font-medium tracking-wide uppercase">
                {application.reference}
              </CardDescription>
              <CardTitle className="text-lg">{application.program}</CardTitle>
              <CardAction>
                <ApplicationStatusBadge status={application.status} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-muted-foreground text-sm">
                {APPLICATION_STATUS_META[application.status].description}
              </p>

              {application.status === "rejected" && application.decisionNote && (
                <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
                  <p className="text-destructive text-xs font-medium tracking-wide uppercase">
                    Note from the registrar
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-line">
                    {application.decisionNote}
                  </p>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-xs">School Year</dt>
                  <dd className="font-medium">{application.schoolYear}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Submitted</dt>
                  <dd className="font-medium">
                    {formatDate(application.submittedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Last updated</dt>
                  <dd className="font-medium">
                    {formatDate(application.updatedAt)}
                  </dd>
                </div>
              </dl>

              {isRejected &&
                (resubmitBlocked ? (
                  <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                    {hasAccepted
                      ? "You already have an accepted application, so this one can no longer be resubmitted."
                      : "You have another application in progress. Please resolve it before resubmitting this one."}
                  </p>
                ) : (
                  <div className="flex justify-end">
                    <Button
                      onClick={() =>
                        navigate(`/portal/application/${application.id}/edit`)
                      }
                    >
                      <PencilIcon />
                      Edit &amp; resubmit
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <ApplicationSummary
                values={application.values}
                enrollmentDate={
                  application.submittedAt
                    ? new Date(application.submittedAt)
                    : null
                }
                onViewDocument={setViewingDocument}
              />
            </CardContent>
          </Card>

          <DocumentViewerDialog
            applicationId={application.id}
            document={viewingDocument}
            onOpenChange={(open) => {
              if (!open) setViewingDocument(null);
            }}
          />
        </>
      )}
    </div>
  );
}

export default ApplicationDetailPage;
