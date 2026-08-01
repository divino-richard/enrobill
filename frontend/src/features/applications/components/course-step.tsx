import { useEffect } from "react";
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
import { useProgramGroups } from "@/features/programs/hooks";
import { useOpenTerm } from "@/features/terms/hooks";
import {
  allowedYearLevels,
  DECLARATION_AGREEMENT_TEXT,
  YEAR_LEVEL_OPTIONS,
  type YearLevel,
} from "../types";

function required(message: string) {
  return ({ value }: { value: string }) =>
    value && value.trim() ? undefined : message;
}

interface CourseStepProps {
  form: ApplicationFormApi;
}

export function CourseStep({ form }: CourseStepProps) {
  const programGroups = useProgramGroups();
  const { data: openTerm } = useOpenTerm();

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

  // The school year isn't chosen — it's fixed to the open enrollment year.
  useEffect(() => {
    if (openTerm) {
      form.setFieldValue("schoolYear", openTerm.schoolYear);
    }
  }, [form, openTerm]);

  // Student type determines which grade levels are valid (see
  // allowedYearLevels in ../types). When only one is valid, set it
  // automatically instead of making the applicant pick from a single-option
  // list; otherwise clear a value an earlier-step edit made invalid.
  useEffect(() => {
    const { studentType, yearLevel } = form.state.values;
    const allowed = allowedYearLevels(studentType);
    if (allowed.length === 1) {
      if (yearLevel !== allowed[0]) {
        form.setFieldValue("yearLevel", allowed[0]);
      }
    } else if (yearLevel && !allowed.includes(yearLevel as YearLevel)) {
      form.setFieldValue("yearLevel", "");
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

          <form.Subscribe selector={(state) => state.values.studentType}>
            {(studentType) => {
              const allowed = allowedYearLevels(studentType);
              const locked = allowed.length === 1;
              const hint = locked
                ? studentType === "continuing"
                  ? "Continuing students already completed Grade 11, so this is set to Grade 12 automatically."
                  : "New students enter directly into Grade 11, so this is set automatically."
                : undefined;

              return (
                <form.Field
                  name="yearLevel"
                  validators={{ onChange: required("Year level is required") }}
                >
                  {(field) => (
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor={field.name} required hint={hint}>
                        Year Level
                      </FieldLabel>
                      {locked ? (
                        <Input
                          id={field.name}
                          value={
                            YEAR_LEVEL_OPTIONS.find(
                              (option) => option.value === allowed[0],
                            )?.label ?? ""
                          }
                          disabled
                          readOnly
                        />
                      ) : (
                        <Select
                          value={field.state.value}
                          onValueChange={field.handleChange}
                        >
                          <SelectTrigger id={field.name} className="w-full">
                            <SelectValue placeholder="Select year level" />
                          </SelectTrigger>
                          <SelectContent>
                            {YEAR_LEVEL_OPTIONS.filter((option) =>
                              allowed.includes(option.value),
                            ).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FieldInfo field={field} />
                    </div>
                  )}
                </form.Field>
              );
            }}
          </form.Subscribe>

          <form.Field
            name="schoolYear"
            validators={{ onChange: required("School year is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Set automatically by the current open enrollment term."
                >
                  School Year
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
