import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckIcon,
  GraduationCapIcon,
  InfoIcon,
  MailIcon,
  TicketPercentIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
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
import { useAllDiscounts } from "@/features/discounts/hooks";
import { discountValueLabel } from "@/features/discounts/types";
import { getErrorMessage } from "@/lib/get-error-message";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DECIDABLE_STATUSES = ["submitted", "under_review", "returned"];

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  );
}

// One selectable voucher in the accept dialog. Single-choice, so it behaves as a
// radio — "No voucher" is one of the options rather than a cleared state.
function VoucherOption({
  checked,
  onSelect,
  title,
  meta,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  meta: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <input
        type="radio"
        name="accept-voucher"
        className="accent-primary size-4 shrink-0"
        checked={checked}
        onChange={onSelect}
      />
      <span className="flex-1 font-medium">{title}</span>
      <span
        className={cn(
          "text-xs font-medium",
          checked ? "text-primary" : "text-muted-foreground",
        )}
      >
        {meta}
      </span>
    </label>
  );
}

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
  // null = accept without granting a voucher, which is the default.
  const [voucherId, setVoucherId] = useState<number | null>(null);
  const { data: discounts, isLoading: vouchersLoading } = useAllDiscounts();

  const vouchers = (discounts ?? []).filter(
    (discount) => discount.isActive && discount.category === "voucher",
  );

  function openDecision(decision: "accept" | "reject") {
    setNote("");
    setVoucherId(null);
    setPendingDecision(decision);
  }

  async function confirmDecision() {
    if (!pendingDecision) return;
    try {
      await decide.mutateAsync({
        decision: pendingDecision,
        note: note.trim() || null,
        discountId: pendingDecision === "accept" ? voucherId : null,
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
    <div className="mx-auto w-full max-w-6xl space-y-6">
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
              <CardTitle className="text-xl">
                {application.applicant.name}
              </CardTitle>
              <CardAction>
                <ApplicationStatusBadge status={application.status} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm sm:grid-cols-4">
                <InfoField
                  icon={MailIcon}
                  label="Email"
                  value={application.applicant.email}
                />
                <InfoField
                  icon={GraduationCapIcon}
                  label="Program"
                  value={application.program}
                />
                <InfoField
                  icon={CalendarDaysIcon}
                  label="School year"
                  value={application.schoolYear}
                />
                <InfoField
                  icon={CalendarDaysIcon}
                  label="Submitted"
                  value={formatDate(application.submittedAt)}
                />
              </dl>

              {decide.isError && (
                <p className="text-destructive text-sm">
                  {getErrorMessage(decide.error)}
                </p>
              )}

              {canDecide ? (
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground text-sm">
                    Review the submitted details below before deciding.
                  </p>
                  <div className="flex gap-2">
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
            <CardHeader className="border-b">
              <CardTitle className="text-base">Submitted application</CardTitle>
              <CardDescription>
                Everything the applicant provided on their enrollment form.
              </CardDescription>
            </CardHeader>
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
                <AlertDialogTitle className="flex items-center gap-2">
                  {isReject
                    ? "Reject this application?"
                    : "Accept this application?"}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help"
                        onClick={(e) => e.preventDefault()}
                      >
                        <InfoIcon className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-pretty">
                      {isReject
                        ? "The application will be marked as rejected and the applicant will be notified by email. They can edit and resubmit it."
                        : "The application will be marked as accepted and the applicant becomes a student with a pending enrollment, notified by email. The cashier generates their bill afterwards."}
                    </TooltipContent>
                  </Tooltip>
                </AlertDialogTitle>
              </AlertDialogHeader>

              {!isReject && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TicketPercentIcon className="text-muted-foreground size-4" />
                      <p className="text-sm font-medium">Voucher</p>
                    </div>
                    {/* A radio can't be unpicked, so clearing needs its own control. */}
                    {voucherId !== null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground h-auto px-2 py-1 text-xs"
                        onClick={() => setVoucherId(null)}
                      >
                        <XIcon className="size-3.5" />
                        Remove
                      </Button>
                    )}
                  </div>

                  {vouchersLoading ? (
                    <Skeleton className="h-14 w-full rounded-lg" />
                  ) : vouchers.length === 0 ? (
                    <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs">
                      <InfoIcon className="size-4 shrink-0" />
                      <span>
                        No vouchers in the catalog. Add one under Vouchers first.
                      </span>
                    </div>
                  ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-0.5">
                      {vouchers.map((voucher) => (
                        <VoucherOption
                          key={voucher.id}
                          checked={voucherId === voucher.id}
                          onSelect={() => setVoucherId(voucher.id)}
                          title={voucher.name}
                          meta={discountValueLabel(voucher)}
                        />
                      ))}
                    </div>
                  )}

                  <p className="text-muted-foreground text-xs">
                    {voucherId === null
                      ? "Optional — leave none selected and the student pays in full."
                      : "Applied automatically when the cashier generates this student's bill, and it waives their downpayment."}
                  </p>
                </div>
              )}

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
