import { FileUser, PhoneCall } from "lucide-react";
import type { ApplicationFormApi } from "../hooks/form";
import { FormSection } from "./form-section";
import { FieldLabel } from "@/components/form/field-label";
import { Input } from "@/components/ui/input";
import { FieldInfo } from "@/components/form/field-info";

function required(message: string) {
  return ({ value }: { value: string }) =>
    value && value.trim() ? undefined : message;
}

interface ContactStepProps {
  form: ApplicationFormApi;
}

export function ContactStep({ form }: ContactStepProps) {
  return (
    <div className="space-y-8">
      <FormSection title="Contact Information" icon={PhoneCall}>
        <form.Field
          name="homeAddress"
          validators={{ onChange: required("Home address is required") }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <FieldLabel
                htmlFor={field.name}
                required
                hint="Your current residential address where you seside dring school term."
              >
                Home Address (current)
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
          name="mailingAddress"
          validators={{ onChange: required("Mailing address is required") }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <FieldLabel
                htmlFor={field.name}
                required
                hint="Address where school correspondence should be sent."
              >
                Mailing Address
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
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="phoneNumber"
            validators={{ onChange: required("Phone number is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Active mobile number for SMS and call notifications."
                >
                  Phone Number
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
            name="emailAddress"
            validators={{ onChange: required("Email address is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Active email address for school communications."
                >
                  Email Address
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
        <form.Field name="facebookAccount">
          {(field) => (
            <div className="space-y-1.5">
              <FieldLabel
                htmlFor={field.name}
                optional
                hint="Facebook name or link for group communications and announcements"
              >
                Facebook Account
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
      </FormSection>

      <FormSection title="Parent / Guardian Information" icon={FileUser}>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="guardianName"
            validators={{ onChange: required("Guardian name is required") }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Complete name of parent or legal guardian."
                >
                  Full Name
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
            name="guardianRelation"
            validators={{
              onChange: required("Guardian relationship is required"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="How is the person related to you? (Mother, Father, Aunt, etc.)"
                >
                  Relationship
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
            name="guardianContactNumber"
            validators={{
              onChange: required("Contac number is required"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Active mobile number where guardian can be reached."
                >
                  Contact Number
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
            name="guardianAddress"
            validators={{
              onChange: required("Address is required"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Only fill if different from student address."
                >
                  Address
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
            name="guardianOccupation"
            validators={{
              onChange: required("Occupation is required"),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Current job or source of income of guardian."
                >
                  Occupation
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
