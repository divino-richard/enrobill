import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldLabel } from "@/components/form/field-label";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAuthStore } from "@/features/auth/store";
import { UserRoleBadge } from "@/features/users/components/user-role-badge";
import { useUpdateUserRole, useUser } from "@/features/users/hooks";
import {
  USER_ROLE_OPTIONS,
  type User,
  type UserRole,
} from "@/features/users/types";
import { formatDate } from "@/features/applications/utils";

function UserRoleForm({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const update = useUpdateUserRole(user.id);
  const [saved, setSaved] = useState(false);

  const dirty = role !== user.role;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    try {
      await update.mutateAsync(role);
      setSaved(true);
    } catch {
      // Surfaced below via update.isError.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="max-w-xs space-y-1.5">
        <FieldLabel htmlFor="role" required>
          Role
        </FieldLabel>
        <Select
          value={role}
          onValueChange={(value) => {
            setSaved(false);
            setRole(value as UserRole);
          }}
          disabled={isSelf}
        >
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSelf && (
          <p className="text-muted-foreground text-xs">
            You can't change your own role.
          </p>
        )}
      </div>

      {update.isError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3"
        >
          <CircleAlertIcon className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm">{getErrorMessage(update.error)}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        {saved && !dirty && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-500" />
            Saved
          </span>
        )}
        <Button type="submit" disabled={!dirty || isSelf || update.isPending}>
          {update.isPending ? "Saving…" : "Save role"}
        </Button>
      </div>
    </form>
  );
}

function UserDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const userId = Number(id);
  const { data: user, isLoading, isError, refetch } = useUser(userId);
  const currentUser = useAuthStore((state) => state.user);
  const isSelf = currentUser?.id === userId;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => navigate("/admin/users")}
      >
        <ArrowLeftIcon />
        Back to Users
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
      ) : isError || !user ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <p className="text-muted-foreground text-sm">
              We couldn't load this user. Please try again.
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
                {user.email}
              </CardDescription>
              <CardTitle className="text-lg">{user.name}</CardTitle>
              <CardAction>
                <UserRoleBadge role={user.role} />
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-xs">Email status</dt>
                  <dd className="font-medium">
                    {user.emailVerified ? "Verified" : "Unverified"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Joined</dt>
                  <dd className="font-medium">{formatDate(user.createdAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage role</CardTitle>
              <CardDescription>
                Change what this user can access across the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserRoleForm user={user} isSelf={isSelf} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default UserDetailPage;
