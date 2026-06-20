import { format } from "date-fns";
import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddress } from "../hooks/address";
import { useProgramLabel } from "@/features/programs/hooks";
import {
  CIVIL_STATUS_OPTIONS,
  ENROLLMENT_TYPE_OPTIONS,
  SEMESTER_OPTIONS,
  YEAR_LEVEL_OPTIONS,
  labelFor,
  type ApplicationFormValues,
} from "../types";
import {
  APPLICATION_DOCUMENT_TYPES,
  type UploadedDocument,
} from "../documents";

function formatBirthDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "PPP");
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : "—";
}

function SummarySection({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface ApplicationSummaryProps {
  values: ApplicationFormValues;
  // When the application was started / submitted; null hides the row.
  enrollmentDate?: Date | null;
  // When provided, each uploaded document becomes viewable (detail page).
  onViewDocument?: (document: UploadedDocument) => void;
}

// Read-only display of a full application. Shared by the review step and the
// applicant's application detail page.
export function ApplicationSummary({
  values,
  enrollmentDate,
  onViewDocument,
}: ApplicationSummaryProps) {
  const programLabel = useProgramLabel();
  const { getProvinceName, getCityName, getBarangayName } = useAddress({
    provinceCode: values.addressProvince,
    cityCode: values.addressCity,
  });

  return (
    <div className="space-y-6">
      <SummarySection
        title="Enrollment Information"
        rows={[
          ["Type", labelFor(ENROLLMENT_TYPE_OPTIONS, values.enrollmentType)],
          [
            "Date of Enrollment",
            enrollmentDate ? format(enrollmentDate, "PPP 'at' p") : "—",
          ],
        ]}
      />

      <div className="border-t" />

      <SummarySection
        title="Personal Information"
        rows={[
          ["Family name / Surname", values.surname || "—"],
          ["Given name", values.givenName || "—"],
          ["Middle name", values.middleName || "N/A"],
          ["Suffix", values.extension || "—"],
          ["Date of birth", formatBirthDate(values.dateOfBirth)],
          ["Age", values.age || "—"],
          ["Gender", capitalize(values.gender)],
          ["Nationality", values.nationality || "—"],
          ["Civil status", labelFor(CIVIL_STATUS_OPTIONS, values.civilStatus)],
          ["Place of birth", values.placeOfBirth || "—"],
          ["Religion / Church", values.religion || "—"],
          ["Health concerns", values.healthConcerns || "—"],
        ]}
      />

      <div className="border-t" />

      <SummarySection
        title="Complete Address (Permanent)"
        rows={[
          ["Province", getProvinceName(values.addressProvince) || "—"],
          ["City / Municipality", getCityName(values.addressCity) || "—"],
          ["Barangay", getBarangayName(values.addressBarangay) || "—"],
          ["Street address", values.addressStreet || "—"],
        ]}
      />

      <div className="border-t" />

      <SummarySection
        title="Contact & Guardian"
        rows={[
          ["Home address", values.homeAddress || "—"],
          ["Mailing address", values.mailingAddress || "—"],
          ["Phone number", values.phoneNumber || "—"],
          ["Email address", values.emailAddress || "—"],
          ["Facebook account", values.facebookAccount || "—"],
          ["Guardian name", values.guardianName || "—"],
          ["Relationship", values.guardianRelation || "—"],
          ["Guardian contact", values.guardianContactNumber || "—"],
          ["Guardian address", values.guardianAddress || "—"],
          ["Guardian occupation", values.guardianOccupation || "—"],
        ]}
      />

      <div className="border-t" />

      <SummarySection
        title="Academic Background"
        rows={[
          ["Previous school", values.prevSchoolName || "—"],
          ["School type", values.prevSchoolType || "—"],
          ["Last grade completed", values.prevSchoolGradeLevel || "—"],
          ["School address", values.prevSchoolAddress || "—"],
          ["Year graduated", values.prevSchoolYearGraduated || "—"],
          ["General average / GPA", values.prevSchoolGpa || "—"],
        ]}
      />

      <div className="border-t" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Verification Documents</h3>
        {values.documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">None uploaded</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {values.documents.map((doc) => (
              <li
                key={doc.key}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">
                    {labelFor(APPLICATION_DOCUMENT_TYPES, doc.type)}
                  </p>
                  <p className="truncate text-sm font-medium">{doc.fileName}</p>
                </div>
                {onViewDocument && doc.id != null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onViewDocument(doc)}
                  >
                    <EyeIcon />
                    View
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t" />

      <SummarySection
        title="Course & Strand"
        rows={[
          ["Track / Strand", programLabel(values.trackOrStrand)],
          ["Year level", labelFor(YEAR_LEVEL_OPTIONS, values.yearLevel)],
          ["Semester", labelFor(SEMESTER_OPTIONS, values.semester)],
          ["School year", values.schoolYear || "—"],
        ]}
      />

      <div className="border-t" />

      <SummarySection
        title="Declaration"
        rows={[
          ["Student name", values.declarationStudentName || "—"],
          ["Guardian name", values.declarationGuardianName || "—"],
          ["Date signed", formatBirthDate(values.dateSigned.slice(0, 10))],
          ["Agreement", values.agreementAccepted ? "Agreed" : "Not agreed"],
        ]}
      />
    </div>
  );
}
