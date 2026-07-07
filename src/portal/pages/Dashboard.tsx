import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarClock, Wallet, Bell, ChevronRight } from "lucide-react";
import { portalApi } from "@/lib/portalApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate } from "../lib/format";

export default function Dashboard() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-dashboard"], queryFn: portalApi.dashboard });

  const stats = [
    { icon: CalendarClock, label: t("portal.upcomingTrips", { defaultValue: "Upcoming trips" }), value: String(data?.upcomingCount ?? 0), tone: "text-sky-600" },
    { icon: Wallet, label: t("portal.totalDue", { defaultValue: "Total due" }), value: formatMoney(data?.totalDue), tone: "text-amber-600" },
    { icon: Bell, label: t("portal.notifications", { defaultValue: "Notifications" }), value: String(data?.notificationCount ?? 0), tone: "text-violet-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("portal.dashboard", { defaultValue: "Dashboard" })}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.dashboardHint", { defaultValue: "Your trips, payments and updates at a glance." })}</p>
      </div>

      {error && <p className="text-destructive">{(error as Error).message}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2"><s.icon className={`h-5 w-5 ${s.tone}`} /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                {isLoading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-xl font-bold">{s.value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">{t("portal.recentBookings", { defaultValue: "Recent bookings" })}</h2>
          <Link to="/bookings" className="text-sm text-primary hover:underline">{t("common.viewAll", { defaultValue: "View all" })}</Link>
        </div>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : data && data.recentBookings.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">{t("portal.noBookings")}</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {data?.recentBookings.map((b) => (
              <Link key={b.id} to={`/bookings/${b.id}`} className="block group">
                <Card className="transition-colors group-hover:border-primary/50">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.title || b.destination || t("portal.bookingFallback")}</div>
                      <div className="text-xs text-muted-foreground">{b.destination} · {formatDate(b.travelDateFrom)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="capitalize">{b.status}</Badge>
                      {b.dueAmount > 0 && <span className="text-xs text-destructive">{t("portal.due")}: {formatMoney(b.dueAmount)}</span>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
