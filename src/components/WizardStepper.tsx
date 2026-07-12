import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Horizontal step indicator. Completed steps are clickable to jump back. */
export function WizardStepper({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-2 min-w-0">
            <button
              type="button"
              disabled={i > current}
              onClick={() => i < current && onStepClick?.(i)}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary/15 text-primary ring-2 ring-primary",
                !done && !active && "bg-muted text-muted-foreground",
                i < current && "cursor-pointer",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
            <span className={cn("truncate text-xs", active ? "font-medium text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
