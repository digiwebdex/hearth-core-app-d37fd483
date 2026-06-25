import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowStepId = "lead" | "client" | "quotation" | "booking" | "invoice" | "payment";

const STEP_ORDER: WorkflowStepId[] = ["lead", "client", "quotation", "booking", "invoice", "payment"];

type Props = {
  current: WorkflowStepId;
  /** Highlighted next action */
  next?: WorkflowStepId;
  nextHref?: string;
  nextLabel?: string;
  onNextClick?: () => void;
  className?: string;
};

export function WorkflowNextStep({ current, next, nextHref, nextLabel, onNextClick, className }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const currentIdx = STEP_ORDER.indexOf(current);

  const labels: Record<WorkflowStepId, string> = {
    lead: isBn ? "লিড" : "Lead",
    client: isBn ? "ক্লায়েন্ট" : "Client",
    quotation: isBn ? "কোটেশন" : "Quotation",
    booking: isBn ? "বুকিং" : "Booking",
    invoice: isBn ? "ইনভয়েস" : "Invoice",
    payment: isBn ? "পেমেন্ট" : "Payment",
  };

  const handleNext = () => {
    if (onNextClick) onNextClick();
    else if (nextHref) navigate(nextHref);
  };

  return (
    <div className={cn("rounded-lg border bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex flex-wrap items-center gap-1 text-xs sm:text-sm text-muted-foreground">
        {STEP_ORDER.map((step, i) => (
          <span key={step} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/50">→</span>}
            <span
              className={cn(
                "px-1.5 py-0.5 rounded",
                step === current && "bg-primary/15 text-primary font-medium",
                currentIdx > i && "text-foreground/70",
              )}
            >
              {labels[step]}
            </span>
          </span>
        ))}
      </div>
      {(nextHref || onNextClick) && (
        <Button size="sm" onClick={handleNext}>
          {nextLabel || t("workflow.nextStep", { defaultValue: isBn ? "পরবর্তী ধাপ" : "Next step" })}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
