import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FieldLabel } from "@/components/form/field-label";
import { getErrorMessage } from "@/lib/get-error-message";
import { YEAR_LEVEL_OPTIONS } from "@/features/applications/types";
import { useProgramGroups } from "@/features/programs/hooks";
import { useOpenTerm } from "@/features/terms/hooks";
import { useAdmitStudent } from "../hooks";
import type { AdmitStudentValues } from "../types";

interface AdmitStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY: AdmitStudentValues = {
  email: "",
  password: "",
  passwordConfirmation: "",
  firstName: "",
  middleName: "",
  lastName: "",
  trackOrStrand: "",
  yearLevel: "",
  schoolYear: "",
};

export function AdmitStudentDialog({
  open,
  onOpenChange,
}: AdmitStudentDialogProps) {
  const { data: openTerm } = useOpenTerm();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Admit student</DialogTitle>
          <DialogDescription>
            Create a student and their login for a walk-in who didn't apply
            online. You can fill in the rest of their details afterwards.
          </DialogDescription>
        </DialogHeader>
        {/* Remount on open so fields (and the prefilled school year) reset. */}
        {open && (
          <AdmitForm
            key={openTerm?.schoolYear ?? "none"}
            defaultSchoolYear={openTerm?.schoolYear ?? ""}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdmitForm({
  defaultSchoolYear,
  onOpenChange,
}: {
  defaultSchoolYear: string;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const admit = useAdmitStudent();
  const programGroups = useProgramGroups();
  const [values, setValues] = useState<AdmitStudentValues>({
    ...EMPTY,
    schoolYear: defaultSchoolYear,
  });

  function set<K extends keyof AdmitStudentValues>(
    key: K,
    value: AdmitStudentValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const canSubmit =
    values.email.trim() &&
    values.password &&
    values.passwordConfirmation &&
    values.firstName.trim() &&
    values.lastName.trim() &&
    values.trackOrStrand &&
    values.yearLevel &&
    values.schoolYear.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const student = await admit.mutateAsync(values);
      onOpenChange(false);
      navigate(`/admin/students/${student.id}`);
    } catch {
      // Surfaced below via admit.isError.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {admit.isError && (
        <p className="text-destructive text-sm">
          {getErrorMessage(admit.error)}
        </p>
      )}

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Account
        </p>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="email" required>
            Email
          </FieldLabel>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="password" required>
              Password
            </FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="passwordConfirmation" required>
              Confirm Password
            </FieldLabel>
            <Input
              id="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              value={values.passwordConfirmation}
              onChange={(e) => set("passwordConfirmation", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Student
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="firstName" required>
              First Name
            </FieldLabel>
            <Input
              id="firstName"
              value={values.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="middleName" optional>
              Middle Name
            </FieldLabel>
            <Input
              id="middleName"
              value={values.middleName}
              onChange={(e) => set("middleName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="lastName" required>
              Last Name
            </FieldLabel>
            <Input
              id="lastName"
              value={values.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="trackOrStrand" required>
              Track / Strand
            </FieldLabel>
            <Select
              value={values.trackOrStrand}
              onValueChange={(v) => set("trackOrStrand", v)}
            >
              <SelectTrigger id="trackOrStrand" className="w-full">
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programGroups.map((group) => (
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
            <FieldLabel htmlFor="yearLevel" required>
              Year Level
            </FieldLabel>
            <Select
              value={values.yearLevel}
              onValueChange={(v) => set("yearLevel", v)}
            >
              <SelectTrigger id="yearLevel" className="w-full">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="schoolYear" required>
              School Year
            </FieldLabel>
            <Input
              id="schoolYear"
              placeholder="2025-2026"
              value={values.schoolYear}
              onChange={(e) => set("schoolYear", e.target.value)}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={admit.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || admit.isPending}>
          {admit.isPending ? "Admitting…" : "Admit student"}
        </Button>
      </DialogFooter>
    </form>
  );
}
