import { useFeeEstimate } from './hooks';
import { FEE_CATEGORY_OPTIONS } from './types';
import { formatPeso } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { ReceiptTextIcon } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

export function FeeEstimateDialog({ schoolYear, yearLevel }: { schoolYear: string; yearLevel: string }) {
  const hasSelection = Boolean(schoolYear && yearLevel);
  return <div className="space-y-2">
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={!hasSelection}>
          <ReceiptTextIcon aria-hidden="true" />View estimated fees
        </Button>
      </DialogTrigger>
      <DialogContent className="grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl p-0 [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3] [&>[data-slot=dialog-close]]:right-3 [&>[data-slot=dialog-close]]:top-3 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-9 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center">
        <DialogHeader className="border-b px-5 py-5 pr-14 text-left sm:pl-6">
          <DialogTitle>Estimated fees</DialogTitle>
          <DialogDescription>Review tuition, other charges, and expected payments.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <FeeEstimate schoolYear={schoolYear} yearLevel={yearLevel} />
        </div>
        <DialogFooter className="border-t px-5 py-4 sm:px-6">
          <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {!hasSelection && <p className="text-sm text-muted-foreground">Select your year level to see estimated fees.</p>}
  </div>;
}

export function FeeEstimate({ schoolYear, yearLevel }: { schoolYear: string; yearLevel: string }) {
  const query = useFeeEstimate(schoolYear, yearLevel);
  if (!schoolYear || !yearLevel) return <p className="text-sm text-muted-foreground">Select your year level to see estimated fees.</p>;
  if (query.isError) return <div role="alert" className="space-y-2">
    <p className="font-medium">Unable to load estimated fees</p>
    <p className="text-sm text-muted-foreground">Fees may be under review or admissions may have closed. Try again to check the current schedule.</p>
    <Button type="button" variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Try again</Button>
  </div>;
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading estimated fees…</p>;
  const estimate = query.data;
  return <section aria-label="Estimated fees" className="overflow-hidden">
    <div className="space-y-1 border-b pb-5">
      {query.isFetching && <p role="status" className="text-xs text-muted-foreground">Checking the latest fee schedule…</p>}
      <p className="text-sm text-muted-foreground">SY {estimate.schoolYear} · {yearLevel === 'grade_12' ? 'Grade 12' : 'Grade 11'} · Full academic year</p>
    </div>
    <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
      <div className="space-y-6 py-5 md:pr-6">
        {FEE_CATEGORY_OPTIONS.map(category => {
          const items = estimate.items.filter(item => item.category === category.value);
          if (!items.length) return null;
          return <section key={category.value} aria-label={category.label} className="space-y-2">
            <h3 className="text-sm font-semibold">{category.label}</h3>
            <dl className="space-y-2 text-sm">
              {items.map(item => <div key={item.id} className="flex items-start justify-between gap-4">
                <dt className="min-w-0 text-muted-foreground">{item.name}</dt>
                <dd className="shrink-0 tabular-nums">{formatPeso(item.amount)}</dd>
              </div>)}
            </dl>
          </section>;
        })}
        <dl className="border-t pt-3"><div className="flex items-start justify-between gap-4 font-semibold"><dt>Total annual fees</dt><dd className="shrink-0 tabular-nums">{formatPeso(estimate.total)}</dd></div></dl>
      </div>
      <section aria-label="Expected payments" className="space-y-4 py-5 md:pl-6">
        <h3 className="text-sm font-semibold">Expected payments</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt>Downpayment upon enrollment</dt><dd className="shrink-0 font-semibold tabular-nums">{formatPeso(estimate.downpayment)}</dd></div>
          {estimate.installments.map((amount, index) => <div key={index} className="flex justify-between gap-4"><dt className="text-muted-foreground">Monthly installment {index + 1}</dt><dd className="shrink-0 tabular-nums">{formatPeso(amount)}</dd></div>)}
        </dl>
        {estimate.installments.length === 0 && <p className="text-sm text-muted-foreground">No installments with this estimate.</p>}
        <p className="text-sm leading-relaxed text-muted-foreground">Vouchers, discounts, and incentives require approval and are not deducted here. An approved voucher may waive the downpayment. The cashier will issue your final bill after acceptance, with confirmed benefits and payment due dates.</p>
      </section>
    </div>
    <p className="border-t pt-5 text-sm leading-relaxed text-muted-foreground">For planning only. This estimate does not request payment. Your final amount may change if the school revises its fees or approves benefits.</p>
  </section>;
}
