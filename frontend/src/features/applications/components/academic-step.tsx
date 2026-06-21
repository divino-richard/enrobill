import { GraduationCap } from "lucide-react";
import { FormSection } from "./form-section";
import { DocumentUploadSection } from "./document-upload-section";
import type { ApplicationFormApi } from "../hooks/form";
import { FieldLabel } from "@/components/form/field-label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldInfo } from "@/components/form/field-info";
import { SCHOOL_TYPE_OPTIONS } from "../types";

function required(message: string) {
  return ({ value }: { value: string }) =>
    value && value.trim() ? undefined : message;
}

interface AcademicStepProps {
  form: ApplicationFormApi;
}

export function AcademicStep({ form }: AcademicStepProps) {
  return (
    <div className="space-y-8">
      <FormSection title="Academic Background" icon={GraduationCap}>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="prevSchoolName"
            validators={{
              onChange: required("Previous school name is required"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Complete name of the last school you attended."
                >
                  Previous School
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
            name="prevSchoolGradeLevel"
            validators={{
              onChange: required("Last grade level completedl is required"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="The grade level you completed (e.g. Grade 10 for incoming Grade 11)."
                >
                  Last Grade Level Completed
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
            name="prevSchoolType"
            validators={{ onChange: required("School type is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="The kind of school you last attended."
                >
                  School Type
                </FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={field.handleChange}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue placeholder="Select school type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHOOL_TYPE_OPTIONS.map((option) => (
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
            name="prevSchoolAddress"
            validators={{ onChange: required("School address is required") }}
          >
            {(field) => (
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Complete address of your previous school."
                >
                  School Address
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
            name="prevSchoolYearGraduated"
            validators={{ onChange: required("Year graduated is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="School year you completed or last attended (e.g. 2024–2025)."
                >
                  Year Graduated / Last Attended
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

          <form.Field name="prevSchoolGpa">
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  optional
                  hint="Your general average or GPA from the last school year."
                >
                  General Average / GPA
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
        </div>
      </FormSection>

      <DocumentUploadSection form={form} />
    </div>
  );
}
