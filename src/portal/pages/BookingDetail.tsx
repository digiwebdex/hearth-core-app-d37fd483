import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { portalApi } from "@/lib/portalApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatMoney(n: number) {
  return `৳${n.toLocaleString()}`;
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-booking", id],
    queryFn: () => portalApi.bookingDetail(id!),
    enabled: Boolean(id),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/bookings">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("portal.backToBookings")}
          </Link>
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-destructive">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">
                {data.title || data.destination || t("portal.bookingFallback")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {data.destination}
                {data.travelDateFrom ? ` · ${data.travelDateFrom}` : ""}
                {data.travelDateTo ? ` → ${data.travelDateTo}` : ""}
              </p>
              {data.tenantName && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("portal.agency")}: {data.tenantName}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{data.status}</Badge>
              <Badge>{data.paymentStatus}</Badge>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("portal.paymentSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground">{t("portal.total")}</div>
                <div className="font-medium">{formatMoney(data.amount)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("portal.paid")}</div>
                <div className="font-medium">{formatMoney(data.paidAmount)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t("portal.due")}</div>
                <div className={`font-medium ${data.dueAmount > 0 ? "text-destructive" : ""}`}>
                  {formatMoney(data.dueAmount)}
                </div>
              </div>
            </CardContent>
          </Card>

          {data.travelers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("portal.travelers")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.travelers.map((tr) => (
                  <div key={tr.id} className="text-sm">
                    {tr.name}
                    {tr.nationality ? (
                      <span className="text-muted-foreground"> · {tr.nationality}</span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.invoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("portal.invoices")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.invoices.map((inv) => (
                  <div key={inv.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="font-medium">
                        {inv.invoiceNumber || inv.id.slice(0, 8)}
                      </div>
                      <Badge variant="outline">{inv.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatMoney(inv.paidAmount)} / {formatMoney(inv.totalAmount)}
                      {inv.dueAmount > 0 && (
                        <span className="text-destructive ml-2">
                          {t("portal.due")}: {formatMoney(inv.dueAmount)}
                        </span>
                      )}
                    </div>
                    {inv.installments.length > 0 && (
                      <div className="space-y-1 pt-1 border-t">
                        <div className="text-xs font-medium text-muted-foreground">
                          {t("portal.installments")}
                        </div>
                        {inv.installments.map((k) => (
                          <div
                            key={k.id}
                            className="flex justify-between text-xs gap-2"
                          >
                            <span>
                              {k.label}
                              {k.dueDate ? ` · ${k.dueDate}` : ""}
                            </span>
                            <span>
                              {formatMoney(k.paidAmount)} / {formatMoney(k.amount)} · {k.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("portal.updates")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.timeline.map((ev) => (
                  <div key={ev.id} className="text-sm border-l-2 pl-3 border-primary/30">
                    <div>{ev.content}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(ev.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
