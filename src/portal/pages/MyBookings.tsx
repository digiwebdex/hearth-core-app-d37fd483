import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { portalApi } from "@/lib/portalApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatMoney(n: number) {
  return `৳${n.toLocaleString()}`;
}

export default function MyBookings() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-bookings"],
    queryFn: portalApi.bookings,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("portal.myBookings")}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.myBookingsHint")}</p>
      </div>

      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {data && data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("portal.noBookings")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {data?.map((b) => (
          <Link key={b.id} to={`/bookings/${b.id}`} className="block group">
            <Card className="transition-colors group-hover:border-primary/50">
              <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {b.title || b.destination || t("portal.bookingFallback")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {b.destination} · {b.travelDateFrom || t("portal.dateTbd")}
                      {b.travelDateTo ? ` → ${b.travelDateTo}` : ""}
                    </div>
                    {b.tenantName && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {t("portal.agency")}: {b.tenantName}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="text-right space-y-1">
                  <div className="flex gap-2 justify-end">
                    <Badge variant="outline">{b.status}</Badge>
                    <Badge>{b.paymentStatus}</Badge>
                  </div>
                  <div className="text-sm">
                    {formatMoney(b.paidAmount)} / {formatMoney(b.amount)}
                  </div>
                  {b.dueAmount > 0 && (
                    <div className="text-xs text-destructive">
                      {t("portal.due")}: {formatMoney(b.dueAmount)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
