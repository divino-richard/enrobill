import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, FileMinusIcon } from 'lucide-react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/features/auth/store';
import { YEAR_LEVEL_OPTIONS, labelFor } from '@/features/applications/types';
import { useProgramLabel } from '@/features/programs/hooks';
import { philippinesToday } from '@/features/dropping-finance/api';
import { AssessmentCalculationDialog, AssessmentSummary } from '@/features/dropping-finance/assessment-summary';
import type { EnrollmentRecord } from '@/features/students/types';
import { getErrorMessage } from '@/lib/get-error-message';
import { createAdminDroppingRequest, fetchAdminDroppingAssessment, type AdminDroppingInput } from './api';

type Props = { studentId: number; studentName: string; enrollment: EnrollmentRecord };

export function AdminDroppingAction(props: Props) {
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { enrollment } = props;

  if (!isAdmin) return null;
  if (enrollment.openDroppingRequestId) return (
    <Button asChild variant="outline" size="sm">
      <Link to={`/admin/dropping-requests/${enrollment.openDroppingRequestId}`}>View dropping request<ArrowRightIcon aria-hidden="true" /></Link>
    </Button>
  );
  if (!enrollment.isCurrent || enrollment.status !== 'enrolled') return null;

  return <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><FileMinusIcon aria-hidden="true" />Drop student</Button></DialogTrigger>
    <DialogContent
      className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-xl"
      showCloseButton={!busy}
      onInteractOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
    >
      <DialogHeader className="shrink-0 border-b p-5 pr-12 text-left">
        <DialogTitle>Drop student</DialogTitle>
        <DialogDescription>Record the reason for dropping. No signed form is required.</DialogDescription>
      </DialogHeader>
      <AdminDroppingForm {...props} onCancel={() => setOpen(false)} onBusyChange={setBusy} />
    </DialogContent>
  </Dialog>;
}

export function AdminDroppingForm({ studentId, studentName, enrollment, onCancel, onBusyChange }: Props & {
  onCancel: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const effectiveDate = philippinesToday();
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState<AdminDroppingInput | null>(null);
  const submitting = useRef(false);
  const dropButton = useRef<HTMLButtonElement>(null);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const programLabel = useProgramLabel();
  const assessmentKey = ['admin-dropping-assessment', studentId, enrollment.id, effectiveDate];
  const preview = useQuery({
    queryKey: assessmentKey,
    queryFn: () => fetchAdminDroppingAssessment(studentId, enrollment.id, effectiveDate),
    enabled: !confirmation,
    retry: false,
  });
  const create = useMutation({
    mutationFn: (input: AdminDroppingInput) => createAdminDroppingRequest(studentId, input),
    onSuccess: request => {
      cache.setQueryData(['dropping', request.id], request);
      void cache.invalidateQueries();
      navigate(`/admin/dropping-requests/${request.id}`);
    },
    onSettled: () => { submitting.current = false; onBusyChange(false); },
  });
  const needsReview = isAxiosError(create.error) && [409, 422].includes(create.error.response?.status ?? 0);
  const ready = !!reason.trim() && preview.isSuccess && !preview.isFetching && preview.data.assessment.ready && !!preview.data.assessment.fingerprint;

  function returnToForm() {
    if (submitting.current) return;
    setConfirmation(null);
    create.reset();
    void cache.invalidateQueries({ queryKey: assessmentKey });
  }

  return <>
    <form className="flex min-h-0 flex-col" onSubmit={event => {
      event.preventDefault();
      if (!ready || confirmation || submitting.current) return;
      create.reset();
      setConfirmation({
        enrollmentId: enrollment.id,
        reason: reason.trim(),
        effectiveDate,
        assessmentFingerprint: preview.data!.assessment.fingerprint!,
        confirmed: true,
      });
    }}>
      <div className="min-h-0 space-y-5 overflow-y-auto p-5">
        <div className="space-y-2 border-b pb-5">
          <p className="text-base leading-snug font-semibold wrap-anywhere">{studentName}</p>
          <p className="flex min-w-0 items-baseline gap-1.5 text-xs leading-5 whitespace-nowrap text-muted-foreground">
            <span className="truncate" title={programLabel(enrollment.program)}>{programLabel(enrollment.program)}</span>
            <span className="shrink-0" aria-hidden="true">·</span>
            <span className="shrink-0">{labelFor(YEAR_LEVEL_OPTIONS, enrollment.yearLevel ?? '')}</span>
            <span className="shrink-0" aria-hidden="true">·</span>
            <span className="shrink-0">SY {enrollment.schoolYear}</span>
          </p>
        </div>
        <fieldset className="min-w-0 space-y-4" disabled={!!confirmation || create.isPending}>
          <div className="space-y-2">
            <Label htmlFor="admin-drop-reason">Reason for dropping <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Textarea id="admin-drop-reason" required maxLength={2000} rows={3} className="field-sizing-fixed min-h-24 max-h-48 resize-y leading-relaxed" value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why the school is initiating this drop." />
          </div>
        </fieldset>
        <section aria-labelledby="admin-drop-charges-title" className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h3 id="admin-drop-charges-title" className="text-sm font-semibold">Charges</h3>
            {preview.isSuccess && !preview.isFetching && preview.data.assessment.ready && <AssessmentCalculationDialog assessment={preview.data.assessment} estimated />}
          </div>
          <dl className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">Effective date</dt>
              <dd className="font-medium"><time dateTime={effectiveDate}>{new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${effectiveDate}T00:00:00+08:00`))}</time></dd>
            </div>
          </dl>
          {preview.isFetching ? <p role="status" className="text-sm text-muted-foreground">Calculating charges…</p>
            : preview.isError ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{getErrorMessage(preview.error)}</p><Button type="button" variant="outline" size="sm" onClick={() => preview.refetch()}>Retry calculation</Button></div>
            : preview.data && <AssessmentSummary assessment={preview.data.assessment} compact={preview.data.assessment.ready} showDetails={false} estimated staff billId={preview.data.billId} canConfigure />}
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-5 py-4">
        <Button type="button" variant="outline" disabled={!!confirmation || create.isPending} onClick={onCancel}>Cancel</Button>
        <Button ref={dropButton} type="submit" disabled={!ready || !!confirmation || create.isPending}>Drop now</Button>
      </footer>
    </form>
    <AlertDialog open={!!confirmation} onOpenChange={next => { if (!next) returnToForm(); }}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl p-5" onCloseAutoFocus={event => { event.preventDefault(); dropButton.current?.focus(); }} onEscapeKeyDown={event => { if (create.isPending) event.preventDefault(); }}>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>Drop student?</AlertDialogTitle>
          <AlertDialogDescription className="wrap-anywhere">This will mark {studentName} as Dropped and notify the student. Any remaining balance is payable upon re-enrollment.</AlertDialogDescription>
        </AlertDialogHeader>
        {create.error && <p role="alert" className="text-sm text-destructive">{getErrorMessage(create.error)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={create.isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={create.isPending || needsReview || !confirmation} onClick={() => {
            if (!confirmation || submitting.current || needsReview) return;
            submitting.current = true;
            onBusyChange(true);
            create.mutate(confirmation);
          }}>{create.isPending ? 'Dropping…' : 'Drop now'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
