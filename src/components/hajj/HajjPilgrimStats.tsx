import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Shield, FileText } from "lucide-react";
import type { HajjSummary } from "./types";

interface Props {
  summary: HajjSummary;
  packageCount: number;
}

export function HajjPilgrimStats({ summary, packageCount }: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">{t("hajjForm.stats.pilgrims")}</div>
          <p className="text-2xl font-bold">{summary.totalPilgrims}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">{t("hajjForm.stats.revenue")}</div>
          <p className="text-2xl font-bold">৳{summary.totalRevenue.toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">{t("hajjForm.stats.collected")}</div>
          <p className="text-2xl font-bold text-green-600">৳{summary.totalCollected.toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">{t("hajjForm.stats.outstanding")}</div>
          <p className="text-2xl font-bold text-destructive">৳{summary.totalDue.toLocaleString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> {t("hajjForm.stats.grossProfit")}
          </div>
          <p className={`text-2xl font-bold ${summary.grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
            ৳{summary.grossProfit.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">{t("hajjForm.stats.packages")}</div>
          <p className="text-2xl font-bold">{packageCount}</p>
        </CardContent>
      </Card>
      <Card className={summary.visaPending > 0 ? "border-orange-300 dark:border-orange-600" : ""}>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> {t("hajjForm.stats.visaPending")}
          </div>
          <p className="text-2xl font-bold">{summary.visaPending}</p>
        </CardContent>
      </Card>
      <Card className={summary.docsPending > 0 ? "border-yellow-300 dark:border-yellow-600" : ""}>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> {t("hajjForm.stats.docsPending")}
          </div>
          <p className="text-2xl font-bold">{summary.docsPending}</p>
        </CardContent>
      </Card>
    </div>
  );
}
