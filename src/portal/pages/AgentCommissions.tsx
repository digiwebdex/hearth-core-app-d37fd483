import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { portalApi } from "@/lib/portalApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatMoney(n: number) {
  return `৳${n.toLocaleString()}`;
}

export default function AgentCommissions() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-agent-commissions"],
    queryFn: portalApi.agentCommissions,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("portal.agentTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.agentSubtitle")}</p>
      </div>

      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-destructive">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("portal.commissionPending")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatMoney(data.pendingTotal)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("portal.commissionPaid")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-green-600">
                {formatMoney(data.paidTotal)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("portal.commissionBookings")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{data.bookingCount}</CardContent>
            </Card>
          </div>

          {data.items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {t("portal.noAgentBookings")}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {data.items.map((b) => (
                <Card key={b.id}>
                  <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {b.title || b.destination || t("portal.bookingFallback")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {b.clientName}
                        {b.destination ? ` · ${b.destination}` : ""}
                        {b.travelDateFrom ? ` · ${b.travelDateFrom}` : ""}
                      </div>
                      {b.tenantName && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("portal.agency")}: {b.tenantName}
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="outline">{b.status}</Badge>
                      <div className="text-sm">
                        {t("portal.bookingAmount")}: {formatMoney(b.amount)}
                      </div>
                      {b.commissionAmount != null && (
                        <div className="text-sm font-medium">
                          {t("portal.commission")}: {formatMoney(b.commissionAmount)}
                          {b.commissionStatus && (
                            <Badge className="ml-2" variant="secondary">
                              {b.commissionStatus}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
