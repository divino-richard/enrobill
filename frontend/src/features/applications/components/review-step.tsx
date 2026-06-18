import type { ApplicationFormApi } from "../hooks/form";
import { ApplicationSummary } from "./application-summary";

interface ReviewStepProps {
  form: ApplicationFormApi;
  enrollmentDate: Date;
}

export function ReviewStep({ form, enrollmentDate }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Please review your details before submitting. You can go back to any
        step to make changes.
      </p>

      <ApplicationSummary
        values={form.state.values}
        enrollmentDate={enrollmentDate}
      />
    </div>
  );
}
