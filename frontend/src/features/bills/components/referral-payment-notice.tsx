import { Clock3Icon } from 'lucide-react';
import { bannerStyles } from '@/components/ui/banner';
import { cn } from '@/lib/utils';
import { formatBillDate } from '../staff-billing';
import type { Bill } from '../types';

export function ReferralPaymentNotice({ bill }: { bill: Bill }) {
  const guard = bill.referralPaymentGuard;
  if (!guard) return null;
  const applying = guard.reason === 'referral_credit_pending';

  return <div role="status" aria-atomic="true" className={cn(bannerStyles({ tone: 'info' }), 'flex items-start gap-3 px-4 py-3')}>
    <Clock3Icon className="mt-0.5 size-4" aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-semibold">{applying ? 'Applying referral benefit' : guard.cutoff ? 'Referral benefit pending' : 'Referral cutoff pending'}</p>
        {!applying && guard.cutoff && <p className="text-xs leading-relaxed">Enrollment cutoff · <time dateTime={guard.cutoff} className="font-medium">{formatBillDate(guard.cutoff)}</time></p>}
      </div>
      <p className="text-foreground text-sm leading-relaxed">{guard.message}</p>
    </div>
  </div>;
}
