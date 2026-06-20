import { useState } from "react";
import { CheckCircle2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldLabel } from "@/components/form/field-label";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useAdminPaymentChannels,
  useUpdatePaymentChannel,
} from "@/features/payment-channels/hooks";
import { uploadPaymentChannelQr } from "@/features/payment-channels/api";
import type { PaymentChannel } from "@/features/payment-channels/types";

function ChannelCard({ channel }: { channel: PaymentChannel }) {
  const update = useUpdatePaymentChannel(channel.id);
  const [accountName, setAccountName] = useState(channel.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    channel.accountNumber ?? "",
  );
  const [isActive, setIsActive] = useState(channel.isActive);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function pickFile(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    setSaved(false);
  }

  async function handleSave() {
    setSaved(false);
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
      setFile(null);
      setSaved(true);
    } catch (error) {
      setUploadError(getErrorMessage(error));
    }
  }

  const shownQr = preview ?? channel.qrUrl;
  const busy = update.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{channel.label}</CardTitle>
        <CardDescription>
          Account details and QR code students scan to pay.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`name-${channel.id}`}>Account name</FieldLabel>
            <Input
              id={`name-${channel.id}`}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`number-${channel.id}`}>
              Account / mobile number
            </FieldLabel>
            <Input
              id={`number-${channel.id}`}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="bg-muted flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-md border">
            {shownQr ? (
              <img
                src={shownQr}
                alt={`${channel.label} QR`}
                className="size-full object-contain"
              />
            ) : (
              <span className="text-muted-foreground px-2 text-center text-xs">
                No QR yet
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`qr-${channel.id}`}>QR image</FieldLabel>
            <Input
              id={`qr-${channel.id}`}
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-xs">PNG or JPG, up to 5 MB.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isActive}
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          Active (shown to students)
        </label>

        {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={busy}>
            <UploadIcon />
            {busy ? "Saving…" : "Save"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-4" />
              Saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentChannelsPage() {
  const { data, isLoading, isError, refetch } = useAdminPaymentChannels();
  const channels = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payment Methods</h1>
        <p className="text-muted-foreground text-sm">
          Set the GCash and Maya account details and QR codes students use to pay
          their bills.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}
    </div>
  );
}

export default PaymentChannelsPage;
