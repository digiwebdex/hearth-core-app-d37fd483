import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Shield, CreditCard, CheckCircle2 } from "lucide-react";
import type { HajjPackage } from "@/lib/hajjApi";
import type { HajjPackageProfitRow, HajjSummary } from "./types";

interface Props {
  summary: HajjSummary;
  packages: HajjPackage[];
  pkgProfitability: HajjPackageProfitRow[];
}

export function HajjAnalyticsTab({ summary, packages, pkgProfitability }: Props) {
  const { t } = useTranslation();
  const fullPackages = packages.filter((p) => p.capacity > 0 && p.enrolled >= p.capacity).length;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("hajjForm.analytics.profitability")}</CardTitle>
          <CardDescription>{t("hajjForm.analytics.profitabilityDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("hajjForm.analytics.package")}</TableHead>
                <TableHead>{t("hajjForm.analytics.enrolled")}</TableHead>
                <TableHead>{t("hajjForm.analytics.revenue")}</TableHead>
                <TableHead>{t("hajjForm.analytics.cost")}</TableHead>
                <TableHead>{t("hajjForm.analytics.profit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pkgProfitability.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.enrolled}</TableCell>
                  <TableCell>৳{row.revenue.toLocaleString()}</TableCell>
                  <TableCell>৳{row.cost.toLocaleString()}</TableCell>
                  <TableCell className={row.profit >= 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>৳{row.profit.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("hajjForm.analytics.alerts")}</CardTitle>
          <CardDescription>{t("hajjForm.analytics.alertsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div><div className="font-medium">{t("hajjForm.analytics.docsPending")}</div><div className="text-sm text-muted-foreground">{t("hajjForm.analytics.docsPendingDesc", { count: summary.docsPending })}</div></div>
          </div>
          <div className="rounded-lg border p-3 flex items-start gap-3">
            <Shield className="h-5 w-5 text-orange-500 mt-0.5" />
            <div><div className="font-medium">{t("hajjForm.analytics.visaPending")}</div><div className="text-sm text-muted-foreground">{t("hajjForm.analytics.visaPendingDesc", { count: summary.visaPending })}</div></div>
          </div>
          <div className="rounded-lg border p-3 flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-red-500 mt-0.5" />
            <div><div className="font-medium">{t("hajjForm.analytics.outstanding")}</div><div className="text-sm text-muted-foreground">{t("hajjForm.analytics.outstandingDesc", { amount: summary.totalDue.toLocaleString() })}</div></div>
          </div>
          <div className="rounded-lg border p-3 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div><div className="font-medium">{t("hajjForm.analytics.capacity")}</div><div className="text-sm text-muted-foreground">{t("hajjForm.analytics.capacityDesc", { count: fullPackages })}</div></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
