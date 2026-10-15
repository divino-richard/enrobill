import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { ReturnEntry } from './return-entry';
import { useStudentReturn } from './api';
import { formatPeso } from '@/lib/money';
import type { Student } from '@/features/students/types';
import { STUDENT_DROPPING_PATH } from '@/features/dropping/paths';

export function PostDropDashboard({student}: {student: Student}) {
  const {data} = useStudentReturn();
  const balance = data?.previousBills.reduce((total, bill) => total + bill.balance, 0);
  return <div className="mx-auto max-w-6xl space-y-4">
    <header className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">Welcome back, {student.firstName}.</h1><p className="text-muted-foreground">Your account and school records remain available.</p></header>
    <ReturnEntry />
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Your student records">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3 sm:px-5"><h2 className="font-semibold">Your student records</h2><p className="text-sm text-muted-foreground">Student no. {student.studentNumber}</p></header>
      <div className="divide-y">
        <Link to="/portal/bills" className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:px-5"><div className="space-y-0.5"><h3 className="font-medium">Bills & payments</h3><p className="text-sm text-muted-foreground">{balance == null ? 'View your financial records.' : `${formatPeso(balance)} previous balance · ${data?.state === 'pending' ? 'Settle before completing re-enrollment' : 'Payable upon re-enrollment'}`}</p></div><ArrowRightIcon className="size-4 shrink-0" aria-hidden="true" /></Link>
        <Link to={STUDENT_DROPPING_PATH} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:px-5"><div className="space-y-0.5"><h3 className="font-medium">Dropping requests</h3><p className="text-sm text-muted-foreground">View your decisions and submitted documents in My Program.</p></div><ArrowRightIcon className="size-4 shrink-0" aria-hidden="true" /></Link>
        <Link to="/portal/programs" className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:px-5"><div className="space-y-0.5"><h3 className="font-medium">Program & enrollment history</h3><p className="text-sm text-muted-foreground">Review your academic record and saved documents.</p></div><ArrowRightIcon className="size-4 shrink-0" aria-hidden="true" /></Link>
      </div>
    </section>
  </div>;
}
