import { format } from "date-fns";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/store";
import { useAddress } from "@/features/applications/hooks/address";
import {
  CIVIL_STATUS_OPTIONS,
  labelFor,
} from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useYearLevelLabel } from "@/features/year-levels/hooks";
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

export function StudentDashboard() {
  const user = useAuthStore((state) => state.user);
  const { data: student, isLoading, isError } = useMyStudent();
  const programLabel = useProgramLabel();
  const yearLevelLabel = useYearLevelLabel();
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
              value={yearLevelLabel(student.yearLevel)}
            />
            <Detail label="School Year" value={student.schoolYear ?? "—"} />
          </dl>
        </CardContent>
      </Card>

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
