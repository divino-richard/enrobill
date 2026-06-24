import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, CheckIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationSummary } from "@/features/applications/components/application-summary";
import { ApplicationStatusBadge } from "@/features/applications/components/application-status-badge";
import { DocumentViewerDialog } from "@/features/applications/components/document-viewer-dialog";
import {
  useAdminApplication,
  useDecideApplication,
} from "@/features/applications/hooks/use-applications";
import type { UploadedDocument } from "@/features/applications/documents";
import { formatDate } from "@/features/applications/utils";
import { getErrorMessage } from "@/lib/get-error-message";

const DECIDABLE_STATUSES = ["submitted", "under_review", "returned"];

function AdminApplicationDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const applicationId = Number(id);
  const { data: application, isLoading, isError, refetch } =
    useAdminApplication(applicationId);
  const decide = useDecideApplication(applicationId);
  const [viewingDocument, setViewingDocument] =
    useState<UploadedDocument | null>(null);
  const [pendingDecision, setPendingDecision] = useState<
    "accept" | "reject" | null
  >(null);
  const [note, setNote] = useState("");

  function openDecision(decision: "accept" | "reject") {
    setNote("");
    setPendingDecision(decision);
  }

  async function confirmDecision() {
    if (!pendingDecision) return;
    try {
      await decide.mutateAsync({
        decision: pendingDecision,
        note: note.trim() || null,
      });
    } catch {
      // Surfaced below via decide.isError.
    } finally {
      setPendingDecision(null);
    }
  }

  const canDecide =
    application != null && DECIDABLE_STATUSES.includes(application.status);
  const isReject = pendingDecision === "reject";

  return (
    <div className="mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => navigate("/admin/applications")}
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
          <Card>
            <CardHeader>
              <CardDescription className="text-xs font-medium tracking-wide uppercase">
                {application.reference}
              </CardDescription>
              <CardTitle className="text-lg">
                {application.applicant.name}
              </CardTitle>
              <CardAction>
                <ApplicationStatusBadge status={application.status} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground text-xs">Email</dt>
                  <dd className="truncate font-medium">
                    {application.applicant.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Program</dt>
                  <dd className="font-medium">{application.program}</dd>
                </div>
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
              </dl>

              {decide.isError && (
                <p className="text-destructive text-sm">
                  {getErrorMessage(decide.error)}
                </p>
              )}

              {canDecide ? (
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    variant="destructive"
                    disabled={decide.isPending}
                    onClick={() => openDecision("reject")}
                  >
                    <XIcon />
                    Reject
                  </Button>
                  <Button
                    disabled={decide.isPending}
                    onClick={() => openDecision("accept")}
                  >
                    <CheckIcon />
                    Accept
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-muted-foreground text-sm">
                    This application has already been decided.
                  </p>
                  {application.status === "rejected" &&
                    application.decisionNote && (
                      <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
                        <p className="text-destructive text-xs font-medium tracking-wide uppercase">
                          Rejection note
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-line">
                          {application.decisionNote}
                        </p>
                      </div>
                    )}
                </div>
              )}
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

          <AlertDialog
            open={pendingDecision !== null}
            onOpenChange={(open) => {
              if (!open && !decide.isPending) setPendingDecision(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isReject
                    ? "Reject this application?"
                    : "Accept this application?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isReject
                    ? "The application will be marked as rejected and the applicant will be notified by email. They can edit and resubmit it."
                    : "The application will be marked as accepted and the applicant becomes a student with a pending enrollment, notified by email. The cashier generates their bill afterwards."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {isReject && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="reject-note"
                    className="text-sm font-medium"
                  >
                    Note to the applicant{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <Textarea
                    id="reject-note"
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Reason for rejection or what to fix before resubmitting…"
                  />
                  <p className="text-muted-foreground text-xs">
                    Shown to the applicant and included in their email.
                  </p>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={decide.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={decide.isPending}
                  className={
                    isReject
                      ? cn(buttonVariants({ variant: "destructive" }))
                      : undefined
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    void confirmDecision();
                  }}
                >
                  {decide.isPending
                    ? "Working…"
                    : isReject
                      ? "Reject"
                      : "Accept"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

export default AdminApplicationDetailPage;
