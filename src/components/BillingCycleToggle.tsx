import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BillingCycle } from "@/lib/plans";

type BillingCycleToggleProps = {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
  /** Dark marketing pages (landing, /pricing) vs light tenant site */
  variant?: "marketing" | "light";
};

const BillingCycleToggle = ({ value, onChange, className, variant = "marketing" }: BillingCycleToggleProps) => {
  const { t } = useTranslation();
  const isMarketing = variant === "marketing";

  const activeClass = isMarketing
    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md"
    : "bg-primary text-primary-foreground shadow-sm";
  const inactiveClass = isMarketing
    ? "text-white/45 hover:text-white"
    : "text-muted-foreground hover:text-foreground";
  const shellClass = isMarketing
    ? "bg-white/5 border-white/8"
    : "bg-muted/60 border-border";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 p-1.5 rounded-full border",
        shellClass,
        className,
      )}
      role="group"
      aria-label={t("marketing.pricing.billingToggleLabel")}
    >
      <button
        type="button"
        onClick={() => onChange("monthly")}
        aria-pressed={value === "monthly"}
        className={cn(
          "px-5 py-2 rounded-full text-sm font-medium transition",
          value === "monthly" ? activeClass : inactiveClass,
        )}
      >
        {t("marketing.pricing.monthly")}
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        aria-pressed={value === "yearly"}
        className={cn(
          "px-5 py-2 rounded-full text-sm font-medium transition flex items-center gap-2",
          value === "yearly" ? activeClass : inactiveClass,
        )}
      >
        {t("marketing.pricing.yearly")}
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] border-0",
            isMarketing
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
          )}
        >
          {t("marketing.pricing.save2Months")}
        </Badge>
      </button>
    </div>
  );
};

export default BillingCycleToggle;
