import { ArrowUpRightIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PaymentProofDialogProps {
  // The proof URL to preview; null closes the dialog.
  url: string | null;
  onOpenChange: (open: boolean) => void;
}

// Previews a proof-of-payment inline in a modal instead of opening a new tab.
// Proofs are screenshots (rendered as an image); PDFs fall back to an iframe.
export function PaymentProofDialog({ url, onOpenChange }: PaymentProofDialogProps) {
  const open = url !== null;
  const isPdf = (url ?? "").split("?")[0].toLowerCase().endsWith(".pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Proof of payment</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/40 flex h-[70vh] items-center justify-center overflow-hidden rounded-md border">
          {url &&
            (isPdf ? (
              <iframe
                src={url}
                title="Proof of payment"
                className="h-full w-full"
              />
            ) : (
              <img
                src={url}
                alt="Proof of payment"
                className="max-h-full max-w-full object-contain"
              />
            ))}
        </div>

        {url && (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                Open in new tab
                <ArrowUpRightIcon />
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
