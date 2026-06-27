import { useState } from "react";
import { CheckCircle2Icon, UploadIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldLabel } from "@/components/form/field-label";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAuthStore } from "@/features/auth/store";
import {
  useAdminPaymentChannels,
  useUpdatePaymentChannel,
} from "@/features/payment-channels/hooks";
import { uploadPaymentChannelQr } from "@/features/payment-channels/api";
import type { PaymentChannel } from "@/features/payment-channels/types";

function ChannelCard({
  channel,
  readOnly,
}: {
  channel: PaymentChannel;
  readOnly: boolean;
}) {
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
    if (readOnly) return;
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
  const isBank = channel.code === "bank";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{channel.label}</CardTitle>
        <CardDescription>
          {isBank
            ? "Bank account details students transfer to. A QR is optional."
            : "Account details and QR code students scan to pay."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-4xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`name-${channel.id}`}>
              {isBank ? "Bank name" : "Account name"}
            </FieldLabel>
            <Input
              id={`name-${channel.id}`}
              value={accountName}
              placeholder={isBank ? "e.g. BPI" : undefined}
              disabled={readOnly || busy}
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
              disabled={readOnly || busy}
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
            <FieldLabel htmlFor={`qr-${channel.id}`}>
              {isBank ? "QR image (optional)" : "QR image"}
            </FieldLabel>
            <Input
              id={`qr-${channel.id}`}
              type="file"
              accept="image/png,image/jpeg"
              disabled={readOnly || busy}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-xs">PNG or JPG, up to 5 MB.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isActive}
            disabled={readOnly || busy}
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          Active (shown to students)
        </label>

        {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}

        <div className="flex items-center gap-3">
          {readOnly ? (
            <p className="text-muted-foreground text-sm">
              Cashiers manage these payment method details. Admin access is
              read-only.
            </p>
          ) : (
            <Button onClick={handleSave} disabled={busy}>
              <UploadIcon />
              {busy ? "Saving…" : "Save"}
            </Button>
          )}
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
  const role = useAuthStore((state) => state.user?.role);
  const isReadOnly = role === "admin";
  const { data, isLoading, isError, refetch } = useAdminPaymentChannels();
  const channels = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payment Methods</h1>
        <p className="text-muted-foreground text-sm">
          Set the account details and QR codes students use to pay their bills.
        </p>
      </div>

      {isReadOnly && (
        <Alert className="border-border/70 bg-muted/30">
          <AlertTitle>Read-only for admins</AlertTitle>
          <AlertDescription>
            Cashiers manage payment method details and QR uploads. Admins can
            review the configured channels here.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-72 rounded-md" />
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
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            No payment methods configured.
          </p>
        </div>
      ) : (
        <Tabs defaultValue={channels[0]?.code}>
          <TabsList>
            {channels.map((channel) => (
              <TabsTrigger key={channel.id} value={channel.code}>
                {channel.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {channels.map((channel) => (
            <TabsContent key={channel.id} value={channel.code}>
              <ChannelCard channel={channel} readOnly={isReadOnly} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

export default PaymentChannelsPage;
