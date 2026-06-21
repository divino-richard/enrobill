import { useState } from "react";
import { CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FieldLabel } from "@/components/form/field-label";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useAccount,
  useUpdatePassword,
  useUpdateProfile,
} from "@/features/account/hooks";
import type { AccountProfile } from "@/features/account/types";

function SuccessAlert({ message }: { message: string }) {
  return (
    <Alert className="border-primary bg-primary-foreground text-primary">
      <CheckCircle2Icon className="size-4 shrink-0" />
      <AlertTitle>Saved</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function ErrorAlert({ error }: { error: unknown }) {
  return (
    <Alert className="border-destructive bg-red-50 text-destructive">
      <CircleAlertIcon className="mt-0.5 size-5 shrink-0" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{getErrorMessage(error)}</AlertDescription>
    </Alert>
  );
}

function ProfileForm({ profile }: { profile: AccountProfile }) {
  const update = useUpdateProfile();
  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [middleName, setMiddleName] = useState(profile.middleName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Update your personal details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ firstName, middleName, lastName });
          }}
        >
          {update.isSuccess && <SuccessAlert message="Profile updated." />}
          {update.isError && <ErrorAlert error={update.error} />}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="firstName" required>
                First Name
              </FieldLabel>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="middleName" optional>
                Middle Name
              </FieldLabel>
              <Input
                id="middleName"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="lastName" required>
                Last Name
              </FieldLabel>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="email" hint="Contact an administrator to change your email.">
              Email
            </FieldLabel>
            <Input id="email" value={profile.email} disabled readOnly />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={update.isPending || !firstName.trim() || !lastName.trim()}
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const update = useUpdatePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const reset = () => {
    setCurrentPassword("");
    setPassword("");
    setPasswordConfirmation("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Password</CardTitle>
        <CardDescription>
          Use at least 8 characters with an uppercase letter and a number.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              { currentPassword, password, passwordConfirmation },
              { onSuccess: reset },
            );
          }}
        >
          {update.isSuccess && (
            <SuccessAlert message="Your password has been updated." />
          )}
          {update.isError && <ErrorAlert error={update.error} />}

          <div className="space-y-1.5">
            <FieldLabel htmlFor="currentPassword" required>
              Current Password
            </FieldLabel>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="password" required>
                New Password
              </FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="passwordConfirmation" required>
                Confirm New Password
              </FieldLabel>
              <Input
                id="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                update.isPending ||
                !currentPassword ||
                !password ||
                !passwordConfirmation
              }
            >
              {update.isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountPage() {
  const { data: profile, isLoading, isError, refetch } = useAccount();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile and password.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ) : isError || !profile ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load your account. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {/* Remount the profile form if the underlying record changes. */}
          <ProfileForm key={profile.id} profile={profile} />
          <PasswordForm />
        </>
      )}
    </div>
  );
}

export default AccountPage;
