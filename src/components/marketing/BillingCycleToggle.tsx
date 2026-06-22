import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { BillingCycle } from "@/lib/plans";

interface BillingCycleToggleProps {
  billing: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
}

export function BillingCycleToggle({ billing, onChange, className = "" }: BillingCycleToggleProps) {
  const { t } = useTranslation();

  return (
    <div className={className}>
      <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-white/5 border border-white/8">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition ${
            billing === "monthly"
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md"
              : "text-white/45 hover:text-white"
          }`}
        >
          {t("marketing.pricing.monthly")}
        </button>
        <button
          type="button"
          onClick={() => onChange("yearly")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
            billing === "yearly"
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md"
              : "text-white/45 hover:text-white"
          }`}
        >
          {t("marketing.pricing.yearly")}
          <Badge variant="secondary" className="text-[10px] bg-emerald-500/20 text-emerald-400 border-0">
            {t("marketing.pricing.twoMonthsFree")}
          </Badge>
        </button>
      </div>
      {billing === "yearly" && (
        <p className="text-sm text-emerald-400 mt-3">{t("marketing.pricing.save2Months")}</p>
      )}
    </div>
  );
}
