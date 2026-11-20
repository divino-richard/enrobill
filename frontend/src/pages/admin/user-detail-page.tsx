import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";
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
import { UserRoleBadge } from "@/features/users/components/user-role-badge";
import { UserStatusBadge } from "@/features/users/components/user-status-badge";
import { UserStatusDialog } from "@/features/users/components/user-status-dialog";
import { useAuthStore } from "@/features/auth/store";
import { useUser } from "@/features/users/hooks";
import type { User } from "@/features/users/types";
import { formatDate } from "@/features/applications/utils";

function UserDetailPage() {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [statusTarget, setStatusTarget] = useState<User | null>(null);
  const { id } = useParams();
  const userId = Number(id);
  const { data: user, isLoading, isError, refetch } = useUser(userId);

  return (
    <div className="mx-auto space-y-4">
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
                  <dt className="text-muted-foreground text-xs">Account status</dt>
                  <dd className="mt-1"><UserStatusBadge isActive={user.isActive} /></dd>
                </div>
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
              <CardTitle>Account access</CardTitle>
              <CardDescription>
                {user.isActive
                  ? "Deactivate this account to block sign-in and end its current sessions."
                  : "This account is inactive. Reactivate it to allow sign-in again."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Records and assignments are retained when an account is deactivated.
                {user.role === "teacher" && " Reassign their classes to another teacher if needed."}
              </p>
              <Button
                variant={user.isActive ? "destructive" : "default"}
                disabled={user.id === currentUserId}
                aria-describedby={user.id === currentUserId ? "own-account-status" : undefined}
                onClick={() => setStatusTarget(user)}
              >
                {user.isActive ? "Deactivate user" : "Reactivate user"}
              </Button>
              {user.id === currentUserId && (
                <p id="own-account-status" className="text-muted-foreground text-sm">
                  You cannot deactivate your own account.
                </p>
              )}
            </CardContent>
          </Card>
          {statusTarget && (
            <UserStatusDialog user={statusTarget} onClose={() => setStatusTarget(null)} />
          )}
        </>
      )}
    </div>
  );
}

export default UserDetailPage;
