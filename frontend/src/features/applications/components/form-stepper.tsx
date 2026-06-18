import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "../constants";

interface FormStepperProps {
  currentStep: number;
  // Whether each step's required fields are all filled (live).
  completedSteps?: boolean[];
  // Jump to an already-visited or completed step.
  onStepSelect?: (index: number) => void;
}

// Vertical timeline stepper used in the wizard's left rail.
export function FormStepper({
  currentStep,
  completedSteps,
  onStepSelect,
}: FormStepperProps) {
  const lastIndex = WIZARD_STEPS.length - 1;

  return (
    <ol className="relative">
      {WIZARD_STEPS.map((step, index) => {
        const isCurrent = index === currentStep;
        const isComplete = Boolean(completedSteps?.[index]);
        // Navigable if you've already moved past it or it's finished.
        const reached = index < currentStep || isComplete;
        const clickable = !isCurrent && reached && Boolean(onStepSelect);
        const isLast = index === lastIndex;
        const Icon = step.icon;
        // The connector below a node fills in once that node is done/passed.
        const lineFilled = isComplete || index < currentStep;

        const node = (
          <>
            {/* Timeline column: node + connector. */}
            <div className="flex flex-col items-center self-stretch">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border transition-all",
                  isCurrent &&
                    "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !isCurrent &&
                    isComplete &&
                    "border-primary/30 bg-primary/10 text-primary",
                  !isCurrent &&
                    !isComplete &&
                    "border-border bg-background text-muted-foreground group-hover:border-primary/40",
                )}
              >
                {isComplete && !isCurrent ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    "mt-1.5 w-0.5 grow rounded-full transition-colors",
                    lineFilled ? "bg-primary/50" : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Label. */}
            <div className={cn("min-w-0", isLast ? "pb-1" : "pb-6")}>
              <p
                className={cn(
                  "text-sm leading-tight font-semibold transition-colors",
                  isCurrent || isComplete
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.title}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-snug">
                {step.description}
              </p>
              {isCurrent ? (
                <span className="text-primary mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium">
                  <span className="bg-primary size-1.5 animate-pulse rounded-full" />
                  In progress
                </span>
              ) : isComplete ? (
                <span className="text-primary/80 mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium">
                  <CheckIcon className="size-3" />
                  Completed
                </span>
              ) : null}
            </div>
          </>
        );

        const baseRow =
          "px-4 py-2 group flex w-full items-start gap-3 rounded-xl px-2 text-left transition-colors";

        return (
          <li key={step.title}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepSelect?.(index)}
                className={cn(baseRow, "hover:bg-muted/60 cursor-pointer")}
              >
                {node}
              </button>
            ) : (
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  baseRow,
                  isCurrent && "bg-background ring-border shadow-sm ring-1",
                )}
              >
                {node}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
