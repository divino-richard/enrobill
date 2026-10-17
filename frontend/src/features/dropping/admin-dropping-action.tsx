import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, FileMinusIcon } from 'lucide-react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/form/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/features/auth/store';
import { YEAR_LEVEL_OPTIONS, labelFor } from '@/features/applications/types';
import { useProgramLabel } from '@/features/programs/hooks';
import { philippinesToday, type DroppingAssessment } from '@/features/dropping-finance/api';
import { AssessmentSummary } from '@/features/dropping-finance/assessment-summary';
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
    <DialogTrigger asChild><Button variant="outline" size="sm"><FileMinusIcon aria-hidden="true" />Start dropping</Button></DialogTrigger>
    <DialogContent
      className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-xl"
      showCloseButton={!busy}
      onInteractOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
    >
      <DialogHeader className="shrink-0 border-b p-5 pr-12 text-left">
        <DialogTitle>Drop student</DialogTitle>
        <DialogDescription>Record the reason and effective date. No signed form is required.</DialogDescription>
      </DialogHeader>
      <AdminDroppingForm {...props} onCancel={() => setOpen(false)} onBusyChange={setBusy} />
    </DialogContent>
  </Dialog>;
}

export function AdminDroppingForm({ studentId, studentName, enrollment, onCancel, onBusyChange }: Props & {
  onCancel: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const today = philippinesToday();
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [confirmation, setConfirmation] = useState<{ input: AdminDroppingInput; assessment: DroppingAssessment } | null>(null);
  const submitting = useRef(false);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const programLabel = useProgramLabel();
  const assessmentKey = ['admin-dropping-assessment', studentId, enrollment.id, effectiveDate];
  const preview = useQuery({
    queryKey: assessmentKey,
    queryFn: () => fetchAdminDroppingAssessment(studentId, enrollment.id, effectiveDate),
    enabled: !!effectiveDate && !confirmation,
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
  const ready = !!reason.trim() && !!effectiveDate && preview.isSuccess && !preview.isFetching && preview.data.assessment.ready && !!preview.data.assessment.fingerprint;
  const enrolledDate = enrollment.enrolledAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(enrollment.enrolledAt)) : undefined;

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
        input: { enrollmentId: enrollment.id, reason: reason.trim(), effectiveDate, assessmentFingerprint: preview.data!.assessment.fingerprint!, confirmed: true },
        assessment: preview.data!.assessment,
      });
    }}>
      <div className="min-h-0 space-y-4 overflow-y-auto p-5">
        <div className="space-y-1">
          <p className="break-words text-sm font-medium">{studentName}</p>
          <p className="text-xs text-muted-foreground">{programLabel(enrollment.program)} · {labelFor(YEAR_LEVEL_OPTIONS, enrollment.yearLevel ?? '')} · SY {enrollment.schoolYear}</p>
        </div>
        <fieldset className="min-w-0 space-y-4" disabled={!!confirmation || create.isPending}>
          <div className="space-y-2">
            <Label htmlFor="admin-drop-reason">Reason for dropping <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Textarea id="admin-drop-reason" required maxLength={2000} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain why the school is initiating this drop." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-drop-date">Effective date <span className="text-destructive" aria-hidden="true">*</span></Label>
            <DatePicker id="admin-drop-date" aria-describedby="admin-drop-date-help" value={effectiveDate} onChange={setEffectiveDate}
              startMonth={enrolledDate ? new Date(`${enrolledDate}T00:00:00`) : undefined} endMonth={new Date(`${today}T00:00:00`)}
              disabledDates={[{ after: new Date(`${today}T00:00:00`) }, ...(enrolledDate ? [{ before: new Date(`${enrolledDate}T00:00:00`) }] : [])]} />
            <p id="admin-drop-date-help" className="text-xs text-muted-foreground">Determines the dropping charge.</p>
          </div>
        </fieldset>
        <section aria-label="Dropping assessment" className="border-t pt-4">
          {!effectiveDate ? <p className="text-sm text-muted-foreground">Choose an effective date to calculate charges.</p>
            : preview.isFetching ? <p role="status" className="text-sm text-muted-foreground">Calculating charges…</p>
            : preview.isError ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{getErrorMessage(preview.error)}</p><Button type="button" variant="outline" size="sm" onClick={() => preview.refetch()}>Retry calculation</Button></div>
            : preview.data && <AssessmentSummary assessment={preview.data.assessment} compact={preview.data.assessment.ready} estimated staff billId={preview.data.billId} canConfigure />}
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-5 py-4">
        <Button type="button" variant="outline" disabled={!!confirmation || create.isPending} onClick={onCancel}>Cancel</Button>
        <Button ref={reviewButton} type="submit" disabled={!ready || !!confirmation || create.isPending}>Review drop<ArrowRightIcon aria-hidden="true" /></Button>
      </footer>
    </form>
    <AlertDialog open={!!confirmation} onOpenChange={next => { if (!next) returnToForm(); }}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl p-5" onCloseAutoFocus={event => { event.preventDefault(); reviewButton.current?.focus(); }} onEscapeKeyDown={event => { if (create.isPending) event.preventDefault(); }}>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>Confirm dropping?</AlertDialogTitle>
          <AlertDialogDescription>This approves the drop immediately and changes the student’s enrollment to Dropped.</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmation && <div className="space-y-4">
          <div className="space-y-1 text-sm">
            <p className="break-words font-semibold">{studentName}</p>
            <p className="text-muted-foreground">SY {enrollment.schoolYear} · Effective {new Date(`${confirmation.input.effectiveDate}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div className="space-y-1 text-sm"><p className="text-muted-foreground">Reason for dropping</p><p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words">{confirmation.input.reason}</p></div>
          <AssessmentSummary assessment={confirmation.assessment} compact estimated />
          <p className="text-xs leading-relaxed text-muted-foreground">Any remaining balance is payable upon re-enrollment. The student will be notified.</p>
        </div>}
        {create.error && <p role="alert" className="text-sm text-destructive">{getErrorMessage(create.error)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={create.isPending}>Back to review</AlertDialogCancel>
          <Button variant="destructive" disabled={create.isPending || needsReview || !confirmation} onClick={() => {
            if (!confirmation || submitting.current || needsReview) return;
            submitting.current = true;
            onBusyChange(true);
            create.mutate(confirmation.input);
          }}>{create.isPending ? 'Approving drop…' : 'Confirm drop'}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
