import { isDroppingBill } from '@/features/bills/collection';
import { BillCollectionNotice } from '@/features/dropping-finance/collection-notice';
import { DroppingBillHistory } from '@/features/bills/components/dropping-statement';
import { BillFinanceSummary } from '@/features/dropping-finance/bill-finance';
import { StudentDroppingSummary } from '@/features/bills/components/student-dropping-summary';
import { formatDate } from '@/features/applications/utils';
import { Link, useParams } from "react-router-dom";
import {
  CalendarClockIcon,
  ChevronLeftIcon,
  CreditCardIcon,
  HistoryIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useMyBill, useMyBills } from "@/features/bills/hooks";
import { BillActionPanel } from "@/features/bills/components/bill-action-panel";
import {
  BillStatement,
  EmptyState,
  PaymentsTable,
  ScheduleTable,
  TabCount,
} from "@/features/bills/components/bill-ledger";

function BillDetailPage() {
  const { id } = useParams();
  const billId = Number(id);
  const { data: allBills, isLoading, isError, refetch, isFetching } = useMyBills();
  const { data: currentBill } = useMyBill();

  const backLink = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="text-muted-foreground -ml-2 h-8 w-fit"
    >
      <Link to="/portal/bills">
        <ChevronLeftIcon />
        Back to bills
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-9 w-72 rounded-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const billFromList = (allBills ?? []).find((bill) => bill.id === billId) ?? null;
  const bill =
    currentBill?.id === billId
      ? currentBill
      : billFromList;

  if (!bill) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card>
          <CardContent>
            <EmptyState
              icon={ReceiptTextIcon}
              title={isError ? 'Unable to load your bill' : 'Bill not found'}
              message={isError ? 'Try loading it again.' : "This bill doesn't exist or isn't available on your account."}
            />
            {isError && <div className="flex justify-center pb-5"><Button variant="outline" disabled={isFetching} onClick={() => refetch()}>{isFetching ? 'Loading…' : 'Try again'}</Button></div>}
          </CardContent>
        </Card>
      </div>
    );
  }

  const dropping = isDroppingBill(bill);
  const installments = bill.installments ?? [];
  const payments = bill.payments ?? [];

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-4">
      {backLink}

      <BillActionPanel bill={bill} currentBill={currentBill ?? null} />
      {!dropping && <BillCollectionNotice bill={bill} student />}
      {!dropping && <BillFinanceSummary bill={bill} />}

      <Tabs defaultValue="summary">
        <TabsList aria-label="Bill details" variant="line">
          <TabsTrigger value="summary">
            <ReceiptTextIcon />
            Summary
          </TabsTrigger>
          {!dropping && installments.length > 0 && (
            <TabsTrigger value="schedule">
              <CalendarClockIcon />
              Schedule
              {!dropping && <TabCount n={installments.length} />}
            </TabsTrigger>
          )}
          <TabsTrigger value="payments">
            <CreditCardIcon />
            Payments
            {payments.length > 0 && <TabCount n={payments.length} />}
          </TabsTrigger>
          {dropping && <TabsTrigger value="history"><HistoryIcon />History</TabsTrigger>}
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {dropping ? <StudentDroppingSummary bill={bill} /> : <Card className="overflow-hidden gap-0 pb-0">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-sm">Bill summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <BillStatement bill={bill} />
            </CardContent>
          </Card>}
        </TabsContent>

        {!dropping && installments.length > 0 && (
          <TabsContent value="schedule">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-base">Payment schedule</CardTitle>
                <CardDescription>
                  {`${installments.length} installment${installments.length === 1 ? "" : "s"} for this term.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScheduleTable installments={installments} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {dropping && <TabsContent value="history"><Card className="gap-0 overflow-hidden py-0 shadow-none"><CardHeader className="gap-1 border-b px-4 py-4 sm:px-5"><CardTitle className="text-sm">Financial history</CardTitle>{bill.droppingAssessment && <CardDescription className="text-xs">Dropped {formatDate(bill.droppingAssessment.effectiveDate)}{bill.droppingAssessment.policyVersion != null && ` · Approved policy v${bill.droppingAssessment.policyVersion}`}</CardDescription>}</CardHeader><CardContent className="p-4 sm:p-5"><DroppingBillHistory bill={bill} /></CardContent></Card></TabsContent>}

        <TabsContent value="payments">
          <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <CardHeader className="border-b px-4 py-4 sm:px-5">
              <CardTitle className="text-sm">Payment history</CardTitle>
            </CardHeader>
            <CardContent className={cn(payments.length > 0 && "p-0")}>
              {payments.length === 0 ? (
                <EmptyState
                  icon={CreditCardIcon}
                  title="No payments"
                  message="No payments were recorded for this bill."
                />
              ) : (
                <PaymentsTable payments={payments} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BillDetailPage;
