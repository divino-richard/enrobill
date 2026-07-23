import { useRef, useState } from "react";
import {
  PencilIcon,
  PlusIcon,
  QrCodeIcon,
  SettingsIcon,
  Trash2Icon,
  UploadIcon,
  WalletIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/form/field-label";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAuthStore } from "@/features/auth/store";
import {
  useAdminPaymentChannels,
  useCreatePaymentChannel,
  useDeletePaymentChannel,
  useUpdatePaymentChannel,
} from "@/features/payment-channels/hooks";
import { uploadPaymentChannelQr } from "@/features/payment-channels/api";
import type { PaymentChannel } from "@/features/payment-channels/types";

// Students can only pay to a method that has something to pay against — the API
// hides anything with neither an account number nor a QR. A method missing both
// is "needs setup" rather than merely inactive.
const isConfigured = (channel: PaymentChannel) =>
  Boolean(channel.accountNumber || channel.hasQr);

const isBankLike = (channel: PaymentChannel) => channel.code === "bank";

// --- Method card ------------------------------------------------------------

function ChannelCard({
  channel,
  readOnly,
  onEdit,
  onDelete,
}: {
  channel: PaymentChannel;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const configured = isConfigured(channel);
  const isBank = isBankLike(channel);

  return (
    <Card className={cn(!configured && "border-dashed")}>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate font-medium">{channel.label}</p>
            <p className="text-muted-foreground text-xs">
              {isBank ? "Bank transfer" : "Scan to pay"}
            </p>
          </div>
          {configured ? (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0",
                channel.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
              )}
            >
              {channel.isActive ? "Visible" : "Hidden"}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
            >
              Needs setup
            </Badge>
          )}
        </div>

        <div className="flex items-start gap-4">
          <div className="bg-muted text-muted-foreground flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border">
            {channel.qrUrl ? (
              <img
                src={channel.qrUrl}
                alt={`${channel.label} QR`}
                className="size-full object-contain"
              />
            ) : (
              <QrCodeIcon className="size-6 opacity-40" />
            )}
          </div>
          <dl className="min-w-0 flex-1 space-y-2.5">
            <div className="space-y-0.5">
              <dt className="text-muted-foreground text-xs">
                {isBank ? "Bank name" : "Account name"}
              </dt>
              <dd className="truncate text-sm font-medium">
                {channel.accountName || "—"}
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground text-xs">
                {isBank ? "Account number" : "Account / mobile number"}
              </dt>
              <dd className="truncate text-sm font-medium">
                {channel.accountNumber || "—"}
              </dd>
            </div>
          </dl>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant={configured ? "outline" : "default"}
              className="flex-1"
              onClick={onEdit}
            >
              {configured ? <PencilIcon /> : <SettingsIcon />}
              {configured ? "Edit details" : "Finish setup"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${channel.label}`}
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={onDelete}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Edit dialog ------------------------------------------------------------

function EditChannelDialog({
  channel,
  onOpenChange,
}: {
  channel: PaymentChannel | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={channel !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{channel ? channel.label : ""}</DialogTitle>
          <DialogDescription>
            {channel
              ? isBankLike(channel)
                ? "Bank account details students transfer to. A QR is optional."
                : "Account details and QR code students scan to pay."
              : ""}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed + mounted only while open, so fields always seed from what's
            persisted — cancelling can't leave stale input behind. */}
        {channel && (
          <ChannelForm
            key={channel.id}
            channel={channel}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChannelForm({
  channel,
  onDone,
}: {
  channel: PaymentChannel;
  onDone: () => void;
}) {
  const update = useUpdatePaymentChannel(channel.id);
  const [accountName, setAccountName] = useState(channel.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    channel.accountNumber ?? "",
  );
  const [isActive, setIsActive] = useState(channel.isActive);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // The file input is uncontrolled, so clearing it needs a handle.
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(next: File | null) {
    // Release the previous preview before replacing it.
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return next ? URL.createObjectURL(next) : null;
    });
    setFile(next);
  }

  function clearPickedFile() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    setUploadError(null);
    try {
      let qrKey: string | undefined;
      if (file) {
        qrKey = await uploadPaymentChannelQr(channel.id, file);
      }
      await update.mutateAsync({
        accountName: accountName.trim() || null,
        accountNumber: accountNumber.trim() || null,
        isActive,
        qrKey,
      });
      if (preview) URL.revokeObjectURL(preview);
      onDone();
    } catch (error) {
      setUploadError(getErrorMessage(error));
    }
  }

  const shownQr = preview ?? channel.qrUrl;
  const busy = update.isPending;
  const isBank = isBankLike(channel);
  // Mirrors the API rule that decides whether students ever see this method.
  const payable = accountNumber.trim() !== "" || file !== null || channel.hasQr;

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`name-${channel.id}`}>
            {isBank ? "Bank name" : "Account name"}
          </FieldLabel>
          <Input
            id={`name-${channel.id}`}
            value={accountName}
            placeholder={isBank ? "e.g. BPI" : "e.g. Northlink Academy"}
            disabled={busy}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor={`number-${channel.id}`}>
            {isBank ? "Account number" : "Account / mobile number"}
          </FieldLabel>
          <Input
            id={`number-${channel.id}`}
            value={accountNumber}
            disabled={busy}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel htmlFor={`qr-${channel.id}`}>
            {isBank ? "QR image (optional)" : "QR image"}
          </FieldLabel>
          <div className="flex items-start gap-4">
            <div className="bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border">
              {shownQr ? (
                <img
                  src={shownQr}
                  alt={`${channel.label} QR`}
                  className="size-full object-contain"
                />
              ) : (
                <QrCodeIcon className="size-6 opacity-40" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Input
                ref={fileInputRef}
                id={`qr-${channel.id}`}
                type="file"
                accept="image/png,image/jpeg"
                disabled={busy}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">
                PNG or JPG, up to 5 MB.
                {channel.hasQr && !file && " Uploading replaces the current QR."}
              </p>
              {file && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground -ml-2"
                  disabled={busy}
                  onClick={clearPickedFile}
                >
                  Remove selected image
                </Button>
              )}
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <Checkbox
            checked={isActive}
            disabled={busy || !payable}
            className="mt-0.5"
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          <span>
            <span className="font-medium">Show to students</span>
            <span className="text-muted-foreground block text-xs">
              {payable
                ? "Students can select this method when paying a bill."
                : "Add an account number or QR image first."}
            </span>
          </span>
        </label>

        {uploadError && (
          <p className="text-destructive text-sm">{uploadError}</p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={busy}>
          <UploadIcon />
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

// --- Add dialog -------------------------------------------------------------

// The QR isn't collected here — presigning the upload needs a saved channel id —
// so the new method opens straight into its edit dialog afterwards.
function NewChannelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channel: PaymentChannel) => void;
}) {
  const create = useCreatePaymentChannel();
  const [label, setLabel] = useState("");

  function reset() {
    setLabel("");
    create.reset();
  }

  async function handleCreate() {
    if (label.trim() === "") return;
    try {
      const channel = await create.mutateAsync({
        label: label.trim(),
        accountName: null,
        accountNumber: null,
        // Nothing to pay against yet, so it stays hidden until it's set up.
        isActive: false,
      });
      reset();
      onCreated(channel);
    } catch {
      // Surfaced below via create.isError.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add payment method</DialogTitle>
          <DialogDescription>
            Name the method as students should see it. You'll add the account
            details and QR next.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <FieldLabel htmlFor="channel-label" required>
            Method name
          </FieldLabel>
          <Input
            id="channel-label"
            value={label}
            placeholder="e.g. GCash, Maya, BPI Bank Transfer"
            disabled={create.isPending}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
          />
        </div>

        {create.isError && (
          <p className="text-destructive text-sm">
            {getErrorMessage(create.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={label.trim() === "" || create.isPending}
          >
            {create.isPending ? "Adding…" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Page -------------------------------------------------------------------

function PaymentChannelsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isReadOnly = role === "admin";
  const { data, isLoading, isError, refetch } = useAdminPaymentChannels();
  const channels = data ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentChannel | null>(null);
  const [deleting, setDeleting] = useState<PaymentChannel | null>(null);
  const remove = useDeletePaymentChannel();

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Kept open so the refusal reason stays visible.
    }
  }

  const needsSetup = channels.filter((c) => !isConfigured(c));
  const liveCount = channels.filter(
    (c) => isConfigured(c) && c.isActive,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment Methods
          </h1>
          <p className="text-muted-foreground text-sm">
            The accounts and QR codes students pay their bills to.
          </p>
        </div>
        {!isReadOnly && channels.length > 0 && (
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add payment method
          </Button>
        )}
      </div>

      {isReadOnly && (
        <Alert className="border-border/70 bg-muted/30">
          <AlertTitle>Read-only for admins</AlertTitle>
          <AlertDescription>
            Cashiers manage payment method details and QR uploads. Admins can
            review the configured methods here.
          </AlertDescription>
        </Alert>
      )}

      {/* One line telling the cashier whether students can actually pay. */}
      {!isLoading && !isError && channels.length > 0 && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            liveCount === 0
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              : "border-muted-foreground/20 bg-muted text-muted-foreground",
          )}
        >
          <WalletIcon className="size-4 shrink-0" />
          {liveCount === 0 ? (
            <span>
              No payment method is visible to students yet — they can't pay a
              bill until one is set up and shown.
            </span>
          ) : (
            <span>
              <span className="font-medium">
                {liveCount} of {channels.length}
              </span>{" "}
              {liveCount === 1 ? "method is" : "methods are"} visible to
              students
              {needsSetup.length > 0 &&
                ` · ${needsSetup.length} still ${
                  needsSetup.length === 1 ? "needs" : "need"
                } setup`}
              .
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load payment methods. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
            <WalletIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No payment methods yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              {isReadOnly
                ? "A cashier needs to add a payment method before students can pay their bills."
                : "Add a method — GCash, Maya, a bank account — so students have somewhere to pay their bills."}
            </p>
          </div>
          {!isReadOnly && (
            <Button onClick={() => setAddOpen(true)}>
              <PlusIcon />
              Add payment method
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              readOnly={isReadOnly}
              onEdit={() => setEditing(channel)}
              onDelete={() => setDeleting(channel)}
            />
          ))}
        </div>
      )}

      <NewChannelDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(channel) => {
          setAddOpen(false);
          // Straight into setup — a method with no details is useless.
          setEditing(channel);
        }}
      />

      <EditChannelDialog
        channel={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setDeleting(null);
            remove.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment method?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${deleting.label} will be removed along with its QR code. Students will no longer see it. This can't be undone.`
                : ""}
              <span className="mt-2 block">
                A method with recorded payments can't be deleted — hide it
                instead, so past receipts keep their details.
              </span>
              {remove.isError && (
                <span className="text-destructive mt-2 block">
                  {getErrorMessage(remove.error)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete method"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PaymentChannelsPage;
