import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowUpRightIcon, CalendarDaysIcon, CircleAlertIcon, PencilIcon, PlusIcon, UsersRoundIcon } from 'lucide-react';
import { EmptyState, type EmptyStateContent } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteTerm, useTerms, useUpdateTermStatus } from '@/features/terms/hooks';
import { EarlyEnrollmentForm, InstallmentPolicyForm, ReferralIncentiveForm } from '@/features/terms/term-forms';
import { termLabel, type Term } from '@/features/terms/types';
import { useSchoolYearFreebies } from '@/features/freebies/hooks';
import { DroppingPeriods } from '@/features/dropping-finance/policy-editor';
import { formatDate } from '@/features/applications/utils';
import { formatPeso } from '@/lib/money';
import { getErrorMessage } from '@/lib/get-error-message';

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'payments', label: 'Payment plan' },
  { id: 'dropping', label: 'Dropping charges' },
  { id: 'incentives', label: 'Incentives' },
];
const backLink = <Link to="/admin/terms" className="inline-flex min-h-8 items-center gap-2 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ArrowLeftIcon className="size-4" aria-hidden="true" />Academic years</Link>;
const surface = 'space-y-4 pb-6 [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3]';

type StatusAction = { term: Term; kind: 'active' | 'admission' | 'progression'; next: boolean | null };

export default function TermDetailPage() {
  const { id } = useParams();
  const query = useTerms();
  if (query.isPending) return <div className={surface}>{backLink}<div role="status" className="space-y-5"><span className="sr-only">Loading academic year…</span><Skeleton className="h-12 w-64" /><Skeleton className="h-11 w-full" /><Skeleton className="h-80 w-full rounded-xl" /></div></div>;
  if (query.isError) return <div className={surface}>{backLink}<Card role="alert" className="items-start gap-3 p-4"><h1 className="text-lg font-semibold">Unable to load this academic year</h1><p className="text-sm text-muted-foreground">{getErrorMessage(query.error)}</p><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button></Card></div>;
  const term = query.data.find(item => item.id === Number(id));
  if (!term) return <div className={surface}>{backLink}<Card className="gap-2 p-4"><h1 className="text-lg font-semibold">Academic year not found</h1><p className="text-sm text-muted-foreground">It may have been removed. Choose another year from the list.</p></Card></div>;
  return <AcademicYearDetail key={term.id} term={term} activeTerm={query.data.find(item => item.isActive)} />;
}

function AcademicYearDetail({ term, activeTerm }: { term: Term; activeTerm?: Term }) {
  const [params, setParams] = useSearchParams();
  const section = sections.some(item => item.id === params.get('section')) ? params.get('section')! : 'overview';
  const navigate = useNavigate();
  const update = useUpdateTermStatus();
  const remove = useDeleteTerm();
  const [action, setAction] = useState<StatusAction | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const actionTrigger = useRef<HTMLButtonElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const ask = (kind: StatusAction['kind'], next: boolean | null) => { update.reset(); setNotice(''); setAction({ term, kind, next }); setActionOpen(true); };
  async function confirmStatus() {
    if (!action || update.isPending) return;
    const changes = action.kind === 'active' ? { isActive: action.next === true } : action.kind === 'admission' ? { admissionOpen: action.next === true } : { progressionOpen: action.next };
    try {
      await update.mutateAsync({ id: term.id, ...changes });
      setNotice('Academic year settings updated.');
      setActionOpen(false);
    } catch { /* Keep the confirmation open with its recoverable error. */ }
  }
  async function confirmDelete() {
    if (remove.isPending) return;
    try { await remove.mutateAsync(term.id); navigate('/admin/terms', { replace: true }); } catch { /* The server explains why deletion is blocked. */ }
  }

  return <div className={surface}>
    <div className="space-y-2">
      {backLink}
      <PageHeader title={termLabel(term)} context={<StateBadge active={term.isActive} yes="Active year" no="Inactive" />} description={term.startDate && term.endDate ? `${formatDate(term.startDate)} – ${formatDate(term.endDate)}` : 'School-year dates are not set'} />
    </div>
    <Tabs value={section} onValueChange={value => setParams(previous => { const next = new URLSearchParams(previous); next.set('section', value); return next; })} className="gap-4">
      <div className="overflow-x-auto border-b"><TabsList aria-label="Academic year sections" className="h-10 min-w-max justify-start gap-2 rounded-none bg-transparent p-0">{sections.map(item => <TabsTrigger key={item.id} value={item.id} className="h-10 flex-none rounded-none border-0 border-b-2 border-transparent px-4 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">{item.label}</TabsTrigger>)}</TabsList></div>
      <TabsContent value="overview" forceMount className="space-y-3 data-[state=inactive]:hidden">
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        <div className="space-y-3">
          <SettingRow title="School year" description={term.isActive ? 'The current year used by billing, the student portal, and dashboards.' : 'Activate this year to use it across enrollment and billing.'} badge={<StateBadge active={term.isActive} yes="Active" no="Inactive" />}>
            <Button size="sm" variant="outline" disabled={update.isPending} onClick={event => { actionTrigger.current = event.currentTarget; ask('active', !term.isActive); }}>{term.isActive ? 'Deactivate year' : 'Set as active'}</Button>
          </SettingRow>
          <SettingRow title="Admissions" description={term.isActive ? 'Control whether applicants can submit new applications.' : 'Activate this school year before opening admissions.'} badge={<StateBadge active={term.admissionOpen} yes="Open" no="Closed" />}>
            <Button size="sm" variant="outline" disabled={!term.isActive || update.isPending} onClick={event => { actionTrigger.current = event.currentTarget; ask('admission', !term.admissionOpen); }}>{term.admissionOpen ? 'Close admissions' : 'Open admissions'}</Button>
          </SettingRow>
          <SettingRow title="Year-end progression" description={!term.isActive ? 'Activate this year to manage promotion, retention, and graduation.' : term.progressionOverride === null ? `Follows the year-end schedule${term.endDate ? ` · ${formatDate(term.endDate)}` : ''}.` : 'A manual override is in effect.'} badge={<StateBadge active={term.progressionOpen} yes="Open" no="Closed" />}>
            <div className="flex flex-wrap items-center gap-2">
              {term.isActive && term.progressionOverride !== null && <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={update.isPending} onClick={event => { actionTrigger.current = event.currentTarget; ask('progression', null); }}>Follow schedule</Button>}
              <Button size="sm" variant="outline" disabled={!term.isActive || update.isPending} onClick={event => { actionTrigger.current = event.currentTarget; ask('progression', !term.progressionOpen); }}>{term.progressionOpen ? 'Disable progression' : 'Enable progression'}</Button>
            </div>
          </SettingRow>
        </div>
        <Card className="gap-0 py-0"><details className="group"><summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">Delete academic year</summary><div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3"><p className="max-w-prose text-[0.8125rem] leading-relaxed text-muted-foreground">Permanently remove this year. Years with enrollments or bills cannot be deleted.</p><Button ref={deleteTrigger} variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { remove.reset(); setDeleting(true); }}>Delete year</Button></div></details></Card>
      </TabsContent>
      <TabsContent value="payments" forceMount className="data-[state=inactive]:hidden">
        <EditableSection title="Installment policy" description="Downpayment and monthly payments for this academic year." editLabel="Edit payment plan" editor={onDone => <InstallmentPolicyForm term={term} onDone={onDone} />}>
          <dl className="grid divide-y border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0"><div className="space-y-1.5 px-4 py-3"><dt className="text-[0.8125rem] font-medium text-muted-foreground">Downpayment</dt><dd className="text-lg font-semibold tabular-nums">{term.downpaymentType === 'percentage' ? `${term.downpaymentValue}% of the bill` : formatPeso(term.downpaymentValue)}</dd></div><div className="space-y-1.5 px-4 py-3"><dt className="text-[0.8125rem] font-medium text-muted-foreground">Remaining balance</dt><dd className="text-lg font-semibold tabular-nums">{term.installmentCount} monthly installments</dd></div></dl>
        </EditableSection>
      </TabsContent>
      <TabsContent value="dropping" forceMount className="data-[state=inactive]:hidden"><DroppingPeriods term={term} /></TabsContent>
      <TabsContent value="incentives" forceMount className="data-[state=inactive]:hidden"><IncentivesSection term={term} /></TabsContent>
    </Tabs>
    <AlertDialog open={actionOpen} onOpenChange={open => { if (!update.isPending) setActionOpen(open); }}><AlertDialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); actionTrigger.current?.focus(); }}><AlertDialogHeader><AlertDialogTitle>{action && statusActionTitle(action)}</AlertDialogTitle><AlertDialogDescription>{action && statusActionBody(action)}{action?.kind === 'active' && action.next && activeTerm && activeTerm.id !== term.id && <span className="mt-3 block text-destructive">{termLabel(activeTerm)} is currently active and will be deactivated.</span>}</AlertDialogDescription></AlertDialogHeader>{update.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(update.error)}</p>}<AlertDialogFooter><AlertDialogCancel disabled={update.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={update.isPending} onClick={event => { event.preventDefault(); void confirmStatus(); }}>{update.isPending ? 'Saving…' : action ? statusActionConfirm(action) : 'Confirm'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={deleting} onOpenChange={open => { if (!remove.isPending) setDeleting(open); }}><AlertDialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); deleteTrigger.current?.focus(); }}><AlertDialogHeader><AlertDialogTitle>Delete {termLabel(term)}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the academic year. Years with enrollments or bills cannot be deleted.{term.isActive && <span className="mt-3 block text-destructive">This is currently the active school year.</span>}</AlertDialogDescription></AlertDialogHeader>{remove.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(remove.error)}</p>}<AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" disabled={remove.isPending} onClick={event => { event.preventDefault(); void confirmDelete(); }}>{remove.isPending ? 'Deleting…' : 'Delete year'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function StateBadge({ active, yes, no }: { active: boolean; yes: string; no: string }) {
  return <Badge variant="secondary" className={active ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-muted text-muted-foreground'}>{active ? yes : no}</Badge>;
}
function SettingRow({ title, description, badge, children }: { title: string; description: string; badge: ReactNode; children: ReactNode }) {
  return <section aria-label={title}><Card className="gap-0 py-0"><header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"><div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{title}</h2>{badge}</div>{children}</header><p className="max-w-prose px-4 py-3 text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</p></Card></section>;
}
function EditableSection({ title, description, badge, editLabel, editor, children, emptyState, secondaryAction }: { title: string; description: string; badge?: ReactNode; editLabel: string; editor: (onDone: () => void) => ReactNode; children?: ReactNode; emptyState?: EmptyStateContent; secondaryAction?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const editorRoot = useRef<HTMLDivElement>(null);
  const [restoreFocus, setRestoreFocus] = useState(false);
  useEffect(() => {
    if (editing) editorRoot.current?.querySelector<HTMLElement>('button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)')?.focus();
    else if (restoreFocus) trigger.current?.focus();
  }, [editing, restoreFocus]);
  const close = () => { setRestoreFocus(true); setEditing(false); };
  return <section aria-label={title}><Card className="gap-0 py-0">
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"><div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{title}</h2>{badge}</div>{!editing && !emptyState && <Button ref={trigger} variant="outline" size="sm" onClick={() => setEditing(true)}><PencilIcon aria-hidden="true" />{editLabel}</Button>}</header>
    {(!emptyState || editing) && <p className="max-w-prose px-4 py-3 text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</p>}
    {editing ? <div ref={editorRoot} className="border-t p-4">{editor(close)}</div> : emptyState ? <div className="p-4"><EmptyState {...emptyState} layout="inline" action={<><Button ref={trigger} variant="outline" size="sm" onClick={() => setEditing(true)}><PlusIcon aria-hidden="true" />{editLabel}</Button>{secondaryAction}</>} /></div> : children}
  </Card></section>;
}
function LoadingSettings() {
  return <Card role="status" className="gap-0 py-0"><span className="sr-only">Loading settings…</span><div className="border-b px-4 py-3"><Skeleton className="h-6 w-48" /></div><div className="p-4"><Skeleton className="h-16 w-full" /></div></Card>;
}
function SettingsError({ retry, busy }: { retry: () => void; busy: boolean }) {
  return <Card role="alert" className="flex-row flex-wrap items-center gap-3 p-4"><CircleAlertIcon className="size-4 text-muted-foreground" aria-hidden="true" /><p className="flex-1 text-sm">Unable to load these settings.</p><Button variant="outline" size="sm" disabled={busy} onClick={retry}>Try again</Button></Card>;
}
function IncentivesSection({ term }: { term: Term }) {
  const query = useSchoolYearFreebies(term.id);
  if (query.isPending) return <LoadingSettings />;
  if (query.isError) return <SettingsError busy={query.isFetching} retry={() => void query.refetch()} />;
  const early = query.data.find(item => item.type === 'early_enrollment');
  const referral = query.data.find(item => item.type === 'referral');
  const referralsLink = <Button asChild variant="ghost" size="sm" className="text-primary"><Link to="/admin/referrals">View referrals<ArrowUpRightIcon className="size-3.5" aria-hidden="true" /></Link></Button>;
  return <div className="space-y-3">
    <EditableSection title="Early-enrollment freebie" description="A voucher-based benefit for Grade 11 students enrolled within the offer window." badge={<StateBadge active={!!early?.isActive} yes="Enabled" no={early ? 'Disabled' : 'Not configured'} />} editLabel={early ? 'Edit freebie' : 'Set up freebie'} editor={onDone => <EarlyEnrollmentForm term={term} onDone={onDone} />}
      emptyState={!early ? { icon: CalendarDaysIcon, title: 'No enrollment window yet', description: 'Set the dates for eligible Grade 11 students to receive this freebie.' } : undefined}>
      {early && <dl className="grid divide-y border-t text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0"><div className="space-y-1.5 px-4 py-3"><dt className="text-[0.8125rem] font-medium text-muted-foreground">Window starts</dt><dd className="font-medium">{early.startsOn ? formatDate(early.startsOn) : 'No start date'}</dd></div><div className="space-y-1.5 px-4 py-3"><dt className="text-[0.8125rem] font-medium text-muted-foreground">Window ends</dt><dd className="font-medium">{early.endsOn ? formatDate(early.endsOn) : 'No end date'}</dd></div></dl>}
    </EditableSection>
    <EditableSection title="Referral tuition incentive" description="A referral benefit for eligible Grade 11 applicants and Grade 12 referrers." badge={<StateBadge active={!!referral?.isActive} yes="Enabled" no={referral ? 'Disabled' : 'Not configured'} />} editLabel={referral ? 'Edit incentive' : 'Set up incentive'} editor={onDone => <ReferralIncentiveForm term={term} onDone={onDone} />}
      emptyState={!referral ? { icon: UsersRoundIcon, title: 'No referral incentive yet', description: 'Set up the tuition benefit. Each student must qualify with their own voucher.' } : undefined} secondaryAction={referralsLink}>
      {referral && <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3"><dl className="space-y-1.5 text-sm"><dt className="text-[0.8125rem] font-medium text-muted-foreground">Voucher eligibility</dt><dd className="font-medium">Each student qualifies with their own voucher.</dd></dl>{referralsLink}</div>}
    </EditableSection>
  </div>;
}
function statusActionTitle(action: StatusAction): string {
  if (action.kind === "active") {
    return action.next
      ? "Set this school year as active?"
      : "Deactivate this school year?";
  }
  if (action.kind === "progression") {
    if (action.next === null) {
      return "Follow the end-date schedule for progression?";
    }
    return action.next
      ? "Enable progression for this school year?"
      : "Disable progression for this school year?";
  }
  return action.next
    ? "Open admissions for this school year?"
    : "Close admissions for this school year?";
}

function statusActionBody(action: StatusAction): string {
  const label = termLabel(action.term);
  if (action.kind === "active") {
    return action.next
      ? `${label} will become the active school year. Bills, the student portal and dashboards will operate on it.`
      : `${label} will be deactivated. Bills, the portal and dashboards will have no active school year, and its admissions and progression will close, until you activate another.`;
  }
  if (action.kind === "progression") {
    if (action.next === null) {
      return `Progression for ${label} will follow its end date — opening automatically once the year has ended, with no manual override.`;
    }
    return action.next
      ? `Year-end promotion, retention and graduation actions for ${label} become available on the Progression page now, regardless of its end date.`
      : `Year-end progression actions for ${label} will be unavailable on the Progression page, even if its end date has passed. Decisions already made are unaffected.`;
  }
  return action.next
    ? `Applicants will be able to submit applications for ${label}.`
    : `New applications for ${label} will be blocked. Existing bills and the student portal are unaffected.`;
}

function statusActionConfirm(action: StatusAction): string {
  if (action.kind === "active") {
    return action.next ? "Set as active" : "Deactivate";
  }
  if (action.kind === "progression") {
    if (action.next === null) {
      return "Follow schedule";
    }
    return action.next ? "Enable progression" : "Disable progression";
  }
  return action.next ? "Open admissions" : "Close admissions";
}
