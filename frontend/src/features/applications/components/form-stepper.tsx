import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "../constants";

interface FormStepperProps {
  currentStep: number;
  // Whether each step's required fields are all filled (live).
  completedSteps?: boolean[];
  // Jump back to an already-visited step.
  onStepSelect?: (index: number) => void;
}

// Vertical stepper used in the wizard's left rail.
export function FormStepper({
  currentStep,
  completedSteps,
  onStepSelect,
}: FormStepperProps) {
  return (
    <ol className="space-y-1">
      {WIZARD_STEPS.map((step, index) => {
        const isCurrent = index === currentStep;
        const isComplete = !isCurrent && Boolean(completedSteps?.[index]);
        const Icon = step.icon;
        const clickable = index < currentStep && Boolean(onStepSelect);

        const content = (
          <>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                isCurrent &&
                  "border-primary bg-primary text-primary-foreground",
                isComplete && "border-primary/40 bg-primary/10 text-primary",
                !isCurrent &&
                  !isComplete &&
                  "border-border text-muted-foreground",
              )}
            >
              {isComplete ? (
                <CheckIcon className="size-4" />
              ) : (
                <Icon className="size-4" />
              )}
            </span>
            <div className="min-w-0 pt-0.5 text-left">
              <p
                className={cn(
                  "text-sm leading-tight font-medium",
                  !isCurrent && !isComplete && "text-muted-foreground",
                )}
              >
                {step.title}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-tight">
                {step.description}
              </p>
            </div>
          </>
        );

        return (
          <li key={step.title}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepSelect?.(index)}
                className="hover:bg-background/60 flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer"
              >
                {content}
              </button>
            ) : (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg px-3 py-2.5",
                  isCurrent && "bg-background ring-border shadow-sm ring-1",
                )}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
