import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { leadApi, type LeadPipelineStats } from "@/lib/api";
import { TrendingUp, BarChart3, ArrowRight } from "lucide-react";

const STAGE_ORDER = ["new", "contacted", "qualified", "quoted", "won", "lost"];

export function LeadPipelineSummary({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<LeadPipelineStats | null>(null);

  useEffect(() => {
    leadApi.getPipelineStats().then(setStats).catch(() => setStats(null));
  }, [refreshKey]);

  if (!stats || stats.total === 0) return null;

  const maxStage = Math.max(...stats.byStage.map((s) => s.count), 1);
  const topSources = stats.bySource.slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t("leadsForm.pipeline.funnelTitle")}
          </CardTitle>
          <CardDescription>{t("leadsForm.pipeline.funnelDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {STAGE_ORDER.map((status) => {
            const row = stats.byStage.find((s) => s.status === status);
            const count = row?.count ?? 0;
            if (count === 0 && !["new", "won"].includes(status)) return null;
            return (
              <div key={status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{t(`leadsForm.statuses.${status}`)}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
                <Progress value={(count / maxStage) * 100} className="h-1.5" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t("leadsForm.pipeline.sourceTitle")}
          </CardTitle>
          <CardDescription>
            {t("leadsForm.pipeline.conversion", { rate: stats.conversionRate })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {topSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("leadsForm.pipeline.noSources")}</p>
          ) : (
            topSources.map((row) => (
              <div key={row.source} className="flex items-center justify-between text-sm gap-2">
                <span className="truncate font-medium">{row.source}</span>
                <span className="text-muted-foreground shrink-0">
                  {row.won}/{row.total} ({row.conversionRate}%)
                </span>
              </div>
            ))
          )}
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => navigate("/reports")}>
            {t("leadsForm.pipeline.fullReport")}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
