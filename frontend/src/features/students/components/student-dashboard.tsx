import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, GraduationCapIcon, ReceiptTextIcon } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { useAuthStore } from "@/features/auth/store";
import { useAddress } from "@/features/applications/hooks/address";
import {
  CIVIL_STATUS_OPTIONS,
  YEAR_LEVEL_OPTIONS,
  labelFor,
} from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useMyBill } from "@/features/bills/hooks";
import { BILL_STATUS_META } from "@/features/bills/types";
import { semesterLabel } from "@/features/terms/types";
import { useMyStudent } from "../hooks";
import { studentFullName } from "../types";
import { StudentStatusBadge } from "./student-status-badge";

function formatDob(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "PPP");
}

function capitalize(value: string | null): string {
  return value ? value[0].toUpperCase() + value.slice(1) : "—";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof GraduationCapIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:border-primary hover:bg-muted/40 group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors"
    >
      <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium">
          {label}
          <ArrowRightIcon className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </button>
  );
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data: student, isLoading, isError } = useMyStudent();
  const { data: bill } = useMyBill();
  const programLabel = useProgramLabel();
  const { getProvinceName, getCityName, getBarangayName } = useAddress({
    provinceCode: student?.addressProvince ?? undefined,
    cityCode: student?.addressCity ?? undefined,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Your student profile isn't available yet. Please check back shortly.
        </p>
      </div>
    );
  }

  const locality = [
    getBarangayName(student.addressBarangay ?? ""),
    getCityName(student.addressCity ?? ""),
    getProvinceName(student.addressProvince ?? ""),
  ]
    .filter(Boolean)
    .join(", ");
  const fullAddress = [student.addressStreet, locality].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {student.firstName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Here's your enrollment overview.
        </p>
      </div>

      <Card className="border-l-primary border-l-4">
        <CardHeader>
          <CardDescription className="text-xs font-medium tracking-wide uppercase">
            Student
          </CardDescription>
          <CardTitle className="text-lg">{studentFullName(student)}</CardTitle>
          <CardAction>
            <StudentStatusBadge status={student.status} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Detail label="Student No." value={student.studentNumber} />
            <Detail
              label="Program"
              value={programLabel(student.trackOrStrand)}
            />
            <Detail
              label="Year Level"
              value={labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel ?? "")}
            />
            <Detail label="School Year" value={student.schoolYear ?? "—"} />
          </dl>
        </CardContent>
      </Card>

      {bill && (
        <Card>
          <CardHeader>
            <CardDescription className="text-xs font-medium tracking-wide uppercase">
              Current bill · {semesterLabel(bill.semester)} · SY{" "}
              {bill.schoolYear}
            </CardDescription>
            <CardTitle className="text-base">
              {formatPeso(bill.balance)} balance
            </CardTitle>
            <CardAction>
              <Badge
                variant="outline"
                className={cn(BILL_STATUS_META[bill.status].className)}
              >
                {BILL_STATUS_META[bill.status].label}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Detail label="Net total" value={formatPeso(bill.netTotal)} />
              <Detail label="Paid" value={formatPeso(bill.amountPaid)} />
              <Detail label="Balance" value={formatPeso(bill.balance)} />
              <Detail label="Due now" value={formatPeso(bill.amountDue)} />
            </dl>
            <div className="flex justify-end">
              <Button onClick={() => navigate("/portal/bills")}>
                {bill.balance > 0 ? (
                  <>
                    {bill.amountDue > 0
                      ? `Pay ${formatPeso(bill.amountDue)}`
                      : "View bill"}
                    <ArrowRightIcon />
                  </>
                ) : (
                  <>
                    View bills
                    <ReceiptTextIcon />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink
          icon={ReceiptTextIcon}
          label="My bills"
          description="View bills and pay online"
          onClick={() => navigate("/portal/bills")}
        />
        <QuickLink
          icon={GraduationCapIcon}
          label="My program"
          description="Program, level and schedule"
          onClick={() => navigate("/portal/programs")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Detail label="Date of birth" value={formatDob(student.dateOfBirth)} />
            <Detail label="Gender" value={capitalize(student.gender)} />
            <Detail label="Nationality" value={student.nationality ?? "—"} />
            <Detail
              label="Civil status"
              value={labelFor(CIVIL_STATUS_OPTIONS, student.civilStatus ?? "")}
            />
            <Detail label="Email" value={student.email ?? "—"} />
            <Detail label="Phone" value={student.phoneNumber ?? "—"} />
          </dl>
          <div className="border-t" />
          <dl>
            <Detail label="Address" value={fullAddress} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
