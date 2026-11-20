import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/features/auth/store";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUpdateUserStatus } from "../hooks";
import type { User } from "../types";

export function UserStatusDialog({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const updateStatus = useUpdateUserStatus(user.id);
  const isSelf = user.id === currentUserId;
  const action = user.isActive ? "Deactivate" : "Reactivate";

  function close() {
    if (!updateStatus.isPending) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent showCloseButton={!updateStatus.isPending}>
        <DialogHeader>
          <DialogTitle>{action} user account?</DialogTitle>
          <DialogDescription className="break-words">
            {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            {user.isActive
              ? "This user will be signed out of all sessions and cannot sign in until their account is reactivated."
              : "This user can sign in again with their existing credentials. Email verification requirements still apply."}
          </p>
          <p className="text-muted-foreground">
            Their records and assignments will be retained.
            {user.isActive && user.role === "teacher" &&
              " Reassign their classes to another teacher if needed."}
          </p>
          {isSelf && (
            <p className="text-muted-foreground">
              You cannot deactivate your own account.
            </p>
          )}
          {updateStatus.isError && (
            <p role="alert" className="text-destructive">
              {getErrorMessage(updateStatus.error, "We couldn't update this account. Please try again.")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={updateStatus.isPending} onClick={close}>
            Cancel
          </Button>
          <Button
            variant={user.isActive ? "destructive" : "default"}
            disabled={isSelf || updateStatus.isPending}
            onClick={() => updateStatus.mutate(!user.isActive, { onSuccess: onClose })}
          >
            {updateStatus.isPending && <Loader2Icon className="animate-spin" />}
            {updateStatus.isPending
              ? user.isActive ? "Deactivating…" : "Reactivating…"
              : `${action} user`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
