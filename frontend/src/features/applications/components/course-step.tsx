import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { BookOpen, FileSignature } from "lucide-react";
import { FormSection } from "./form-section";
import { FieldLabel } from "@/components/form/field-label";
import { FieldInfo } from "@/components/form/field-info";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApplicationFormApi } from "../hooks/form";
import { getSchoolYearOptions } from "../utils";
import { useProgramGroups } from "@/features/programs/hooks";
import {
  DECLARATION_AGREEMENT_TEXT,
  SEMESTER_OPTIONS,
  YEAR_LEVEL_OPTIONS,
} from "../types";

function required(message: string) {
  return ({ value }: { value: string }) =>
    value && value.trim() ? undefined : message;
}

interface CourseStepProps {
  form: ApplicationFormApi;
}

export function CourseStep({ form }: CourseStepProps) {
  const schoolYearOptions = useMemo(() => getSchoolYearOptions(), []);
  const programGroups = useProgramGroups();

  // The name fields are locked, so keep them authoritative: always mirror the
  // values entered on earlier steps. The signing date is stamped once.
  useEffect(() => {
    const values = form.state.values;
    const fullName = [values.givenName, values.middleName, values.surname]
      .filter(Boolean)
      .join(" ");
    form.setFieldValue("declarationStudentName", fullName);
    form.setFieldValue("declarationGuardianName", values.guardianName);
    if (!values.dateSigned) {
      form.setFieldValue("dateSigned", new Date().toISOString());
    }
  }, [form]);

  return (
    <div className="space-y-8">
      <FormSection title="Course & Strand Selection" icon={BookOpen}>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="trackOrStrand"
            validators={{
              onChange: required("Please select a track or strand"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Choose the academic or tech-voc strand you're applying for."
                >
                  Track / Strand
                </FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={field.handleChange}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue placeholder="Select track or strand" />
                  </SelectTrigger>
                  <SelectContent>
                    {programGroups.map((group) => (
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
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="yearLevel"
            validators={{ onChange: required("Year level is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel htmlFor={field.name} required>
                  Year Level
                </FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={field.handleChange}
                >
                  <SelectTrigger id={field.name} className="w-full">
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
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="semester"
            validators={{ onChange: required("Semester is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel htmlFor={field.name} required>
                  Semester
                </FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={field.handleChange}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTER_OPTIONS.map((option) => (
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
            name="schoolYear"
            validators={{ onChange: required("School year is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="The academic year you're enrolling for."
                >
                  School Year
                </FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={field.handleChange}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue placeholder="Select school year" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolYearOptions.map((option) => (
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
        </div>
      </FormSection>

      <FormSection
        title="Declaration"
        icon={FileSignature}
        description="By signing below, you confirm that all the information provided is accurate and truthful. This serves as your electronic signature."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="declarationStudentName"
            validators={{ onChange: required("Student name is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Carried over from your personal details."
                >
                  Student Name
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  disabled
                  readOnly
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="declarationGuardianName"
            validators={{ onChange: required("Guardian name is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Carried over from your guardian details."
                >
                  Guardian Name
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  disabled
                  readOnly
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="dateSigned">
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  hint="Automatically set to the date you sign this declaration."
                >
                  Date Signed
                </FieldLabel>
                <Input
                  id={field.name}
                  value={
                    field.state.value
                      ? format(new Date(field.state.value), "PPP")
                      : ""
                  }
                  disabled
                  readOnly
                />
              </div>
            )}
          </form.Field>
        </div>

        <form.Field
          name="agreementAccepted"
          validators={{
            onChange: ({ value }: { value: boolean }) =>
              value
                ? undefined
                : "You must agree to the declaration to continue",
          }}
        >
          {(field) => (
            <div className="mt-4 space-y-1.5">
              <label
                htmlFor={field.name}
                className="bg-muted/30 flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm"
              >
                <Checkbox
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                  onBlur={field.handleBlur}
                  className="mt-0.5"
                />
                <span className="text-muted-foreground leading-relaxed">
                  {DECLARATION_AGREEMENT_TEXT}
                </span>
              </label>
              <FieldInfo field={field} />
            </div>
          )}
        </form.Field>
      </FormSection>
    </div>
  );
}
