import { format } from "date-fns";
import type { ApplicationFormApi } from "../hooks/form";
import { useAddress } from "../hooks/address";
import {
  CIVIL_STATUS_OPTIONS,
  ENROLLMENT_TYPE_OPTIONS,
  SEMESTER_OPTIONS,
  TRACK_STRAND_OPTIONS,
  YEAR_LEVEL_OPTIONS,
  labelFor,
} from "../types";
import { APPLICATION_DOCUMENT_TYPES } from "../documents";

function formatBirthDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "PPP");
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : "—";
}

function ReviewSection({
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

interface ReviewStepProps {
  form: ApplicationFormApi;
  enrollmentDate: Date;
}

export function ReviewStep({ form, enrollmentDate }: ReviewStepProps) {
  const values = form.state.values;
  const { getProvinceName, getCityName, getBarangayName } = useAddress({
    provinceCode: values.addressProvince,
    cityCode: values.addressCity,
  });

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Please review your details before submitting. You can go back to any
        step to make changes.
      </p>

      <ReviewSection
        title="Enrollment Information"
        rows={[
          ["Type", labelFor(ENROLLMENT_TYPE_OPTIONS, values.enrollmentType)],
          ["Date of Enrollment", format(enrollmentDate, "PPP 'at' p")],
        ]}
      />

      <div className="border-t" />

      <ReviewSection
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

      <ReviewSection
        title="Complete Address (Permanent)"
        rows={[
          ["Province", getProvinceName(values.addressProvince) || "—"],
          ["City / Municipality", getCityName(values.addressCity) || "—"],
          ["Barangay", getBarangayName(values.addressBrangay) || "—"],
          ["Street address", values.addressStreet || "—"],
        ]}
      />

      <div className="border-t" />

      <ReviewSection
        title="Verification Documents"
        rows={
          values.documents.length > 0
            ? values.documents.map((doc) => [
                labelFor(APPLICATION_DOCUMENT_TYPES, doc.type),
                doc.fileName,
              ])
            : [["Documents", "None uploaded"]]
        }
      />

      <div className="border-t" />

      <ReviewSection
        title="Course & Strand"
        rows={[
          ["Track / Strand", labelFor(TRACK_STRAND_OPTIONS, values.trackOrStrand)],
          ["Year level", labelFor(YEAR_LEVEL_OPTIONS, values.yearLevel)],
          ["Semester", labelFor(SEMESTER_OPTIONS, values.semester)],
          ["School year", values.schoolYear || "—"],
        ]}
      />

      <div className="border-t" />

      <ReviewSection
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
