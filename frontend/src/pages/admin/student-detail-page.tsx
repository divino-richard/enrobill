import { useState, type ComponentType, type ReactNode } from "react";
import { format } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  GraduationCapIcon,
  PencilIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddress } from "@/features/applications/hooks/address";
import {
  CIVIL_STATUS_OPTIONS,
  YEAR_LEVEL_OPTIONS,
  labelFor,
} from "@/features/applications/types";
import { formatDate } from "@/features/applications/utils";
import { BillCard } from "@/features/bills/components/bill-card";
import { useStudentBill } from "@/features/bills/hooks";
import { BILL_STATUS_META } from "@/features/bills/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { StudentEditForm } from "@/features/students/components/student-edit-form";
import { EnrollmentStatusBadge } from "@/features/students/components/enrollment-status-badge";
import { StudentEnrollmentsCard } from "@/features/students/components/student-enrollments-card";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { useStudent, useStudentEnrollments } from "@/features/students/hooks";
import { studentFullName, type Student } from "@/features/students/types";
import { formatPeso } from "@/lib/money";

type StudentDetailTab = "overview" | "enrollments" | "billing";

function formatDob(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "PPP");
}

function capitalize(value: string | null): string {
  return value ? value[0].toUpperCase() + value.slice(1) : "—";
}

function studentDisplayName(student: Student): string {
  const name = studentFullName(student);
  return student.extension ? `${name}, ${student.extension}` : name;
}

function studentInitials(student: Student): string {
  const initials = `${student.firstName?.[0] ?? ""}${student.lastName?.[0] ?? ""}`;
  return initials.toUpperCase() || "?";
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="bg-card flex items-start gap-3 rounded-xl border p-4">
      <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <div className="truncate text-sm font-semibold">{value}</div>
        {hint && (
          <p className="text-muted-foreground truncate text-xs font-normal">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function StudentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const studentId = Number(id ?? 0);
  const [tab, setTab] = useState<StudentDetailTab>("overview");
  const [isEditing, setIsEditing] = useState(false);
  const { data: student, isLoading, isError, refetch } = useStudent(studentId);
  const { data: enrollments, isLoading: enrollmentsLoading } =
    useStudentEnrollments(studentId);
  const { data: bill, isLoading: billLoading } = useStudentBill(studentId);
  const programLabel = useProgramLabel();
  const { getProvinceName, getCityName, getBarangayName } = useAddress({
    provinceCode: student?.addressProvince ?? undefined,
    cityCode: student?.addressCity ?? undefined,
  });

  const backButton = (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground -ml-2"
      onClick={() => navigate("/admin/students")}
    >
      <ArrowLeftIcon />
      Back to Students
    </Button>
  );

  if (isLoading) {
    return (
      <div className="mx-auto space-y-6">
        {backButton}
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-[30rem] w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="mx-auto space-y-6">
        {backButton}
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <p className="text-muted-foreground text-sm">
              We couldn't load this student. Please try again.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentEnrollment = enrollments?.find((record) => record.isCurrent);
  const summary = [
    student.trackOrStrand ? programLabel(student.trackOrStrand) : null,
    student.yearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel) : null,
    student.schoolYear ? `SY ${student.schoolYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const fullAddress =
    [
      student.addressStreet,
      [
        getBarangayName(student.addressBarangay ?? ""),
        getCityName(student.addressCity ?? ""),
        getProvinceName(student.addressProvince ?? ""),
      ]
        .filter(Boolean)
        .join(", "),
    ]
      .filter(Boolean)
      .join(", ") || "—";

  const yearLevelLabel = student.yearLevel
    ? labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel)
    : "—";

  return (
    <div className="mx-auto space-y-6">
      {backButton}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-1 items-start gap-4">
            <Avatar size="lg" className="size-14">
              <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                {studentInitials(student)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1.5">
              <CardDescription className="text-xs font-medium tracking-wide uppercase">
                {student.studentNumber}
              </CardDescription>
              <CardTitle className="text-2xl">
                {studentDisplayName(student)}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <StudentStatusBadge status={student.status} />
                {summary && (
                  <span className="text-muted-foreground text-sm">{summary}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {student.applicationId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/admin/applications/${student.applicationId}`)
                }
              >
                View application
                <ArrowRightIcon />
              </Button>
            )}
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <PencilIcon />
              Edit details
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={GraduationCapIcon}
            label="Current enrollment"
            value={
              enrollmentsLoading ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : currentEnrollment ? (
                <EnrollmentStatusBadge status={currentEnrollment.status} />
              ) : (
                "None"
              )
            }
            hint={
              currentEnrollment
                ? currentEnrollment.schoolYear
                  ? `SY ${currentEnrollment.schoolYear}`
                  : "Open term"
                : "No active enrollment"
            }
          />
          <StatTile
            icon={WalletIcon}
            label="Outstanding balance"
            value={
              billLoading ? (
                <Skeleton className="h-4 w-20 rounded" />
              ) : bill ? (
                formatPeso(bill.balance)
              ) : (
                "Not billed"
              )
            }
            hint={
              bill ? BILL_STATUS_META[bill.status].label : "No bill on file"
            }
          />
          <StatTile
            icon={UserRoundIcon}
            label="Year level"
            value={yearLevelLabel}
            hint={programLabel(student.trackOrStrand)}
          />
          <StatTile
            icon={CalendarDaysIcon}
            label="School year"
            value={student.schoolYear ?? "—"}
            hint={`Updated ${formatDate(student.updatedAt)}`}
          />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as StudentDetailTab)}
        className="space-y-4"
      >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Student overview</CardTitle>
                <CardDescription>
                  The essential student information, without the noise.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <DetailSection title="Academic">
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Student No." value={student.studentNumber} />
                    <DetailItem
                      label="Status"
                      value={<StudentStatusBadge status={student.status} />}
                    />
                    <DetailItem
                      label="Program"
                      value={programLabel(student.trackOrStrand)}
                    />
                    <DetailItem
                      label="Year level"
                      value={yearLevelLabel}
                    />
                    <DetailItem label="School year" value={student.schoolYear ?? "—"} />
                    <DetailItem
                      label="Current enrollment"
                      value={
                        enrollmentsLoading ? (
                          "Loading..."
                        ) : currentEnrollment ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <EnrollmentStatusBadge status={currentEnrollment.status} />
                            <span className="text-muted-foreground text-xs font-normal">
                              {currentEnrollment.schoolYear
                                ? `SY ${currentEnrollment.schoolYear}`
                                : "Open term"}
                            </span>
                          </div>
                        ) : (
                          "No current enrollment"
                        )
                      }
                    />
                  </dl>
                </DetailSection>

                <Separator />

                <DetailSection title="Profile & Contact">
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem
                      label="Date of birth"
                      value={formatDob(student.dateOfBirth)}
                    />
                    <DetailItem label="Gender" value={capitalize(student.gender)} />
                    <DetailItem
                      label="Nationality"
                      value={student.nationality ?? "—"}
                    />
                    <DetailItem
                      label="Civil status"
                      value={labelFor(CIVIL_STATUS_OPTIONS, student.civilStatus ?? "")}
                    />
                    <DetailItem label="Email" value={student.email ?? "—"} />
                    <DetailItem
                      label="Phone number"
                      value={student.phoneNumber ?? "—"}
                    />
                    <div className="sm:col-span-2 lg:col-span-3">
                      <DetailItem label="Address" value={fullAddress} />
                    </div>
                  </dl>
                </DetailSection>

                <Separator />

                <DetailSection title="Record">
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem
                      label="Linked application"
                      value={student.applicationId ? `#${student.applicationId}` : "None"}
                    />
                    <DetailItem label="Created" value={formatDate(student.createdAt)} />
                    <DetailItem
                      label="Last updated"
                      value={formatDate(student.updatedAt)}
                    />
                  </dl>
                </DetailSection>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enrollments">
            <StudentEnrollmentsCard studentId={student.id} />
          </TabsContent>

          <TabsContent value="billing">
            <BillCard studentId={student.id} />
          </TabsContent>
        </Tabs>

      <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle>Edit student details</SheetTitle>
            <SheetDescription>
              {studentDisplayName(student)} · {student.studentNumber}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <StudentEditForm
              student={student}
              onSaved={() => setIsEditing(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default StudentDetailPage;
