import { Link, useParams } from "react-router-dom";
import {
  CalendarClockIcon,
  ChevronLeftIcon,
  CreditCardIcon,
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
  const { data: allBills, isLoading } = useMyBills();
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
      <div className="space-y-5">
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
      <div className="space-y-5">
        {backLink}
        <Card>
          <CardContent>
            <EmptyState
              icon={ReceiptTextIcon}
              title="Bill not found"
              message="This bill doesn't exist or isn't available on your account."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const installments = bill.installments ?? [];
  const payments = bill.payments ?? [];

  return (
    <div className="space-y-5 mx-auto max-w-7xl">
      {backLink}

      <BillActionPanel bill={bill} currentBill={currentBill ?? null} />

      <Tabs defaultValue="summary">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="summary">
            <ReceiptTextIcon />
            Summary
          </TabsTrigger>
          {installments.length > 0 && (
            <TabsTrigger value="schedule">
              <CalendarClockIcon />
              Schedule
              <TabCount n={installments.length} />
            </TabsTrigger>
          )}
          <TabsTrigger value="payments">
            <CreditCardIcon />
            Payments
            {payments.length > 0 && <TabCount n={payments.length} />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-base">Bill summary</CardTitle>
              <CardDescription>How the balance was computed.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <BillStatement bill={bill} />
            </CardContent>
          </Card>
        </TabsContent>

        {installments.length > 0 && (
          <TabsContent value="schedule">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-base">Payment schedule</CardTitle>
                <CardDescription>
                  {installments.length} installment
                  {installments.length === 1 ? "" : "s"} for this term.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScheduleTable installments={installments} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="payments">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-base">Payments</CardTitle>
              <CardDescription>Payments recorded for this bill.</CardDescription>
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
