import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldLabel } from '@/components/form/field-label';
import { getErrorMessage } from '@/lib/get-error-message';
import { useCreateFee, useUpdateFee } from './hooks';
import { FEE_CATEGORY_OPTIONS, FEE_TYPE_OPTIONS, FEE_YEAR_LEVEL_OPTIONS, type FeeCategory, type FeeInput, type FeeType, type FeeYearLevel, type SchoolYearFee } from './types';

interface FeeFormState {
  yearLevel: FeeYearLevel;
  category: FeeCategory;
  name: string;
  type: FeeType;
  amount: string;
}

const EMPTY_FEE: FeeFormState = {
  yearLevel: "all",
  category: "other",
  name: "",
  type: "default",
  amount: "",
};

export function FeeDialog({
  open,
  schoolYearId,
  editing,
  initialYearLevel,
  onCloseAutoFocus,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  schoolYearId: number | null;
  editing: SchoolYearFee | null;
  initialYearLevel: FeeYearLevel;
  onCloseAutoFocus: () => void;
  onOpenChange: (open: boolean) => void;
  onSaved: (fee: SchoolYearFee) => void;
}) {
  const create = useCreateFee();
  const update = useUpdateFee(editing?.id ?? 0);
  const mutation = editing ? update : create;

  const [form, setForm] = useState<FeeFormState>(
    editing
      ? {
          yearLevel: editing.yearLevel,
          category: editing.category,
          name: editing.name,
          type: editing.type,
          amount: String(editing.amount),
        }
      : { ...EMPTY_FEE, yearLevel: initialYearLevel },
  );

  const [baseline] = useState(form);
  const [discarding, setDiscarding] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const fieldId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({ name: false, amount: false });
  const amount = Number(form.amount);
  const nameError = !form.name.trim() ? "Enter a fee name." : form.name.trim().length > 100 ? "Use 100 characters or fewer." : "";
  const amountError = !form.amount.trim() ? "Enter an amount. Use 0 for a free item."
    : !Number.isFinite(amount) || amount < 0 || amount > 99999999.99 ? "Enter an amount from ₱0 to ₱99,999,999.99."
    : Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 ? "Use no more than two decimal places." : "";
  const showNameError = Boolean(nameError && (submitted || touched.name));
  const showAmountError = Boolean(amountError && (submitted || touched.amount));

  function changeOpen(next: boolean) {
    if (mutation.isPending) return;
    if (!next && dirty) setDiscarding(true);
    else onOpenChange(next);
  }

  async function handleSave() {
    if (mutation.isPending) return;
    setSubmitted(true);
    if (nameError || amountError) {
      (nameError ? nameInput : amountInput).current?.focus();
      return;
    }
    const payload: FeeInput = {
      yearLevel: form.yearLevel,
      category: form.category,
      name: form.name.trim(),
      type: form.type,
      amount: Number(form.amount),
      ...(editing ? {} : { schoolYearId: schoolYearId ?? undefined }),
    };
    try {
      const saved = await mutation.mutateAsync(payload);
      onOpenChange(false);
      onSaved(saved);
    } catch {
      // Surfaced via mutation.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3] [&>[data-slot=dialog-close]]:size-9 [&>[data-slot=dialog-close]]:top-1 [&>[data-slot=dialog-close]]:right-1 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center" showCloseButton={!mutation.isPending} onOpenAutoFocus={event => { event.preventDefault(); nameInput.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); onCloseAutoFocus(); }}>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit fee" : "Add fee"}</DialogTitle>
          <DialogDescription>
            {form.yearLevel === 'all' ? 'This charge applies to both Grade 11 and Grade 12.' : `This charge applies to ${form.yearLevel === 'grade_11' ? 'Grade 11' : 'Grade 12'} only.`} You can change its coverage below.
          </DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={event => { event.preventDefault(); void handleSave(); }}>
          <fieldset disabled={mutation.isPending} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor={`${fieldId}-name`} required>Fee name</FieldLabel>
              <Input
                ref={nameInput}
                id={`${fieldId}-name`}
                required
                maxLength={100}
                aria-invalid={showNameError}
                aria-describedby={showNameError ? `${fieldId}-name-error` : undefined}
                onBlur={() => setTouched(previous => ({ ...previous, name: true }))}
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Library fee"
              />
              {showNameError && <p id={`${fieldId}-name-error`} role="alert" className="text-sm text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor={`${fieldId}-amount`} required>Amount (₱)</FieldLabel>
              <Input
                ref={amountInput}
                id={`${fieldId}-amount`}
                required
                inputMode="decimal"
                max={99999999.99}
                aria-invalid={showAmountError}
                aria-describedby={`${fieldId}-amount-help${showAmountError ? ` ${fieldId}-amount-error` : ''}`}
                onBlur={() => setTouched(previous => ({ ...previous, amount: true }))}
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
              <p id={`${fieldId}-amount-help`} className="text-xs text-muted-foreground">Use 0 for a free item; up to 2 decimals.</p>
              {showAmountError && <p id={`${fieldId}-amount-error`} role="alert" className="text-sm text-destructive">{amountError}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor={`${fieldId}-category`} required>Category</FieldLabel>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, category: v as FeeCategory }))
                }
              >
                <SelectTrigger id={`${fieldId}-category`} aria-required="true" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${fieldId}-level`} required>Applies to</FieldLabel>
              <Select
                value={form.yearLevel}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, yearLevel: v as FeeYearLevel }))
                }
              >
                <SelectTrigger id={`${fieldId}-level`} aria-required="true" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_YEAR_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${fieldId}-type`} required>Type</FieldLabel>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, type: v as FeeType }))
                }
              >
                <SelectTrigger id={`${fieldId}-type`} aria-required="true" aria-describedby={`${fieldId}-type-help`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p id={`${fieldId}-type-help`} className="text-sm text-muted-foreground sm:col-span-2">Standard and additional charges are both included in the total for the selected grade.</p>
          </fieldset>

          {mutation.isError && (
            <p role="alert" className="text-destructive text-sm">
              {getErrorMessage(mutation.error)}
            </p>
          )}

          <DialogFooter className="flex-wrap">
            <Button
              variant="outline"

              type="button"
              onClick={() => changeOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit"  disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : editing ? "Save" : "Add fee"}
            </Button>
          </DialogFooter>
        </form>
        <AlertDialog open={discarding} onOpenChange={setDiscarding}>
          <AlertDialogContent className="w-[calc(100%-2rem)]" onCloseAutoFocus={event => { event.preventDefault(); if (!discarding) nameInput.current?.focus(); }}>
            <AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your changes to this fee have not been saved.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => { setDiscarding(false); nameInput.current?.focus(); }}>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { setDiscarding(false); onOpenChange(false); }}>Discard changes</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
