import { format } from "date-fns";
import { ClipboardListIcon, MapPinHouse, UserRoundIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/form/date-picker";
import { FieldInfo } from "@/components/form/field-info";
import { FieldLabel } from "@/components/form/field-label";
import { FormSection } from "./form-section";
import { calculateAge } from "@/features/applications/utils";
import type { ApplicationFormApi } from "../hooks/form";
import { CIVIL_STATUS_OPTIONS, type Gender } from "../types";
import { useStore } from "@tanstack/react-store";
import { AddressCombobox } from "./address-combobox";
import { useAddress } from "../hooks/address";
import { compose, noDigits, required } from "../validators";

const NO_SUFFIX = "__none__";

interface PersonalStepProps {
  form: ApplicationFormApi;
  enrollmentDate: Date;
}

export function PersonalStep({ form, enrollmentDate }: PersonalStepProps) {
  // Cascading address options — recompute as the parent selections change.
  const provinceCode = useStore(form.store, (s) => s.values.addressProvince);
  const cityCode = useStore(form.store, (s) => s.values.addressCity);
  const {
    provinces,
    cities,
    barangays,
    provincesLoading,
    citiesLoading,
    barangaysLoading,
  } = useAddress({
    provinceCode,
    cityCode,
  });

  return (
    <div className="space-y-8">
      <FormSection title="Enrollment Information" icon={ClipboardListIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel
              htmlFor="enrollment-date"
              hint="Automatically set to when you started this application."
            >
              Date/Time of Enrollment
            </FieldLabel>
            <Input
              id="enrollment-date"
              value={format(enrollmentDate, "PPP 'at' p")}
              readOnly
              disabled
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Personal Information" icon={UserRoundIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="surname"
            validators={{
              onChange: compose(
                required("Family name is required"),
                noDigits("Family name shouldn't contain numbers"),
              ),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Enter your family name exactly as written on your PSA birth certificate."
                >
                  Family name / Surname
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="givenName"
            validators={{
              onChange: compose(
                required("Given name is required"),
                noDigits("Given name shouldn't contain numbers"),
              ),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Enter your given (first) name exactly as on your PSA birth certificate."
                >
                  Given name
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="middleName"
            validators={{
              onChange: noDigits("Middle name shouldn't contain numbers"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  optional
                  hint="Usually your mother's maiden surname. Leave blank if you have none."
                >
                  Middle name
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="extension">
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  optional
                  hint="A suffix such as Jr., Sr., II, or III — only if it appears on your birth certificate."
                >
                  Name suffix
                </FieldLabel>
                <Select
                  value={field.state.value}
                  // Radix forbids an empty-string item value, so a sentinel "None"
                  // maps back to "" — this is how the suffix gets cleared once set.
                  onValueChange={(v) =>
                    field.handleChange(v === NO_SUFFIX ? "" : v)
                  }
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue placeholder="Select suffix" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value={NO_SUFFIX}
                      className="text-muted-foreground"
                    >
                      None
                    </SelectItem>
                    {["Jr.", "Sr.", "II", "III", "IV", "V"].map((suffix) => (
                      <SelectItem key={suffix} value={suffix}>
                        {suffix}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field
            name="dateOfBirth"
            validators={{ onChange: required("Date of birth is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Use the date shown on your PSA birth certificate."
                >
                  Date of Birth
                </FieldLabel>
                <DatePicker
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  placeholder="Select date of birth"
                  onChange={(value) => {
                    field.handleChange(value);
                    const age = calculateAge(value, enrollmentDate);
                    form.setFieldValue("age", age != null ? String(age) : "");
                  }}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="age">
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  hint="Automatically calculated from your date of birth as of the enrollment date."
                >
                  Age
                </FieldLabel>
                <Input
                  id={field.name}
                  type="number"
                  value={field.state.value}
                  readOnly
                  disabled
                  placeholder="—"
                />
              </div>
            )}
          </form.Field>

          <form.Field
            name="gender"
            validators={{ onChange: required("Please select a gender") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel required>Gender</FieldLabel>
                <RadioGroup
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as Gender)}
                  className="flex gap-6 pt-1"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="male" id="gender-male" />
                    <Label htmlFor="gender-male" className="font-normal">
                      Male
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="female" id="gender-female" />
                    <Label htmlFor="gender-female" className="font-normal">
                      Female
                    </Label>
                  </div>
                </RadioGroup>
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="nationality"
            validators={{ onChange: required("Nationality is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Your citizenship. Choose Dual Citizen if you hold two citizenships."
                >
                  Nationality / Citizenship
                </FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue placeholder="Select nationality/citizenship" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Filipino", "Dual Citizen", "Foreign National"].map(
                      (suffix) => (
                        <SelectItem key={suffix} value={suffix}>
                          {suffix}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="civilStatus"
            validators={{ onChange: required("Please select a civil status") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel htmlFor={field.name} required>
                  Civil status
                </FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue placeholder="Select your current civil status" />
                  </SelectTrigger>
                  <SelectContent>
                    {CIVIL_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="placeOfBirth"
            validators={{ onChange: required("Place of birth is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="City/Municipality and Province where were born."
                >
                  Place of Birth
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="religion"
            validators={{
              onChange: noDigits("Religion shouldn't contain numbers"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  optional
                  hint="Your religious affiliation"
                >
                  Religion / Church
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="healthConcerns">
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  optional
                  hint="List any allergies or medical conditions for school health records."
                >
                  Health Concerns
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>
        </div>
      </FormSection>

      <FormSection title="Complete Address (Permanent)" icon={MapPinHouse}>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="addressProvince"
            validators={{ onChange: required("Province is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="The province of your permanent address."
                >
                  Province
                </FieldLabel>
                <AddressCombobox
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  disabled={provincesLoading}
                  placeholder={
                    provincesLoading ? "Loading provinces…" : "Select province"
                  }
                  emptyText="No province found."
                  options={provinces.map((p) => ({
                    code: p.province_code,
                    label: p.province_name,
                  }))}
                  onChange={(code) => {
                    field.handleChange(code);
                    // Reset the dependent selections.
                    form.setFieldValue("addressCity", "");
                    form.setFieldValue("addressBarangay", "");
                  }}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="addressCity"
            validators={{
              onChange: required("City / Municipality is required"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel htmlFor={field.name} required>
                  City / Municipality
                </FieldLabel>
                <AddressCombobox
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  disabled={!provinceCode || citiesLoading}
                  placeholder={
                    !provinceCode
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
                  onChange={(code) => {
                    field.handleChange(code);
                    form.setFieldValue("addressBarangay", "");
                  }}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="addressBarangay"
            validators={{ onChange: required("Barangay is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel htmlFor={field.name} required>
                  Barangay
                </FieldLabel>
                <AddressCombobox
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  disabled={!cityCode || barangaysLoading}
                  placeholder={
                    !cityCode
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
                  onChange={(code) => field.handleChange(code)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="addressStreet"
            validators={{ onChange: required("Street address is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="House/unit number, street, and subdivision."
                >
                  Street address
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>
        </div>
      </FormSection>
    </div>
  );
}
