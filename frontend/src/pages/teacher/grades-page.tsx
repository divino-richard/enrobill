import { PageHeader } from "@/components/page-header";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleAlertIcon,
  EyeIcon,
  FileTextIcon,
  GraduationCapIcon,
  Loader2Icon,
  SearchIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentViewerDialog } from "@/components/document-viewer-dialog";
import { FilePreviewDialog, type PendingFile } from "@/components/file-preview-dialog";
import { formatBytes } from "@/lib/format-bytes";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  ACCEPT_ATTR,
  ACCEPTED_MIME,
  MAX_BYTES,
  REVIEW_STATUS_META,
  SEMESTERS,
  type Semester,
  type StudentDocument,
} from "@/features/student-documents/types";
import {
  fetchStudentDocumentBlob,
  fetchStudentDocumentViewUrl,
} from "@/features/student-documents/api";
import { useTeacherGrades, useUploadTeacherGrade } from "@/features/teacher-grades/hooks";
import type { TeacherGradeStudent } from "@/features/teacher-grades/types";
import { getTeacherRosterError, getTeacherRosterState } from "@/features/teacher-grades/roster-state";

function SemesterStatus({
  semester,
  document,
}: {
  semester: Semester;
  document?: StudentDocument;
}) {
  const semesterName = SEMESTERS.find((item) => item.value === semester)?.label ?? semester;

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {semesterName}
      </p>
      {document ? (
        <Badge variant="outline" className={REVIEW_STATUS_META[document.reviewStatus].className}>
          {document.reviewStatus === "accepted" && <CheckCircle2Icon className="size-3" />}
          {REVIEW_STATUS_META[document.reviewStatus].label}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">Not uploaded</Badge>
      )}
    </div>
  );
}

function GradeSlot({
  student,
  schoolYearId,
  semester,
  existing,
  onView,
}: {
  student: TeacherGradeStudent;
  schoolYearId: number;
  semester: Semester;
  existing?: StudentDocument;
  onView: (document: StudentDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadTeacherGrade(student.id, schoolYearId);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const semesterName = SEMESTERS.find((item) => item.value === semester)?.label ?? semester;
  const locked = existing !== undefined && existing.reviewStatus !== "returned";

  function clearPending() {
    setPending((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function pick(file?: File) {
    if (!file) return;
    setLocalError(null);
    upload.reset();
    if (!ACCEPTED_MIME.includes(file.type)) {
      setLocalError("Upload a JPG, PNG or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("File is larger than 10 MB.");
      return;
    }
    setPending((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { file, url: URL.createObjectURL(file) };
    });
  }

  async function confirmUpload() {
    if (!pending) return;
    setProgress(0);
    try {
      await upload.mutateAsync({ semester, file: pending.file, onProgress: setProgress });
      clearPending();
    } catch {
      // Keep the preview open so the teacher can retry.
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileTextIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium">{semesterName}</span>
            {existing ? (
              <Badge variant="outline" className={REVIEW_STATUS_META[existing.reviewStatus].className}>
                {existing.reviewStatus === "accepted" && <CheckCircle2Icon className="size-3" />}
                {REVIEW_STATUS_META[existing.reviewStatus].label}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Not uploaded</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {existing
              ? `${existing.fileName} · ${formatBytes(existing.size ?? 0)}${
                  existing.uploadedAt ? ` · ${format(new Date(existing.uploadedAt), "MMM d, yyyy")}` : ""
                }`
              : "PDF, JPG or PNG · up to 10 MB"}
          </p>
          {existing?.reviewStatus === "returned" && existing.reviewNote && (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              <span className="font-medium">Returned:</span> {existing.reviewNote}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          {upload.isPending && <span className="text-muted-foreground text-xs tabular-nums">{progress}%</span>}
          {existing && !upload.isPending && (
            <Button size="sm" variant="outline" onClick={() => onView(existing)}>
              <EyeIcon /> View
            </Button>
          )}
          {!locked && (
            <Button size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
              {upload.isPending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
              {existing ? "Replace" : "Upload"}
            </Button>
          )}
        </div>
      </div>
      {localError && <p role="alert" className="text-destructive text-xs">{localError}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <FilePreviewDialog
        pending={pending}
        onOpenChange={(open) => {
          if (!open) clearPending();
        }}
        onConfirm={() => void confirmUpload()}
        onChooseAnother={() => inputRef.current?.click()}
        isUploading={upload.isPending}
        progress={progress}
        error={upload.isError ? getErrorMessage(upload.error) : null}
        title={`${existing ? "Replace" : "Upload"} ${semesterName} grades`}
        description={`${student.name} · check that every page is complete and readable.`}
        confirmLabel={existing ? "Replace grade slip" : "Upload grade slip"}
      />
    </div>
  );
}

export default function TeacherGradesPage() {
  const [schoolYearId, setSchoolYearId] = useState<number>();
  const query = useTeacherGrades(schoolYearId);
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [viewing, setViewing] = useState<StudentDocument | null>(null);
  const selectedContext = (() => {
    for (const section of query.data?.sections ?? []) {
      const student = section.students.find((item) => item.id === selectedStudentId);
      if (student) return { student, section };
    }
    return null;
  })();
  const { sections, studentCount, hasStudents, searchTerm, emptyState } = useMemo(
    () => getTeacherRosterState(query.data, search),
    [query.data, search],
  );
  const rosterError = getTeacherRosterError(query.error);
  const statusMessage = query.isLoading
    ? "Loading students…"
    : query.isFetching
      ? "Refreshing students…"
      : query.isError
        ? ""
        : studentCount === 0
          ? `${emptyState.title}. ${emptyState.description}`
          : `${studentCount} ${studentCount === 1 ? "student" : "students"}${searchTerm ? (studentCount === 1 ? " matches your search" : " match your search") : " in your advisory sections"}.`;

  function changeSchoolYear(yearId: number | undefined) {
    setSearch("");
    setSelectedStudentId(null);
    setViewing(null);
    setSchoolYearId(yearId);
  }

  function clearSearch() {
    setSearch("");
    searchInput.current?.focus();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="My students" description="Students in your advisory sections." />
        {query.isSuccess && <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {query.data.schoolYears.length > 1 ? (
            <Select
              value={String(query.data.schoolYearId)}
              onValueChange={value => changeSchoolYear(Number(value))}
            >
              <SelectTrigger className="w-full data-[size=default]:h-11 sm:w-52" aria-label="School year">
                <SelectValue placeholder="School year">
                  SY {query.data.schoolYear}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {query.data.schoolYears.map(year => (
                  <SelectItem key={year.id} value={String(year.id)}>
                    SY {year.schoolYear}{year.isActive ? " · Active" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">SY {query.data.schoolYear}</p>
          )}
          {hasStudents && <div className="relative w-full sm:w-72">
            <SearchIcon aria-hidden="true" className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              ref={searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              aria-label="Search students by name or student number"
              placeholder="Search name or student number…"
              className="h-11 pl-9"
            />
          </div>}
        </div>}
      </div>
      <p role="status" aria-atomic="true" className="sr-only">{statusMessage}</p>

      {query.isLoading ? (
        <div className="space-y-4" aria-hidden="true">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : query.isError ? (
        <TeacherRosterFeedback
          title={rosterError.title}
          description={rosterError.description}
          error
          icon={<CircleAlertIcon aria-hidden="true" className="size-7 text-muted-foreground" />}
          action={<Button
            variant="outline"
            className="min-h-11"
            disabled={query.isFetching}
            onClick={() => {
              if (rosterError.resetYear && schoolYearId !== undefined) changeSchoolYear(undefined);
              else void query.refetch();
            }}
          >{query.isFetching ? "Checking…" : rosterError.action}</Button>}
        />
      ) : sections.length === 0 ? (
        <TeacherRosterFeedback
          title={emptyState.title}
          description={emptyState.description}
          icon={emptyState.kind === "search"
            ? <SearchIcon aria-hidden="true" className="size-7 text-muted-foreground" />
            : <GraduationCapIcon aria-hidden="true" className="size-7 text-muted-foreground" />}
          action={emptyState.kind === "search"
            ? <Button variant="outline" className="min-h-11" onClick={clearSearch}>Clear search</Button>
            : <Button variant="outline" className="min-h-11" disabled={query.isFetching} onClick={() => void query.refetch()}>
                <RefreshCwIcon aria-hidden="true" className={query.isFetching ? "animate-spin motion-reduce:animate-none" : undefined} />
                {query.isFetching ? "Refreshing…" : "Refresh students"}
              </Button>}
        />
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id}>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {section.program.toUpperCase()} · {section.name}
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Grade {section.yearLevel === "grade_11" ? "11" : "12"}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    Adviser · {section.students.length} {section.students.length === 1 ? "student" : "students"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {section.students.map((student) => (
                  <div
                    key={student.id}
                    className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(17rem,auto)_auto] sm:items-center sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{student.name}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">{student.studentNumber}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {SEMESTERS.map((semester) => (
                        <SemesterStatus
                          key={semester.value}
                          semester={semester.value}
                          document={student.documents.find((document) => document.semester === semester.value)}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full justify-between sm:w-auto"
                      onClick={() => setSelectedStudentId(student.id)}
                    >
                      Manage grades
                      <ChevronRightIcon />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={selectedContext !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedStudentId(null);
        }}
      >
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          {selectedContext && (
            <>
              <SheetHeader className="border-b pr-12">
                <SheetTitle className="text-lg">{selectedContext.student.name}</SheetTitle>
                <SheetDescription>
                  {selectedContext.student.studentNumber} · {selectedContext.section.program.toUpperCase()} {selectedContext.section.name}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <div>
                  <h2 className="font-medium">Grade slips</h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Upload or review this student&apos;s semester grade slips.
                  </p>
                </div>
                {SEMESTERS.map((semester) => (
                  <GradeSlot
                    key={semester.value}
                    student={selectedContext.student}
                    schoolYearId={query.data!.schoolYearId}
                    semester={semester.value}
                    existing={selectedContext.student.documents.find(
                      (document) => document.semester === semester.value,
                    )}
                    onView={setViewing}
                  />
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <DocumentViewerDialog
        document={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        queryKey={["teacher-grade-document", viewing?.id, "url"]}
        fetchUrl={fetchStudentDocumentViewUrl}
        fetchBlob={fetchStudentDocumentBlob}
      />
    </div>
  );
}

function TeacherRosterFeedback({
  title, description, icon, action, error = false,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  action: ReactNode;
  error?: boolean;
}) {
  return (
    <Card className="items-center gap-4 px-5 py-8 text-center shadow-none sm:py-10" role={error ? "alert" : undefined}>
      {icon}
      <div className="max-w-md space-y-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action}
    </Card>
  );
}
