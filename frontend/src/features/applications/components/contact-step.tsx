import { FileUser, PhoneCall } from "lucide-react";
import type { ApplicationFormApi } from "../hooks/form";
import { FormSection } from "./form-section";
import { FieldLabel } from "@/components/form/field-label";
import { Input } from "@/components/ui/input";
import { FieldInfo } from "@/components/form/field-info";
import { compose, noDigits, phMobile, required } from "../validators";

// PH mobile numbers are 11 digits (09XXXXXXXXX). Strip anything the user types or
// pastes that isn't a digit — spaces, dashes, a leading "+" — so the field can
// only ever hold digits, and cap the length. The value stays a string, keeping
// the leading zero that a numeric input would drop.
const MOBILE_DIGITS = 11;

const toDigits = (value: string) =>
  value.replace(/\D/g, "").slice(0, MOBILE_DIGITS);

interface ContactStepProps {
  form: ApplicationFormApi;
}

export function ContactStep({ form }: ContactStepProps) {
  return (
    <div className="space-y-8">
      <FormSection title="Contact Information" icon={PhoneCall}>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <form.Field
            name="phoneNumber"
            validators={{
              onChange: compose(
                required("Phone number is required"),
                phMobile("Enter an 11-digit mobile number starting with 09"),
              ),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Active mobile number for SMS and call notifications. Local format only — 11 digits starting with 09 (e.g. 09171234567), not +63."
                >
                  Phone Number
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(toDigits(e.target.value))}
                  placeholder="09171234567"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={MOBILE_DIGITS}
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
                  hint="Your verified account email — the one you use to sign in. School communications go here."
                >
                  Email Address
                </FieldLabel>
                <Input
                  id={field.name}
                  type="email"
                  value={field.state.value}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                />
                <FieldInfo field={field} />
              </div>
            )}
          </form.Field>
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
        </div>
      </FormSection>

      <FormSection title="Parent / Guardian Information" icon={FileUser}>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field
            name="guardianName"
            validators={{
              onChange: compose(
                required("Guardian name is required"),
                noDigits("Guardian name shouldn't contain numbers"),
              ),
            }}
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
              onChange: compose(
                required("Guardian relationship is required"),
                noDigits("Relationship shouldn't contain numbers"),
              ),
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
              onChange: compose(
                required("Contact number is required"),
                phMobile("Enter an 11-digit mobile number starting with 09"),
              ),
            }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <FieldLabel
                  htmlFor={field.name}
                  required
                  hint="Active mobile number where the guardian can be reached. Local format only — 11 digits starting with 09 (e.g. 09171234567), not +63."
                >
                  Contact Number
                </FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(toDigits(e.target.value))}
                  placeholder="09171234567"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={MOBILE_DIGITS}
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
              onChange: compose(
                required("Occupation is required"),
                noDigits("Occupation shouldn't contain numbers"),
              ),
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
