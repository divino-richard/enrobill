import { useMemo, useState } from "react";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  MapPinHouseIcon,
  UserRoundIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel } from "@/components/form/field-label";
import { DatePicker } from "@/components/form/date-picker";
import { FormSection } from "@/features/applications/components/form-section";
import { AddressCombobox } from "@/features/applications/components/address-combobox";
import { useAddress } from "@/features/applications/hooks/address";
import {
  CIVIL_STATUS_OPTIONS,
  TRACK_STRAND_GROUPS,
  YEAR_LEVEL_OPTIONS,
} from "@/features/applications/types";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUpdateStudent } from "../hooks";
import {
  STUDENT_STATUS_OPTIONS,
  studentToFormValues,
  type Student,
  type StudentFormValues,
} from "../types";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

interface StudentEditFormProps {
  student: Student;
}

export function StudentEditForm({ student }: StudentEditFormProps) {
  const initial = useMemo(() => studentToFormValues(student), [student]);
  const [values, setValues] = useState<StudentFormValues>(initial);
  const update = useUpdateStudent(student.id);
  const [saved, setSaved] = useState(false);

  const { provinces, cities, barangays, citiesLoading, barangaysLoading } =
    useAddress({
      provinceCode: values.addressProvince,
      cityCode: values.addressCity,
    });

  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  function set<K extends keyof StudentFormValues>(
    key: K,
    value: StudentFormValues[K],
  ) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    try {
      await update.mutateAsync(values);
      setSaved(true);
    } catch {
      // Surfaced below via update.isError.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <FormSection title="Enrollment" icon={BookOpenIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="status" required>
              Status
            </FieldLabel>
            <Select
              value={values.status}
              onValueChange={(v) => set("status", v as StudentFormValues["status"])}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STUDENT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="schoolYear">School Year</FieldLabel>
            <Input
              id="schoolYear"
              value={values.schoolYear}
              onChange={(e) => set("schoolYear", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="trackOrStrand">Track / Strand</FieldLabel>
            <Select
              value={values.trackOrStrand}
              onValueChange={(v) => set("trackOrStrand", v)}
            >
              <SelectTrigger id="trackOrStrand" className="w-full">
                <SelectValue placeholder="Select track or strand" />
              </SelectTrigger>
              <SelectContent>
                {TRACK_STRAND_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="yearLevel">Year Level</FieldLabel>
            <Select
              value={values.yearLevel}
              onValueChange={(v) => set("yearLevel", v)}
            >
              <SelectTrigger id="yearLevel" className="w-full">
                <SelectValue placeholder="Select year level" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Personal Information" icon={UserRoundIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="lastName" required>
              Family name / Surname
            </FieldLabel>
            <Input
              id="lastName"
              value={values.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="firstName" required>
              Given name
            </FieldLabel>
            <Input
              id="firstName"
              value={values.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="middleName" optional>
              Middle name
            </FieldLabel>
            <Input
              id="middleName"
              value={values.middleName}
              onChange={(e) => set("middleName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="extension" optional>
              Name suffix
            </FieldLabel>
            <Input
              id="extension"
              value={values.extension}
              onChange={(e) => set("extension", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="dateOfBirth">Date of birth</FieldLabel>
            <DatePicker
              id="dateOfBirth"
              value={values.dateOfBirth}
              onChange={(v) => set("dateOfBirth", v)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="gender">Gender</FieldLabel>
            <Select
              value={values.gender}
              onValueChange={(v) => set("gender", v)}
            >
              <SelectTrigger id="gender" className="w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="nationality">Nationality</FieldLabel>
            <Input
              id="nationality"
              value={values.nationality}
              onChange={(e) => set("nationality", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="civilStatus">Civil status</FieldLabel>
            <Select
              value={values.civilStatus}
              onValueChange={(v) => set("civilStatus", v)}
            >
              <SelectTrigger id="civilStatus" className="w-full">
                <SelectValue placeholder="Select civil status" />
              </SelectTrigger>
              <SelectContent>
                {CIVIL_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="placeOfBirth">Place of birth</FieldLabel>
            <Input
              id="placeOfBirth"
              value={values.placeOfBirth}
              onChange={(e) => set("placeOfBirth", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="religion">Religion / Church</FieldLabel>
            <Input
              id="religion"
              value={values.religion}
              onChange={(e) => set("religion", e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Contact & Address" icon={MapPinHouseIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="phoneNumber">Phone number</FieldLabel>
            <Input
              id="phoneNumber"
              value={values.phoneNumber}
              onChange={(e) => set("phoneNumber", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="addressProvince">Province</FieldLabel>
            <AddressCombobox
              id="addressProvince"
              value={values.addressProvince}
              placeholder="Select province"
              emptyText="No province found."
              options={provinces.map((p) => ({
                code: p.province_code,
                label: p.province_name,
              }))}
              onChange={(code) =>
                setValues((prev) => ({
                  ...prev,
                  addressProvince: code,
                  addressCity: "",
                  addressBarangay: "",
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="addressCity">City / Municipality</FieldLabel>
            <AddressCombobox
              id="addressCity"
              value={values.addressCity}
              disabled={!values.addressProvince || citiesLoading}
              placeholder={
                !values.addressProvince
                  ? "Select a province first"
                  : citiesLoading
                    ? "Loading cities…"
                    : "Select city / municipality"
              }
              emptyText="No city / municipality found."
              options={cities.map((c) => ({
                code: c.city_code,
                label: c.city_name,
              }))}
              onChange={(code) =>
                setValues((prev) => ({
                  ...prev,
                  addressCity: code,
                  addressBarangay: "",
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="addressBarangay">Barangay</FieldLabel>
            <AddressCombobox
              id="addressBarangay"
              value={values.addressBarangay}
              disabled={!values.addressCity || barangaysLoading}
              placeholder={
                !values.addressCity
                  ? "Select a city first"
                  : barangaysLoading
                    ? "Loading barangays…"
                    : "Select barangay"
              }
              emptyText="No barangay found."
              options={barangays.map((b) => ({
                code: b.brgy_code,
                label: b.brgy_name,
              }))}
              onChange={(code) => set("addressBarangay", code)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="addressStreet">Street address</FieldLabel>
            <Input
              id="addressStreet"
              value={values.addressStreet}
              onChange={(e) => set("addressStreet", e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {update.isError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3"
        >
          <CircleAlertIcon className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm">{getErrorMessage(update.error)}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t pt-6">
        {saved && !isDirty && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-500" />
            Saved
          </span>
        )}
        <Button type="submit" disabled={!isDirty || update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
