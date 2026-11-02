import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FeePublication } from '@/features/fees/fee-publication';
import { PageHeader } from "@/components/page-header";
import { Fragment, useMemo, useRef, useState } from "react";
import {
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  CheckIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FeeDialog } from '@/features/fees/fee-dialog';
import { RowActions } from '@/components/row-actions';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableFooter,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAuthStore } from '@/features/auth/store';
import { NewTermDialog } from '@/features/terms/term-forms';
import type { Term } from '@/features/terms/types';
import { useTerms } from "@/features/terms/hooks";
import {
  useDeleteFee,
  useFees,
} from "@/features/fees/hooks";
import {
  FEE_CATEGORY_OPTIONS,
  feeYearLevelLabel,
  type FeeYearLevel,
  type SchoolYearFee,
} from "@/features/fees/types";

function FeesPage() {
  const years = useTerms();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');
  const [creating, setCreating] = useState(false);
  const schoolYears = years.data ?? [];
  const selectedId = params.get('school_year_id');
  const effectiveId = selectedId !== null ? Number(selectedId) : (schoolYears.find(year => year.isActive)?.id ?? schoolYears[0]?.id);
  const selectedYear = schoolYears.find(year => year.id === effectiveId);

  return <div className="mx-auto max-w-5xl space-y-5 [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <PageHeader title="Fees" description="Manage tuition and charges for the academic year." />
      {!years.isPending && !years.isError && schoolYears.length > 0 && <Select value={selectedYear ? String(selectedYear.id) : ''} onValueChange={value => setParams({ school_year_id: value })}>
        <SelectTrigger className="min-w-44 bg-card" aria-label="School year"><SelectValue placeholder="Select year" /></SelectTrigger>
        <SelectContent>{schoolYears.map(year => <SelectItem key={year.id} value={String(year.id)}>SY {year.schoolYear}{year.isActive ? ' · Active' : ''}</SelectItem>)}</SelectContent>
      </Select>}
    </div>
    {years.isPending ? <div role="status" className="space-y-4"><span className="sr-only">Loading academic years…</span><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>
      : years.isError ? <section role="alert" className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Unable to load academic years</h2><p className="text-sm text-muted-foreground">Try again to select a year and review its fees.</p><Button variant="outline" disabled={years.isFetching} onClick={() => void years.refetch()}>Try again</Button></section>
      : schoolYears.length === 0 ? <section className="space-y-3 rounded-xl border border-dashed p-6"><h2 className="font-semibold">No academic years yet</h2><p className="text-sm text-muted-foreground">{isAdmin ? 'Create an academic year to start reviewing its draft fees.' : 'Ask an administrator to create an academic year before setting up fees.'}</p>{isAdmin && <Button onClick={() => setCreating(true)}>Create academic year</Button>}</section>
      : !selectedYear ? <section role="alert" className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Academic year not found</h2><p className="text-sm text-muted-foreground">This link may be out of date. Select an available year above.</p><Button variant="outline" onClick={() => setParams({})}>Use current or latest year</Button></section>
      : <FeeSchedule key={selectedYear.id} term={selectedYear} />}
    {isAdmin && <NewTermDialog open={creating} onOpenChange={setCreating} onCreated={term => navigate(`/admin/fees?school_year_id=${term.id}`)} />}
  </div>;
}

function FeeSchedule({ term }: { term: Term }) {
  const canEdit = !term.feesPublishedAt;
  const effectiveId = term.id;
  const { data, isLoading, isError, isFetching, refetch } = useFees(term.id);
  const fees = data ?? [];
  const [view, setView] = useState<Exclude<FeeYearLevel, 'all'>>('grade_11');
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');
  const annualTotal = (level: string) => fees.filter(fee => fee.yearLevel === 'all' || fee.yearLevel === level).reduce((total, fee) => total + fee.amount, 0);
  const [notice, setNotice] = useState('');
  const addTrigger = useRef<HTMLButtonElement>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const remove = useDeleteFee();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolYearFee | null>(null);
  const [deleting, setDeleting] = useState<SchoolYearFee | null>(null);

  // Keep the official category and sequence order while filtering the editor.
  const groups = useMemo(() => {
    const rows = (data ?? []).filter(fee => fee.yearLevel === 'all' || fee.yearLevel === view);
    return FEE_CATEGORY_OPTIONS.map((cat) => {
      const items = rows
        .filter((f) => f.category === cat.value)
        .sort((a, b) => a.sequence - b.sequence);
      return {
        ...cat,
        items,
        subtotal: items.reduce((total, fee) => total + fee.amount, 0),
      };
    }).filter((group) => group.items.length > 0);
  }, [data, view]);

  function restoreFocus() {
    const target = editTrigger.current;
    if (target?.isConnected) target.focus();
    else addTrigger.current?.focus();
  }

  function openAdd() {
    editTrigger.current = addTrigger.current;
    setEditing(null);
    setNotice('');
    setDialogOpen(true);
  }

  function openEdit(fee: SchoolYearFee) {
    setEditing(fee);
    setNotice('');
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setNotice(`“${deleting.name}” removed from the fee schedule.`);
      setDeleting(null);
    } catch {
      // Keep the dialog and error visible for recovery.
    }
  }

  return (
    <div className="space-y-4">
      <p role="status" aria-atomic="true" className={notice ? 'text-sm text-muted-foreground' : 'sr-only'}>{notice}</p>
      <section aria-label="Fee schedule" className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold">Fee schedule</h2>
            <Badge variant="outline" className={canEdit ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200' : ''}>{canEdit ? 'Draft' : 'Published'}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FeePublication term={term} fees={isLoading || isError ? undefined : data} />
            {canEdit && <Button ref={addTrigger}  onClick={openAdd} disabled={isLoading || isError}><PlusIcon aria-hidden="true" />Add fee</Button>}
          </div>
        </div>
        <Tabs value={view} onValueChange={value => setView(value as Exclude<FeeYearLevel, 'all'>)} className="gap-0">
          <TabsList aria-label="Fee schedule by grade" className="grid h-auto w-full grid-cols-2 gap-0 rounded-none border-y bg-muted/30 p-0">
            {(['grade_11', 'grade_12'] as const).map(level => <TabsTrigger key={level} value={level} className="relative h-auto min-w-0 flex-col items-start gap-1 rounded-none border-0 border-b-2 border-transparent px-4 py-4 text-left whitespace-normal shadow-none transition-colors hover:bg-muted/60 data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-6">
              <span className="flex w-full items-center justify-between gap-2"><span className="font-semibold">{feeYearLevelLabel(level)}</span>{view === level && <CheckIcon className="size-4" aria-hidden="true" />}</span>
              <span className="text-xl font-semibold tabular-nums sm:text-2xl">{isLoading || isError ? '—' : formatPeso(annualTotal(level))}</span>
              <span className="text-xs font-normal text-muted-foreground">per student / year</span>
            </TabsTrigger>)}
          </TabsList>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-2 text-xs text-muted-foreground sm:px-6">
            <p>{formatPeso(term.downpaymentValue)} downpayment · {term.installmentCount} monthly installments</p>
            {isAdmin && <Link to={`/admin/terms/${term.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"><SlidersHorizontalIcon className="size-3.5" aria-hidden="true" />Payment settings</Link>}
          </div>
          <TabsContent value={view} className="m-0">
              {isLoading ? <div role="status" className="space-y-3 p-5"><span className="sr-only">Loading fees…</span><Skeleton className="h-12 w-full" /><Skeleton className="h-72 w-full" /></div>
                : isError ? <div role="alert" className="space-y-3 px-5 py-12 text-center"><p className="text-sm text-muted-foreground">We couldn’t load fees. Please try again.</p><Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>Try again</Button></div>
                : groups.length === 0 ? <div className="space-y-2 px-5 py-12 text-center">
                  <p className="font-medium">{fees.length === 0 ? 'No fees yet' : 'No fees for this grade'}</p>
                  <p className="text-sm text-muted-foreground">{canEdit ? 'Add tuition and other charges to start this schedule.' : 'This published schedule has no charges for this view.'}</p>
                </div> : <Table className="table-fixed" aria-label={`${feeYearLevelLabel(view)} annual fee schedule`}>
                  <TableHeader><TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 sm:px-6">Fee</TableHead>
                    <TableHead className="hidden w-36 sm:table-cell">Applies to</TableHead>
                    <TableHead className="w-28 px-2 text-right sm:w-32">Amount</TableHead>
                    <TableHead className="w-14 px-1 sm:w-16"><span className="sr-only">Actions</span></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{groups.map(group => <Fragment key={group.value}>
                    <TableRow className="border-b-0 bg-muted/40 hover:bg-muted/40">
                      <TableCell className="whitespace-normal px-4 py-2.5 text-xs font-semibold sm:px-6">{group.label}</TableCell>
                      <TableCell className="hidden sm:table-cell" />
                      <TableCell className="px-2 text-right text-xs font-semibold tabular-nums">{formatPeso(group.subtotal)}</TableCell>
                      <TableCell />
                    </TableRow>
                    {group.items.map(fee => <TableRow key={fee.id} className="group">
                      <TableCell className="whitespace-normal px-4 py-1 font-normal sm:px-6">
                        {canEdit ? <button type="button" className="inline-flex min-h-11 items-center rounded-sm text-left hover:text-primary hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Edit ${fee.name}`} onClick={event => { editTrigger.current = event.currentTarget; openEdit(fee); }}><span>{fee.name}<span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">{feeYearLevelLabel(fee.yearLevel)}{fee.type === 'add_on' ? ' · Additional' : ''}</span></span></button>
                          : <span className="block py-2">{fee.name}<span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">{feeYearLevelLabel(fee.yearLevel)}{fee.type === 'add_on' ? ' · Additional' : ''}</span></span>}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{feeYearLevelLabel(fee.yearLevel)}{fee.type === 'add_on' && <span className="block">Additional</span>}</TableCell>
                      <TableCell className="px-2 py-1 text-right tabular-nums">{formatPeso(fee.amount)}</TableCell>
                      <TableCell className="px-1 py-1">{canEdit && <RowActions className="size-9" label={`Actions for ${fee.name}`}>
                        <DropdownMenuItem onSelect={() => { editTrigger.current = addTrigger.current; openEdit(fee); }}><PencilIcon aria-hidden="true" />Edit fee</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => { editTrigger.current = addTrigger.current; remove.reset(); setNotice(''); setDeleting(fee); }}><Trash2Icon aria-hidden="true" />Delete fee</DropdownMenuItem>
                      </RowActions>}</TableCell>
                    </TableRow>)}
                  </Fragment>)}</TableBody>
                  <TableFooter><TableRow className="hover:bg-transparent">
                    <TableCell className="whitespace-normal px-4 py-4 font-semibold sm:px-6">Annual total<span className="mt-1 block text-xs font-normal text-muted-foreground">Before vouchers or discounts</span></TableCell>
                    <TableCell className="hidden sm:table-cell" />
                    <TableCell className="px-2 text-right font-semibold tabular-nums">{formatPeso(annualTotal(view))}</TableCell>
                    <TableCell />
                  </TableRow></TableFooter>
                </Table>}
            </TabsContent>
          </Tabs>
      </section>

      {dialogOpen && (
        <FeeDialog
          open={dialogOpen}
          schoolYearId={effectiveId}
          editing={editing}
          initialYearLevel={view}
          onCloseAutoFocus={restoreFocus}
          onOpenChange={setDialogOpen}
          onSaved={fee => {
            setNotice(`“${fee.name}” saved for ${feeYearLevelLabel(fee.yearLevel)}.`);
            if (fee.yearLevel !== 'all') setView(fee.yearLevel);
          }}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fee?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `“${deleting.name}” will be removed from this school year's schedule. Existing bills already generated are unaffected.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {remove.isError && <p role="alert" className="text-sm text-destructive">{getErrorMessage(remove.error)}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default FeesPage;
