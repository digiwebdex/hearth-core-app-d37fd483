import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, AlertTriangle, CalendarClock, Info } from "lucide-react";
import { portalApi } from "@/lib/portalApi";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "../lib/format";

function iconFor(type: string) {
  if (/due|overdue|payment/i.test(type)) return AlertTriangle;
  if (/trip|travel|departure|upcoming/i.test(type)) return CalendarClock;
  return Info;
}

export default function Notifications() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-notifications"], queryFn: portalApi.notifications });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Bell className="h-6 w-6" /> {t("portal.notifications", { defaultValue: "Notifications" })}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.notificationsHint", { defaultValue: "Payment reminders and trip updates." })}</p>
      </div>

      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : data && data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("portal.noNotifications", { defaultValue: "You're all caught up." })}</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {data?.map((n) => {
            const Icon = iconFor(n.type);
            const danger = /due|overdue/i.test(n.type) || n.severity === "warning";
            return (
              <Card key={n.id} className={danger ? "border-amber-300" : ""}>
                <CardContent className="p-4 flex items-start gap-3">
                  <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${danger ? "text-amber-600" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    {n.title && <div className="font-medium">{n.title}</div>}
                    <div className="text-sm text-muted-foreground">{n.message}</div>
                    {n.date && <div className="text-xs text-muted-foreground mt-1">{formatDate(n.date)}</div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
