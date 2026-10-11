import { useId, useState } from "react";
import { addMonths, differenceInMonths, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/form/field-label";
import { DatePicker } from "@/components/form/date-picker";
import { getErrorMessage } from "@/lib/get-error-message";
import { useCreateTerm, useUpdateTermPolicy } from "./hooks";
import { useSchoolYearFreebies, useUpsertFreebie } from "@/features/freebies/hooks";
import type { Freebie } from "@/features/freebies/types";
import type { DownpaymentType, Term } from "./types";

interface PolicyState {
  type: DownpaymentType;
  value: string;
  count: string;
}

const EMPTY_POLICY: PolicyState = {
  type: "fixed",
  value: "",
  count: "",
};

function policyToInput(policy: PolicyState) {
  return {
    downpaymentType: policy.type,
    downpaymentValue: Number(policy.value),
    installmentCount: Number(policy.count),
  };
}

const policyComplete = (policy: PolicyState) =>
  policy.value !== "" && policy.count !== "" &&
  Number.isFinite(Number(policy.value)) && Number(policy.value) >= 0 &&
  Number(policy.value) <= (policy.type === "percentage" ? 100 : 99999999.99) &&
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
}: {
  policy: PolicyState;
  onChange: (patch: Partial<PolicyState>) => void;
  startDate: string | null;
  endDate: string | null;
}) {
  const count = Number(policy.count);
  const fieldId = useId();

  return (
    <div className="space-y-4 sm:col-span-2">
      <details className="text-muted-foreground text-sm">
        <summary className="cursor-pointer">How installments work</summary>
        <p className="mt-2">The balance after the downpayment is split into equal monthly payments. A larger downpayment lowers the monthly amount.</p>
      </details>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`${fieldId}-type`}>Downpayment type</FieldLabel>
          <Select
            value={policy.type}
            onValueChange={(v) => onChange({ type: v as DownpaymentType })}
          >
            <SelectTrigger id={`${fieldId}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed (₱)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor={`${fieldId}-amount`}>
            {policy.type === "percentage" ? "Downpayment %" : "Downpayment ₱"}
          </FieldLabel>
          <Input
            id={`${fieldId}-amount`}
            type="number"
            min={0}
            max={policy.type === "percentage" ? 100 : undefined}
            step="0.01"
            value={policy.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
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

export function InstallmentPolicyForm({ term, onDone }: { term: Term; onDone: () => void }) {
  const save = useUpdateTermPolicy(term.id);
  const [policy, setPolicy] = useState<PolicyState>({
    type: term.downpaymentType ?? "fixed",
    value: term.downpaymentValue != null ? String(term.downpaymentValue) : "",
    count: term.installmentCount != null ? String(term.installmentCount) : "",
  });

  async function handleSave() {
    if (!policyComplete(policy)) return;
    try {
      await save.mutateAsync(policyToInput(policy));
      onDone();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <>
      <fieldset disabled={save.isPending} className="grid gap-4">
        <PolicyFields
          policy={policy}
          onChange={(patch) => setPolicy((prev) => ({ ...prev, ...patch }))}
          startDate={term.startDate}
          endDate={term.endDate}
        />
      </fieldset>
      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {getErrorMessage(save.error)}
        </p>
      )}
      <DialogFooter className="mt-5 border-t pt-4">
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!policyComplete(policy) || save.isPending}
        >
          {save.isPending ? "Saving…" : "Save policy"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EarlyEnrollmentForm({ term, onDone }: { term: Term; onDone: () => void }) {
  const { data: freebies, isLoading, isError, isFetching, refetch } = useSchoolYearFreebies(term.id);
  const existing = (freebies ?? []).find((f) => f.type === "early_enrollment");
  const save = useUpsertFreebie(term.id);

  if (isError) return <div role="alert" className="space-y-3 text-sm"><p>Unable to load early-enrollment settings.</p><Button variant="outline" disabled={isFetching} onClick={() => refetch()}>Try again</Button></div>;
  if (isLoading) {
    return <p className="text-muted-foreground py-6 text-sm">Loading…</p>;
  }

  return (
    <FreebieFields
      key={existing?.id ?? "new"}
      term={term}
      existing={existing ?? null}
      save={save}
      onDone={onDone}
    />
  );
}

function FreebieFields({
  term,
  existing,
  save,
  onDone,
}: {
  term: Term;
  existing: Freebie | null;
  save: ReturnType<typeof useUpsertFreebie>;
  onDone: () => void;
}) {
  const [enabled, setEnabled] = useState(existing?.isActive ?? false);
  const [startsOn, setStartsOn] = useState(
    existing?.startsOn ?? term.startDate?.slice(0, 10) ?? "",
  );
  const [endsOn, setEndsOn] = useState(
    existing?.endsOn ?? term.endDate?.slice(0, 10) ?? "",
  );

  async function handleSave() {
    try {
      await save.mutateAsync({
        type: "early_enrollment",
        name: existing?.name ?? "Early Enrollment Promo",
        isActive: enabled,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
      });
      onDone();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <>
      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            disabled={save.isPending}
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Enable early-enrollment freebie</span>
            <span className="text-muted-foreground block text-xs">
              Offered to Grade 11 students enrolled within the window below.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="freebie-start">Window start</FieldLabel>
            <DatePicker
              id="freebie-start"
              disabled={save.isPending}
              value={startsOn}
              onChange={setStartsOn}
              placeholder="Open-ended"
              startMonth={TERM_DATE_START}
              endMonth={TERM_DATE_END}
              disabledDates={[]}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="freebie-end">Window end</FieldLabel>
            <DatePicker
              id="freebie-end"
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
      </div>

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">{getErrorMessage(save.error)}</p>
      )}

      <DialogFooter className="mt-5 border-t pt-4">
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save freebie"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ReferralIncentiveForm({
  term,
  onDone,
}: {
  term: Term;
  onDone: () => void;
}) {
  const { data: freebies, isLoading, isError, isFetching, refetch } = useSchoolYearFreebies(term.id);
  const existing = (freebies ?? []).find((item) => item.type === "referral");
  const save = useUpsertFreebie(term.id);

  if (isError) {
    return <div role="alert" className="space-y-3 py-4 text-sm">
      <p>We couldn't load the campaign settings. Retry before making changes.</p>
      <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>{isFetching ? "Retrying…" : "Try again"}</Button>
    </div>;
  }

  if (isLoading) {
    return <p className="text-muted-foreground py-6 text-sm">Loading…</p>;
  }

  return (
    <ReferralFreebieFields
      key={existing?.id ?? "new"}
      existing={existing ?? null}
      save={save}
      onDone={onDone}
    />
  );
}

function ReferralFreebieFields({
  existing,
  save,
  onDone,
}: {
  existing: Freebie | null;
  save: ReturnType<typeof useUpsertFreebie>;
  onDone: () => void;
}) {
  const [enabled, setEnabled] = useState(existing?.isActive ?? false);

  async function handleSave() {
    try {
      await save.mutateAsync({
        type: "referral",
        name: existing?.name ?? "Referral Tuition Incentive",
        isActive: enabled,
      });
      onDone();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <>
      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            disabled={save.isPending}
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">
              Enable referral tuition incentive
            </span>
            <span className="text-muted-foreground block text-xs">
              Allow eligible students to create codes and applicants to claim
              referrals during normal admissions. No separate date window.
            </span>
          </span>
        </label>

        <div className="space-y-4 text-sm">
          <h3 className="font-medium">Two students. Two eligibility checks.</h3>
          <dl className="divide-y">
            <div className="pb-3">
              <dt className="font-medium">Grade 11 applicant</dt>
              <dd className="text-muted-foreground mt-1 text-xs leading-relaxed">A new or transferee student qualifies when their application with a valid referral code is accepted.</dd>
            </div>
            <div className="pt-3">
              <dt className="font-medium">Grade 12 referrer</dt>
              <dd className="text-muted-foreground mt-1 text-xs leading-relaxed">Qualifies after one referred Grade 11 student is officially enrolled. Awarded once per school year; extra referrals do not add credit.</dd>
            </div>
          </dl>
          <p className="text-muted-foreground border-s border-border pl-3 text-xs leading-relaxed">Each student needs their own active voucher. The remaining unpaid bill, including miscellaneous fees, is then waived. A missing voucher on one side does not block the other.</p>
          <p className="text-muted-foreground text-xs">Disabling the campaign does not revoke successful referrals or applied benefits.</p>
        </div>
      </div>

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {getErrorMessage(save.error)}
        </p>
      )}

      <DialogFooter className="mt-5 border-t pt-4">
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save incentive"}
        </Button>
      </DialogFooter>
    </>
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
