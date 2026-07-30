import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowRightIcon,
  ArrowRightLeftIcon,
  CircleCheckIcon,
  CircleXIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldLabel } from "@/components/form/field-label";
import { useProgramGroups } from "@/features/programs/hooks";
import { useProgramTransferStore } from "@/features/program-transfers/store";
import {
  TRANSFER_STATUS_META,
  type TransferRequest,
  type TransferRequestStatus,
} from "@/features/program-transfers/types";
import { Separator } from "@/components/ui/separator";

function formatDate(value: string) {
  return format(new Date(value), "PP");
}

function TransferStatusBadge({ status }: { status: TransferRequestStatus }) {
  const meta = TRANSFER_STATUS_META[status];
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

function RequestTransferDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  studentNumber,
  currentProgramCode,
  currentProgramName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number;
  studentName: string;
  studentNumber: string;
  currentProgramCode: string;
  currentProgramName: string;
}) {
  const programGroups = useProgramGroups();
  const submitRequest = useProgramTransferStore((state) => state.submitRequest);
  const [toCode, setToCode] = useState("");
  const [reason, setReason] = useState("");

  // Can't "transfer" into the program already enrolled in.
  const groups = programGroups
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) => option.value !== currentProgramCode,
      ),
    }))
    .filter((group) => group.options.length > 0);

  const selectedLabel = groups
    .flatMap((group) => group.options)
    .find((option) => option.value === toCode)?.label;

  function reset() {
    setToCode("");
    setReason("");
  }

  function handleSubmit() {
    if (!toCode || reason.trim() === "" || !selectedLabel) return;
    submitRequest({
      studentId,
      studentName,
      studentNumber,
      fromProgramCode: currentProgramCode,
      fromProgramName: currentProgramName,
      toProgramCode: toCode,
      toProgramName: selectedLabel,
      reason: reason.trim(),
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-full">
        <DialogHeader>
          <DialogTitle>Request a program transfer</DialogTitle>
          <DialogDescription>
            Sent to the registrar for review. You'll see the decision here
            once it's made.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="transfer-target" required>
              Transfer to
            </FieldLabel>
            <Select value={toCode} onValueChange={setToCode}>
              <SelectTrigger id="transfer-target" className="w-full">
                <SelectValue placeholder="Select a program" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="transfer-reason" required>
              Reason
            </FieldLabel>
            <Textarea
              id="transfer-reason"
              rows={3}
              value={reason}
              placeholder="Why do you want to transfer?"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {selectedLabel && (
            <div className="bg-muted/30 items-center gap-3 rounded-lg border p-3 text-sm space-y-2">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">From</span>
                <span className="min-w-0 truncate font-medium">
                  {currentProgramName}
                </span>
              </div>
              <Separator />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">To</span>
                <span className="min-w-0 truncate font-medium">
                  {selectedLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!toCode || reason.trim() === ""}
          >
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryEntry({ request }: { request: TransferRequest }) {
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate font-medium">
            {request.fromProgramName}
          </span>
          <ArrowRightIcon className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate font-medium">{request.toProgramName}</span>
        </div>
        <TransferStatusBadge status={request.status} />
      </div>
      {request.decisionNote && (
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          {request.status === "approved" ? (
            <CircleCheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
          ) : (
            <CircleXIcon className="mt-0.5 size-3.5 shrink-0 text-red-600" />
          )}
          <span>{request.decisionNote}</span>
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Submitted {formatDate(request.requestedAt)}
        {request.decidedAt && ` · Decided ${formatDate(request.decidedAt)}`}
      </p>
    </li>
  );
}

export function TransferRequestPanel({
  studentId,
  studentName,
  studentNumber,
  currentProgramCode,
  currentProgramName,
}: {
  studentId: number;
  studentName: string;
  studentNumber: string;
  currentProgramCode: string;
  currentProgramName: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const allRequests = useProgramTransferStore((state) => state.requests);

  const myRequests = allRequests
    .filter((r) => r.studentId === studentId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const pending = myRequests.find((r) => r.status === "pending") ?? null;
  const history = myRequests.filter((r) => r.id !== pending?.id);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base">Request a transfer</CardTitle>
          <CardDescription>
            Ask to move to a different track or strand. The registrar reviews
            every request before it takes effect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {pending.fromProgramName}
                  </span>
                  <ArrowRightIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 truncate font-medium">
                    {pending.toProgramName}
                  </span>
                </div>
                <TransferStatusBadge status={pending.status} />
              </div>
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {pending.reason}
              </p>
              <p className="text-muted-foreground text-xs">
                Submitted {formatDate(pending.requestedAt)} · Waiting on the
                registrar's decision.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
                <ArrowRightLeftIcon className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No active transfer request</p>
                <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                  You can request to move to a different track or strand at
                  any time.
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <ArrowRightLeftIcon />
                Request transfer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">Past requests</CardTitle>
            <CardDescription>
              Previously decided transfer requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {history.map((request) => (
                <HistoryEntry key={request.id} request={request} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <RequestTransferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        studentId={studentId}
        studentName={studentName}
        studentNumber={studentNumber}
        currentProgramCode={currentProgramCode}
        currentProgramName={currentProgramName}
      />
    </div>
  );
}
