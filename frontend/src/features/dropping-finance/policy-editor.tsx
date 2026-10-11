import { useEffect, useRef, useState, type RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDaysIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/form/date-picker';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFees } from '@/features/fees/hooks';
import type { SchoolYearFee } from '@/features/fees/types';
import { getErrorMessage } from '@/lib/get-error-message';
import { formatPeso } from '@/lib/money';
import { formatDate } from '@/features/applications/utils';
import type { Term } from '@/features/terms/types';
import { fetchPolicy, PERIODS, savePolicyPeriod, type DroppingPolicy, type DroppingCategory, type FeeRule, type PeriodKey, type PeriodUpdateInput } from './api';
import { CATEGORIES, expectedPeriodStart, periodDateProblems } from './policy-builder';
import { PolicyFeePicker } from './policy-fee-picker';

export function DroppingPeriods({ term }: { term: Term }) {
  const query = useQuery({ queryKey: ['dropping-policy', term.id], queryFn: () => fetchPolicy(term.id) });
  const fees = useFees(term.id);
  const [editing, setEditing] = useState<{ period: PeriodKey; category?: DroppingCategory } | null>(null);
  const [notice, setNotice] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  if (query.isPending) return <div role="status" className="space-y-3"><span className="sr-only">Loading dropping periods…</span>{PERIODS.map(period => <Skeleton key={period.key} className="h-40 w-full rounded-xl" />)}</div>;
  if (query.isError) return <Card role="alert" className="items-start gap-3 p-4"><p className="text-sm">Unable to load dropping periods.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></Card>;
  const policy = query.data;
  return <div className="space-y-3">
    <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">Set dates once per period, then add fees for each category. Charges apply when all periods are configured.</p>
    {notice && <p role="status" className="sr-only">{notice}</p>}
    <div className="space-y-3">
      {PERIODS.map(period => {
        const range = policy?.periods[period.key];
        const configured = !!range?.startsOn && !!range?.endsOn;
        const expectedStart = expectedPeriodStart(period.key, policy?.periods ?? {});
        return <section key={period.key} aria-labelledby={`${period.key}-heading`}>
          <Card className="gap-0 py-0">
          <header className="border-b px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"><h2 id={`${period.key}-heading`} className="text-sm font-semibold">{period.label}</h2><p className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">{configured ? <><CalendarDaysIcon className="size-3.5 shrink-0" aria-hidden="true" /><span>{formatDate(range.startsOn)} – {formatDate(range.endsOn)}</span></> : 'Dates not configured'}</p></div>
              <Button variant="outline" size="sm" className="shrink-0" aria-label={`${configured ? 'Edit' : 'Set'} dates for ${period.label}`} onClick={event => { trigger.current = event.currentTarget; setEditing({ period: period.key }); }}><CalendarDaysIcon aria-hidden="true" />{configured ? 'Edit dates' : 'Set dates'}</Button>
            </div>
            {configured && expectedStart && expectedStart !== range.startsOn && <p className="mt-3 text-sm text-destructive">Start on {formatDate(expectedStart)} to leave no gap after the previous period.</p>}
          </header>
          <dl className="grid divide-y text-sm lg:grid-cols-2 lg:divide-x lg:divide-y-0">{CATEGORIES.map(category => {
            const rules = policy?.feeRules?.[category.key]?.[period.key];
            const hasPolicy = rules ? rules.length > 0 : configured && Boolean(policy?.id);
            return <div key={category.key} className="min-w-0 px-4 pt-2 pb-4">
              <dt className="flex min-h-9 items-center justify-between gap-3">
                <span className="text-[0.8125rem] font-medium text-muted-foreground">{category.label}</span>
                <Button variant="ghost" size="sm" className="shrink-0 text-primary" aria-label={`${hasPolicy ? 'Edit' : 'Add'} ${category.label} policy for ${period.label}`} onClick={event => { trigger.current = event.currentTarget; setEditing({ period: period.key, category: category.key }); }}>{hasPolicy ? <PencilIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}{hasPolicy ? 'Edit' : 'Add policy'}</Button>
              </dt>
              <dd className="pt-1.5">
                {rules?.length ? <ul className="space-y-3">{rules.map(rule => {
                  const fee = fees.data?.find(entry => entry.id === rule.feeId);
                  const amount = fee && Number.isFinite(fee.amount) ? Math.round(Math.round(fee.amount * 100) * rule.percent / 100) / 100 : null;
                  return <li key={rule.feeId} className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><p className="break-words">{rule.name ?? fee?.name ?? 'Selected fee'}</p><p className="mt-0.5 text-xs text-muted-foreground">{rule.percent}% charge</p></div>
                    <span className="shrink-0 text-right font-medium tabular-nums">{amount !== null ? formatPeso(amount) : <span className="text-xs font-normal text-muted-foreground">{fees.isPending ? 'Loading amount…' : 'Amount unavailable'}</span>}</span>
                  </li>;
                })}</ul> : hasPolicy ? <p className="leading-relaxed">{period[category.key === 'paying' ? 'paying' : 'voucher']}<span className="mt-1 block text-xs text-muted-foreground">Based on the original bill</span></p> : <p className="text-muted-foreground">No policy added</p>}
              </dd>
            </div>;
          })}</dl>
          </Card>
        </section>;
      })}
    </div>
    {policy?.feeRules && <p className="text-xs leading-relaxed text-muted-foreground">Amounts shown use the current fee schedule. Student charges use their original bill.</p>}
    {fees.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><p className="text-muted-foreground">Unable to load fee amounts.</p><Button variant="link" size="sm" onClick={() => void fees.refetch()}>Try again</Button></div>}
    {editing && <PeriodDialog key={`${editing.period}-${editing.category ?? 'dates'}`} term={term} period={editing.period} category={editing.category} policy={policy} onClose={() => setEditing(null)} onSaved={() => { setNotice(`${PERIODS.find(p => p.key === editing.period)!.label} ${editing.category ? 'policy' : 'dates'} saved.`); setEditing(null); }} onRestoreFocus={() => trigger.current?.focus()} />}
  </div>;
}

function PeriodDialog({ term, period, category, policy, onClose, onSaved, onRestoreFocus }: { term: Term; period: PeriodKey; category?: DroppingCategory; policy: DroppingPolicy | null; onClose: () => void; onSaved: () => void; onRestoreFocus: () => void }) {
  const fees = useFees(term.id);
  const dialog = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const label = PERIODS.find(p => p.key === period)!.label;
  const categoryLabel = CATEGORIES.find(entry => entry.key === category)?.label;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent ref={dialog} className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 rounded-xl p-0" showCloseButton={!busy} onEscapeKeyDown={event => { if (dialog.current?.querySelector('[data-slot="combobox-trigger"][aria-expanded="true"]')) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); onRestoreFocus(); }}>
      <DialogHeader className="shrink-0 px-6 pt-6 pb-5 text-left"><DialogTitle className="text-lg">{label}{!category && ' dates'}</DialogTitle><DialogDescription>{category ? `${categoryLabel} policy` : 'One date range for Paying and With voucher.'}</DialogDescription></DialogHeader>
      {!category ? <PeriodDatesForm term={term} period={period} initial={policy} onClose={onClose} onSaved={onSaved} onBusy={setBusy} /> : fees.isPending ? <div role="status" className="space-y-4 p-6"><span className="sr-only">Loading fees…</span><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div> : fees.isError ? <div className="space-y-3 p-6"><p role="alert" className="text-sm text-destructive">{getErrorMessage(fees.error)}</p><Button variant="outline" onClick={() => void fees.refetch()}>Try again</Button></div> : <CategoryPolicyForm dialog={dialog} term={term} period={period} category={category} initial={policy} fees={fees.data} onClose={onClose} onSaved={onSaved} onBusy={setBusy} />}
    </DialogContent>
  </Dialog>;
}

type PeriodFormProps = { term: Term; period: PeriodKey; initial: DroppingPolicy | null; onClose: () => void; onSaved: () => void; onBusy: (busy: boolean) => void };

function useSavePeriod(termId: number, period: PeriodKey, onSaved: () => void, onBusy: (busy: boolean) => void) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: (input: PeriodUpdateInput) => savePolicyPeriod(termId, period, input), onMutate: () => onBusy(true), onSuccess: async () => {
    await Promise.all([cache.invalidateQueries({ queryKey: ['dropping-policy', termId] }), cache.invalidateQueries({ queryKey: ['dropping-assessment'] })]);
    onSaved();
  }, onSettled: () => onBusy(false) });
}

function PeriodDatesForm({ term, period, initial, onClose, onSaved, onBusy }: PeriodFormProps) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.querySelector<HTMLButtonElement>('#period-start')?.focus(); }, []);
  const [range, setRange] = useState(initial?.periods[period] ?? { startsOn: '', endsOn: '' });
  const [problems, setProblems] = useState<string[]>([]);
  const startMonth = new Date(`${Number(term.startDate?.slice(0, 4) ?? new Date().getFullYear()) - 1}-01-01T00:00:00`);
  const endMonth = new Date(`${Number(term.endDate?.slice(0, 4) ?? new Date().getFullYear()) + 1}-12-31T00:00:00`);
  const save = useSavePeriod(term.id, period, onSaved, onBusy);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const errors = periodDateProblems(period, { ...initial?.periods, [period]: range }, term);
    setProblems(errors);
    if (!errors.length) save.mutate(range);
  }
  return <form ref={form} onSubmit={submit} className="flex min-h-0 flex-col">
    <fieldset disabled={save.isPending} className="min-h-0 space-y-5 overflow-y-auto border-0 px-6 pb-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="period-start">Start date</Label><DatePicker id="period-start" value={range.startsOn} placeholder="Select start date" startMonth={startMonth} endMonth={endMonth} disabledDates={[]} disabled={save.isPending} onChange={startsOn => setRange(previous => ({ ...previous, startsOn }))} /></div>
        <div className="space-y-2"><Label htmlFor="period-end">End date</Label><DatePicker id="period-end" value={range.endsOn} placeholder="Select end date" startMonth={startMonth} endMonth={endMonth} disabledDates={range.startsOn ? { before: new Date(`${range.startsOn}T00:00:00`) } : []} disabled={save.isPending} onChange={endsOn => setRange(previous => ({ ...previous, endsOn }))} /></div>
      </div>
      {(problems.length > 0 || save.isError) && <div role="alert" className="space-y-1 text-sm text-destructive">{problems.map(problem => <p key={problem}>{problem}</p>)}{save.isError && <p>{getErrorMessage(save.error)}</p>}</div>}
    </fieldset>
    <DialogFooter className="shrink-0 flex-row justify-end border-t px-6 py-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save dates'}</Button></DialogFooter>
  </form>;
}

function CategoryPolicyForm({ dialog, term, period, category, initial, fees, onClose, onSaved, onBusy }: PeriodFormProps & { dialog: RefObject<HTMLDivElement | null>; category: DroppingCategory; fees: SchoolYearFee[] }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.querySelector<HTMLButtonElement>('#period-fees')?.focus(); }, []);
  const [selections, setSelections] = useState<FeeRule[]>(initial?.feeRules?.[category]?.[period] ?? []);
  const [problems, setProblems] = useState<string[]>([]);
  const save = useSavePeriod(term.id, period, onSaved, onBusy);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const errors: string[] = [];
    if (!selections.length) errors.push(`Select at least one fee for ${CATEGORIES.find(c => c.key === category)!.label}.`);
    else if (selections.some(rule => !fees.some(fee => fee.id === rule.feeId))) errors.push('Remove fees that are no longer available.');
    else if (selections.some(rule => !Number.isInteger(rule.percent) || rule.percent < 1 || rule.percent > 100)) errors.push('Use whole percentages from 1 to 100.');
    setProblems(errors);
    if (!errors.length) save.mutate({ feeRules: { [category]: selections.map(({ feeId, percent }) => ({ feeId, percent })) } });
  }
  return <form ref={form} onSubmit={submit} className="flex min-h-0 flex-col">
    <fieldset disabled={save.isPending} className="min-h-0 space-y-5 overflow-y-auto border-0 px-6 pb-6">
      <PolicyFeePicker portalContainer={dialog} category={category} selected={selections} fees={fees} disabled={save.isPending} onChange={setSelections} />
      {(problems.length > 0 || save.isError) && <div role="alert" className="space-y-1 text-sm text-destructive">{problems.map(problem => <p key={problem}>{problem}</p>)}{save.isError && <p>{getErrorMessage(save.error)}</p>}</div>}
    </fieldset>
    <DialogFooter className="shrink-0 flex-row justify-end border-t px-6 py-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending || !fees.length}>{save.isPending ? 'Saving…' : 'Save policy'}</Button></DialogFooter>
  </form>;
}
