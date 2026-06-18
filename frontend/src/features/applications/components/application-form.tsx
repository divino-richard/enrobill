import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronLeft,
  ChevronRight,
  CircleAlertIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormStepper } from "./form-stepper";
import { AcademicStep } from "./academic-step";
import { ContactStep } from "./contact-step";
import { CourseStep } from "./course-step";
import { PersonalStep } from "./personal-step";
import { ReviewStep } from "./review-step";
import {
  REVIEW_STEP,
  STEP_EXTRA_VALIDATED_FIELDS,
  STEP_FIELDS,
  WIZARD_STEPS,
} from "../constants";
import { isStepComplete, stepFilledCount } from "../utils";
import { useApplicationForm } from "../hooks/form";
import type { ApplicationFormValues } from "../types";

export function ApplicationForm() {
  const navigate = useNavigate();
  const enrollmentDate = useMemo(() => new Date(), []);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [stepError, setStepError] = useState(false);

  const form = useApplicationForm((values: ApplicationFormValues) => {
    // Mocked submission for now — this will POST to the API later.
    console.log("Submitting application", values);
    setSubmitted(true);
  });

  // Validate the current step's fields before advancing; if anything's missing,
  // surface a message and jump the applicant straight to the first problem.
  async function goNext() {
    const fields = [
      ...(STEP_FIELDS[currentStep] ?? []),
      ...(STEP_EXTRA_VALIDATED_FIELDS[currentStep] ?? []),
    ];
    for (const name of fields) {
      await form.validateField(name, "change");
      form.setFieldMeta(name, (meta) => ({ ...meta, isTouched: true }));
    }
    const firstInvalid = fields.find(
      (name) => (form.getFieldMeta(name)?.errors.length ?? 0) > 0,
    );

    if (firstInvalid) {
      setStepError(true);
      requestAnimationFrame(() => {
        const el = document.getElementById(String(firstInvalid));
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el instanceof HTMLElement) el.focus({ preventScroll: true });
      });
      return;
    }

    setStepError(false);
    setCurrentStep((step) => Math.min(step + 1, REVIEW_STEP));
  }

  function goBack() {
    setStepError(false);
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function goToStep(index: number) {
    setStepError(false);
    setCurrentStep(index);
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2Icon className="size-12 text-emerald-600 dark:text-emerald-500" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Application submitted</h2>
            <p className="text-muted-foreground text-sm">
              Your application has been submitted for review. You can track its
              status anytime.
            </p>
          </div>
          <Button onClick={() => navigate("/portal/application")}>
            Back to Applications
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isReview = currentStep === REVIEW_STEP;
  const step = WIZARD_STEPS[currentStep];
  const StepIcon = step.icon;
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => navigate("/portal/application")}
      >
        <ArrowLeftIcon />
        Back to Applications
      </Button>

      <Card className="grid overflow-hidden p-0 md:grid-cols-[16rem_1fr]">
        {/* Left rail — branded vertical stepper. */}
        <aside className="bg-muted/40 hidden flex-col gap-5 border-r p-5 md:flex">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Enrollment
            </p>
            <h2 className="text-base font-semibold">New Application</h2>
          </div>
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <FormStepper
                currentStep={currentStep}
                onStepSelect={goToStep}
                completedSteps={WIZARD_STEPS.map((_, i) =>
                  isStepComplete(i, values),
                )}
              />
            )}
          </form.Subscribe>
        </aside>

        {/* Right — form content. */}
        <div className="flex min-w-0 flex-col p-6 sm:p-8">
          {/* Compact progress indicator for small screens. */}
          <div className="mb-6 md:hidden">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Step {currentStep + 1} of {WIZARD_STEPS.length}
              </span>
              <span className="font-medium">{step.shortTitle}</span>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step header. */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <StepIcon className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {step.title}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {step.description}
                </p>
              </div>
            </div>

            {!isReview && (STEP_FIELDS[currentStep]?.length ?? 0) > 0 && (
              <form.Subscribe selector={(state) => state.values}>
                {(values) => (
                  <Badge variant="outline" className="shrink-0">
                    {stepFilledCount(currentStep, values)}/
                    {STEP_FIELDS[currentStep].length} completed
                  </Badge>
                )}
              </form.Subscribe>
            )}
          </div>

          <form
            className="flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            {stepError && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive mb-5 flex items-start gap-3 rounded-lg border px-4 py-3"
              >
                <CircleAlertIcon className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">
                    Let's finish this step first
                  </p>
                  <p className="text-destructive/80 text-xs leading-relaxed">
                    A few required fields still need your attention. Please
                    complete or fix the items highlighted below to continue.
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1">
              {currentStep === 0 && (
                <PersonalStep form={form} enrollmentDate={enrollmentDate} />
              )}
              {currentStep === 1 && <ContactStep form={form} />}
              {currentStep === 2 && <AcademicStep form={form} />}
              {currentStep === 3 && <CourseStep form={form} />}
              {currentStep === 4 && (
                <ReviewStep form={form} enrollmentDate={enrollmentDate} />
              )}
            </div>

            <div className="mt-8 flex items-center justify-between border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={currentStep === 0}
                className="cursor-pointer"
              >
                <ChevronLeft />
                Back
              </Button>

              {isReview ? (
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button
                      type="submit"
                      className="cursor-pointer"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting…" : "Submit application"}
                    </Button>
                  )}
                </form.Subscribe>
              ) : (
                <Button
                  type="button"
                  className="cursor-pointer"
                  onClick={goNext}
                >
                  Next
                  <ChevronRight />
                </Button>
              )}
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
