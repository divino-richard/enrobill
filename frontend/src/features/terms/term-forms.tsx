import { useId, useState } from "react";
import { addMonths, differenceInMonths, format } from "date-fns";
import { PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/form/field-label";
import { DatePicker } from "@/components/form/date-picker";
import { getErrorMessage } from "@/lib/get-error-message";
import { useCreateTerm, useUpdateTermPolicy } from "./hooks";
import { useUpsertFreebie } from "@/features/freebies/hooks";
import type { Freebie } from "@/features/freebies/types";
import { ReferralPolicyGuide } from "@/features/referrals/components/referral-policy-guide";
import type { Term } from "./types";

interface PolicyState {
  value: string;
  count: string;
}

const EMPTY_POLICY: PolicyState = {
  value: "",
  count: "",
};

function policyToInput(policy: PolicyState) {
  return {
    downpaymentValue: Number(policy.value),
    installmentCount: Number(policy.count),
  };
}

const policyComplete = (policy: PolicyState) =>
  policy.value !== "" && policy.count !== "" &&
  Number.isFinite(Number(policy.value)) && Number(policy.value) >= 0 &&
  Number(policy.value) <= 99999999.99 &&
  Number.isInteger(Number(policy.count)) && Number(policy.count) >= 1 && Number(policy.count) <= 24;

function SchedulePreview({
  startDate,
  endDate,
  count,
}: {
  startDate: string;
  endDate: string;
  count: number;
}) {
  const start = new Date(`${startDate}T00:00:00`);
  const final = addMonths(start, count);
  const overrun = differenceInMonths(final, new Date(`${endDate}T00:00:00`));

  return (
    <p className="text-muted-foreground border-t pt-3 text-xs">
      Downpayment due{" "}
      <span className="font-medium">{format(start, "d MMM yyyy")}</span> · final
      installment{" "}
      <span className="font-medium">{format(final, "d MMM yyyy")}</span>
      {overrun > 0 && (
        <span className="text-amber-600 dark:text-amber-500">
          {" "}
          — {overrun} month{overrun === 1 ? "" : "s"} after the year ends.
        </span>
      )}
    </p>
  );
}

// Shared installment-policy fields used when creating or editing a school year.
function PolicyFields({
  policy,
  onChange,
  startDate,
  endDate,
  showExplanation = true,
}: {
  policy: PolicyState;
  onChange: (patch: Partial<PolicyState>) => void;
  startDate: string | null;
  endDate: string | null;
  showExplanation?: boolean;
}) {
  const count = Number(policy.count);
  const fieldId = useId();

  return (
    <div className="space-y-4 sm:col-span-2">
      {showExplanation && <details className="text-muted-foreground text-sm">
        <summary className="cursor-pointer">How installments work</summary>
        <p className="mt-2">The balance after the downpayment is split into equal monthly payments. A larger downpayment lowers the monthly amount.</p>
      </details>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`${fieldId}-amount`}>Downpayment (₱)</FieldLabel>
          <Input
            id={`${fieldId}-amount`}
            type="number"
            min={0}
            max={99999999.99}
            step="0.01"
            value={policy.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`${fieldId}-count`} hint="Splits the balance after the downpayment into this many equal monthly dues. More installments means a smaller amount per month.">
            Monthly installments
          </FieldLabel>
          <Input
            id={`${fieldId}-count`}
            type="number"
            min={1}
            max={24}
            value={policy.count}
            onChange={(e) => onChange({ count: e.target.value })}
          />
        </div>
      </div>
      {startDate && endDate && Number.isInteger(count) && count >= 1 && count <= 24 && (
        <SchedulePreview
          startDate={startDate}
          endDate={endDate}
          count={count}
        />
      )}
    </div>
  );
}

export function InstallmentPolicyDialog({ term }: { term: Term }) {
  const save = useUpdateTermPolicy(term.id);
  const [open, setOpen] = useState(false);
  const savedPolicy: PolicyState = {
    value: term.downpaymentValue != null ? String(term.downpaymentValue) : "",
    count: term.installmentCount != null ? String(term.installmentCount) : "",
  };
  const [policy, setPolicy] = useState<PolicyState>(savedPolicy);

  function changeOpen(next: boolean) {
    if (save.isPending) return;
    if (next) {
      setPolicy(savedPolicy);
      save.reset();
    }
    setOpen(next);
  }

  async function handleSave() {
    if (!policyComplete(policy) || save.isPending) return;
    try {
      await save.mutateAsync(policyToInput(policy));
      setOpen(false);
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Edit policy</Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto" showCloseButton={!save.isPending}>
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>Edit installment policy</DialogTitle>
          <DialogDescription>SY {term.schoolYear}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
          <fieldset disabled={save.isPending} className="grid gap-4">
            <PolicyFields
              policy={policy}
              onChange={(patch) => setPolicy((prev) => ({ ...prev, ...patch }))}
              startDate={term.startDate}
              endDate={term.endDate}
              showExplanation={false}
            />
          </fieldset>
          {save.isError && (
            <p role="alert" className="text-destructive text-sm">
              {getErrorMessage(save.error)}
            </p>
          )}
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!policyComplete(policy) || save.isPending}>
              {save.isPending ? "Saving…" : "Save policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EarlyEnrollmentDialog({
  term,
  existing,
  onEdit,
  onSaved,
}: {
  term: Term;
  existing?: Freebie;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const save = useUpsertFreebie(term.id);
  const [open, setOpen] = useState(false);
  const fieldId = useId();
  const savedStart = existing ? existing.startsOn ?? "" : term.startDate?.slice(0, 10) ?? "";
  const savedEnd = existing ? existing.endsOn ?? "" : term.endDate?.slice(0, 10) ?? "";
  const [enabled, setEnabled] = useState(existing?.isActive ?? false);
  const [startsOn, setStartsOn] = useState(savedStart);
  const [endsOn, setEndsOn] = useState(savedEnd);
  const hasChanges = !existing || enabled !== existing.isActive || startsOn !== savedStart || endsOn !== savedEnd;

  function changeOpen(next: boolean) {
    if (save.isPending) return;
    if (next) {
      setEnabled(existing?.isActive ?? false);
      setStartsOn(savedStart);
      setEndsOn(savedEnd);
      save.reset();
      onEdit();
    }
    setOpen(next);
  }

  async function handleSave() {
    if (!hasChanges || save.isPending) return;
    try {
      await save.mutateAsync({
        type: "early_enrollment",
        name: existing?.name ?? "Early Enrollment Promo",
        isActive: enabled,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
      });
      setOpen(false);
      onSaved();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          {existing ? <PencilIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
          {existing ? "Edit freebie" : "Set up freebie"}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{existing ? "Edit early-enrollment freebie" : "Set up early-enrollment freebie"}</DialogTitle>
          <DialogDescription>SY {term.schoolYear}</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 size-11" aria-label="Close early-enrollment freebie" disabled={save.isPending}>
            <XIcon aria-hidden="true" />
          </Button>
        </DialogClose>
        <form className="space-y-4" aria-busy={save.isPending} onSubmit={event => { event.preventDefault(); void handleSave(); }}>
          <label htmlFor={fieldId} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <Checkbox
              id={fieldId}
              aria-describedby={`${fieldId}-description`}
              disabled={save.isPending}
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
            />
            Enable early-enrollment freebie
          </label>
          <p id={`${fieldId}-description`} className="text-muted-foreground text-sm leading-relaxed">
            Offered to Grade 11 students enrolled within the window below.
          </p>

          <div className="grid gap-4">
            <div className="space-y-1.5 [&_button[data-slot=popover-trigger]]:min-h-11">
              <FieldLabel htmlFor={`${fieldId}-start`}>Window start</FieldLabel>
              <DatePicker
                id={`${fieldId}-start`}
                disabled={save.isPending}
                value={startsOn}
                onChange={setStartsOn}
                placeholder="Open-ended"
                startMonth={TERM_DATE_START}
                endMonth={TERM_DATE_END}
                disabledDates={[]}
              />
            </div>
            <div className="space-y-1.5 [&_button[data-slot=popover-trigger]]:min-h-11">
              <FieldLabel htmlFor={`${fieldId}-end`}>Window end</FieldLabel>
              <DatePicker
                id={`${fieldId}-end`}
                disabled={save.isPending}
                value={endsOn}
                onChange={setEndsOn}
                placeholder="Open-ended"
                startMonth={TERM_DATE_START}
                endMonth={TERM_DATE_END}
                disabledDates={[]}
              />
            </div>
          </div>

          {save.isError && (
            <p role="alert" className="text-destructive text-sm">{getErrorMessage(save.error)}</p>
          )}

          <DialogFooter className="flex-row flex-wrap justify-end border-t pt-4">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => changeOpen(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={!hasChanges || save.isPending}>
              {save.isPending ? "Saving…" : "Save freebie"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReferralIncentiveDialog({
  term,
  existing,
  onEdit,
  onSaved,
}: {
  term: Term;
  existing?: Freebie;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const save = useUpsertFreebie(term.id);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(existing?.isActive ?? false);
  const hasChanges = !existing || enabled !== existing.isActive;

  function changeOpen(next: boolean) {
    if (save.isPending) return;
    if (next) {
      setEnabled(existing?.isActive ?? false);
      save.reset();
      onEdit();
    }
    setOpen(next);
  }

  async function handleSave() {
    if (!hasChanges || save.isPending) return;
    try {
      await save.mutateAsync({
        type: "referral",
        name: existing?.name ?? "Referral Tuition Incentive",
        isActive: enabled,
      });
      setOpen(false);
      onSaved();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          {existing ? <PencilIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
          {existing ? "Edit incentive" : "Set up incentive"}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{existing ? "Edit referral incentive" : "Set up referral incentive"}</DialogTitle>
          <DialogDescription>SY {term.schoolYear}</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 size-11" aria-label="Close referral incentive" disabled={save.isPending}>
            <XIcon aria-hidden="true" />
          </Button>
        </DialogClose>
        <ReferralIncentiveEditor
          enabled={enabled}
          onEnabledChange={setEnabled}
          hasChanges={hasChanges}
          saving={save.isPending}
          error={save.isError ? getErrorMessage(save.error) : undefined}
          onCancel={() => changeOpen(false)}
          onSave={() => void handleSave()}
        />
      </DialogContent>
    </Dialog>
  );
}

export function ReferralIncentiveEditor({
  enabled,
  onEnabledChange,
  hasChanges,
  saving,
  error,
  onCancel,
  onSave,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  hasChanges: boolean;
  saving: boolean;
  error?: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  const fieldId = useId();

  return (
    <form className="space-y-4" aria-busy={saving} onSubmit={event => {
      event.preventDefault();
      if (hasChanges && !saving) onSave();
    }}>
      <div className="space-y-3">
        <label htmlFor={fieldId} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
          <Checkbox
            id={fieldId}
            disabled={saving}
            checked={enabled}
            onCheckedChange={checked => onEnabledChange(checked === true)}
          />
          Enable referral tuition incentive
        </label>
        <ReferralPolicyGuide disabled={saving} />
      </div>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <DialogFooter className="flex-row flex-wrap justify-end border-t pt-4">
        <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11" disabled={!hasChanges || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// School-year dates can be current/future, so widen the calendar.
const TERM_DATE_START = new Date(new Date().getFullYear() - 2, 0);
const TERM_DATE_END = new Date(new Date().getFullYear() + 6, 11);

function schoolYearFor(startDate: string, endDate: string): string {
  const start = startDate.slice(0, 4);
  const end = endDate.slice(0, 4);
  return start === end ? start : `${start}-${end}`;
}

const MIN_MONTHS = 3;
const MAX_MONTHS = 12;

function endDateBounds(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  return {
    min: addMonths(start, MIN_MONTHS),
    max: addMonths(start, MAX_MONTHS),
  };
}

const toISO = (date: Date) => format(date, "yyyy-MM-dd");

export function NewTermDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [policy, setPolicy] = useState<PolicyState>(EMPTY_POLICY);
  const create = useCreateTerm();

  const bounds = startDate ? endDateBounds(startDate) : null;
  const endValid =
    bounds !== null &&
    endDate >= toISO(bounds.min) &&
    endDate <= toISO(bounds.max);
  const canCreate = endValid && policyComplete(policy);

  // A new start date can strand an end date outside the year it now implies.
  function handleStartChange(value: string) {
    setStartDate(value);
    if (!value || !endDate) return;
    const next = endDateBounds(value);
    if (endDate < toISO(next.min) || endDate > toISO(next.max)) setEndDate("");
  }

  function reset() {
    setStartDate("");
    setEndDate("");
    setPolicy(EMPTY_POLICY);
    create.reset();
  }

  async function handleCreate() {
    if (!canCreate) return;
    try {
      await create.mutateAsync({
        startDate,
        endDate,
        ...policyToInput(policy),
      });
      reset();
      onOpenChange(false);
    } catch {
      // Surfaced below via create.isError.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (create.isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!create.isPending} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New school year</DialogTitle>
          <DialogDescription>
            Set the dates the year runs and its installment policy. Activate it to
            start enrollment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="startDate" required>
              Start date
            </FieldLabel>
            <DatePicker
              id="startDate"
              value={startDate}
              onChange={handleStartChange}
              placeholder="Select start date"
              startMonth={TERM_DATE_START}
              endMonth={TERM_DATE_END}
              disabledDates={[]}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="endDate" required>
              End date
            </FieldLabel>
            <DatePicker
              id="endDate"
              value={endDate}
              onChange={setEndDate}
              placeholder={startDate ? "Select end date" : "Pick a start date"}
              disabled={!startDate}
              // Only the 12 months following the start date are reachable — the
              // month/year dropdowns don't leave the window, and the days on
              // either side of it are disabled.
              startMonth={bounds?.min ?? TERM_DATE_START}
              endMonth={bounds?.max ?? TERM_DATE_END}
              disabledDates={
                bounds
                  ? [{ before: bounds.min }, { after: bounds.max }]
                  : { after: TERM_DATE_START }
              }
            />
          </div>

          <div className="bg-muted/40 rounded-lg border px-3 py-2.5 sm:col-span-2">
            <p className="text-muted-foreground text-xs">School Year</p>
            <p className="font-medium">
              {startDate && endDate ? schoolYearFor(startDate, endDate) : "—"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Taken from the dates above, so it always matches the period.
            </p>
          </div>

          <PolicyFields
            policy={policy}
            onChange={(patch) => setPolicy((prev) => ({ ...prev, ...patch }))}
            startDate={startDate || null}
            endDate={endDate || null}
          />
        </div>

        {create.isError && (
          <p role="alert" className="text-destructive text-sm">
            {getErrorMessage(create.error)}
          </p>
        )}

        <DialogFooter className="mt-5 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canCreate || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add school year"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
