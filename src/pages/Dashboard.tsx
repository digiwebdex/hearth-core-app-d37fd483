import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { InquiryFollowUpWidget } from "@/components/InquiryFollowUpWidget";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Plane,
  DollarSign,
  RefreshCw,
  FileText,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  MapPin,
  CalendarDays,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  Send,
  Briefcase,
  ReceiptText,
  Building2,
  Package2,
  UploadCloud,
  Shield,
  Stamp,
  Hotel,
  Car,
  Headphones,
  IdCard,
} from "lucide-react";
import {
  dashboardApi,
  type DashboardStats,
  clientApi,
  bookingApi,
  paymentApi,
  tenantApi,
  leadApi,
  quotationApi,
  invoiceApi,
  vendorApi,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getTenantBookingPresets } from "@/lib/bookingTypeOptions";
import { bookingPresetPath } from "@/lib/bookingRoutePresets";
import EmptyState from "@/components/EmptyState";
import { getPlan, getLimitLabel, type PlanType } from "@/lib/plans";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ticketed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  traveling: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  unpaid: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  partial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const serviceShortcuts = useMemo(() => {
    const presets = getTenantBookingPresets(tenant?.enabledServiceTypes, tenant?.enabledSubcategories).slice(0, 4);
    const iconFor = (preset: string) => {
      switch (preset) {
        case "visa": return Stamp;
        case "flight": return Plane;
        case "hotel": return Hotel;
        case "transport": return Car;
        case "insurance": return Shield;
        default: return Briefcase;
      }
    };
    return presets.map((preset) => ({
      label: t(`bookingsForm.categories.${preset}`),
      icon: iconFor(preset),
      path: bookingPresetPath(preset),
    }));
  }, [tenant?.enabledServiceTypes, tenant?.enabledSubcategories, t]);

  const packagesPath = useMemo(() => {
    const presets = getTenantBookingPresets(tenant?.enabledServiceTypes, tenant?.enabledSubcategories);
    if (presets.includes("tour")) return "/packages/tour";
    if (presets.includes("hajj") || presets.includes("umrah")) return "/packages/hajj";
    if (presets.includes("visa")) return "/packages/visa";
    return "/packages/all";
  }, [tenant?.enabledServiceTypes, tenant?.enabledSubcategories]);

  const text = {
    packagesServices: isBn ? "প্যাকেজ ও সার্ভিসেস" : "Packages & Services",
    payments: isBn ? "পেমেন্টস" : "Payments",
    publishDomain: isBn ? "পাবলিশ ও ডোমেইন" : "Publish & Domain",
    setupServiceCatalog: isBn ? "সার্ভিস ক্যাটালগ সেটআপ করুন" : "Set up service catalog",
    startCollectingPayments: isBn ? "পেমেন্ট সংগ্রহ শুরু করুন" : "Start collecting payments",
    serviceHub: isBn ? "সার্ভিস হাব" : "Service hub",
    businessFlow: isBn ? "নতুন নেভিগেশন অনুযায়ী দ্রুত শুরু করুন" : "Quick start with the new business flow",
  };

  const quickActions = [
    {
      label: t("sidebar.leads"),
      icon: UserPlus,
      path: "/leads",
      variant: "outline" as const,
    },
    {
      label: text.packagesServices,
      icon: Package2,
      path: packagesPath,
      variant: "outline" as const,
    },
    ...serviceShortcuts.map((item) => ({
      label: item.label,
      icon: item.icon,
      path: item.path,
      variant: "outline" as const,
    })),
    {
      label: t("sidebar.quotations"),
      icon: Send,
      path: "/quotations/new",
      variant: "outline" as const,
    },
    {
      label: t("sidebar.bookings"),
      icon: Plane,
      path: "/bookings",
      variant: "outline" as const,
    },
    {
      label: text.payments,
      icon: CreditCard,
      path: "/payments",
      variant: "outline" as const,
    },
    {
      label: text.publishDomain,
      icon: UploadCloud,
      path: "/website/publish",
      variant: "outline" as const,
    },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch {
      try {
        const today = new Date().toISOString().split("T")[0];
        const thisMonth = new Date().toISOString().slice(0, 7);
        const next7Days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

        const [members, clients, bookings, payments, leads, quotations, invoices, vendorBills] = await Promise.all([
          tenantApi.getMembers().catch(() => []),
          clientApi.list().catch(() => []),
          bookingApi.list().catch(() => []),
          paymentApi.list().catch(() => []),
          leadApi.list().catch(() => []),
          quotationApi.list().catch(() => []),
          invoiceApi.list().catch(() => []),
          vendorApi.getPayableReport().catch(() => []),
        ]);

        const activeLeads = leads.filter((l: any) => !["won", "lost"].includes(l.status)).length;
        const followUpsDueToday = leads.filter((l: any) => l.nextFollowUp && l.nextFollowUp <= today && !["won", "lost"].includes(l.status)).length;
        const quotationsSentThisMonth = quotations.filter((q: any) => q.status === "sent" && q.createdAt?.startsWith(thisMonth)).length;
        const quotationsAwaitingApproval = quotations.filter((q: any) => q.status === "sent").length;
        const confirmedBookings = bookings.filter((b: any) => b.status === "confirmed").length;
        const upcomingDepartures = bookings.filter((b: any) =>
          b.travelDateFrom && b.travelDateFrom >= today && b.travelDateFrom <= next7Days && ["confirmed", "ticketed"].includes(b.status)
        ).length;
        const overdueInvoicesList = invoices.filter((i: any) => i.status === "overdue" || (i.status !== "paid" && i.status !== "cancelled" && i.dueDate && i.dueDate < today));
        const overdueInvoices = overdueInvoicesList.length;
        const overdueInvoiceAmount = (overdueInvoicesList as any[]).reduce((s: number, i: any) => s + (i.dueAmount || 0), 0);
        const vendorDues = (vendorBills as any[]).reduce((s: number, b: any) => s + (b.dueAmount || 0), 0);
        const salesThisMonth = (payments as any[])
          .filter((p: any) => p.date?.startsWith(thisMonth) || p.createdAt?.startsWith(thisMonth))
          .reduce((s: number, p: any) => s + (p.amount || 0), 0);
        const totalRevenue = (bookings as any[]).reduce((s: number, b: any) => s + (b.amount || 0), 0);

        const destMap: Record<string, number> = {};
        bookings.forEach((b: any) => {
          if (b.destination) destMap[b.destination] = (destMap[b.destination] || 0) + 1;
        });
        const topDestinations = Object.entries(destMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([destination, count]) => ({ destination, count }));

        const typeMap: Record<string, number> = {};
        bookings.forEach((b: { type?: string }) => {
          const key = String(b.type || "other").trim() || "other";
          typeMap[key] = (typeMap[key] || 0) + 1;
        });
        const bookingsByType = Object.entries(typeMap)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count }));

        setStats({
          totalUsers: members.length,
          totalClients: clients.length,
          totalBookings: bookings.length,
          totalRevenue,
          recentBookings: bookings.slice(-5).reverse(),
          recentPayments: payments.slice(-5).reverse(),
          activeLeads,
          followUpsDueToday,
          quotationsSentThisMonth,
          quotationsAwaitingApproval,
          confirmedBookings,
          upcomingDepartures,
          overdueInvoices,
          overdueInvoiceAmount,
          vendorDues,
          salesThisMonth,
          topDestinations,
          bookingsByType,
          openSupportTickets: 0,
          passportsExpiringSoon: 0,
          passportsExpired: 0,
        });
      } catch {
        toast({ title: t("dashboard.loadFailed"), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const hasAnyData = stats && (stats.totalBookings > 0 || stats.totalClients > 0 || stats.activeLeads > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>

        <OnboardingChecklist />

        {tenant ? (() => {
          const planCfg = getPlan((tenant.subscriptionPlan || "basic") as PlanType);
          const rows = [
            { label: t("dashboard.usageClients", { defaultValue: "Clients" }), used: stats?.totalClients ?? 0, max: planCfg.maxClients },
            { label: t("dashboard.usageBookings", { defaultValue: "Bookings" }), used: stats?.totalBookings ?? 0, max: planCfg.maxBookings },
            { label: t("dashboard.usageUsers", { defaultValue: "Team members" }), used: stats?.totalUsers ?? 0, max: planCfg.maxUsers },
          ];
          const statusRaw = String(tenant.subscriptionStatus || "active").toLowerCase();
          return (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{t("dashboard.yourPlan", { defaultValue: "Your plan" })}:</span>
                    <Badge variant="default">{planCfg.name}</Badge>
                    <Badge variant={statusRaw === "active" || statusRaw === "trial" ? "secondary" : "destructive"} className="capitalize">{statusRaw}</Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/subscription")}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {t("dashboard.managePlan", { defaultValue: "Manage / Upgrade plan" })}
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {rows.map((r) => {
                    const unlimited = r.max === -1;
                    const pct = unlimited ? 0 : Math.min(100, Math.round((r.used / Math.max(1, r.max)) * 100));
                    const near = !unlimited && pct >= 80;
                    return (
                      <div key={r.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className={`font-medium ${near ? "text-amber-600" : ""}`}>
                            {r.used.toLocaleString()} / {getLimitLabel(r.max)}
                          </span>
                        </div>
                        <Progress value={unlimited ? 6 : pct} className={`h-2 ${near ? "[&>div]:bg-amber-500" : ""}`} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })() : null}

        {!loading && !hasAnyData && (
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h2 className="text-xl font-semibold">{t("dashboard.welcomeTitle")}</h2>
                  <p className="text-muted-foreground mt-1 max-w-lg mx-auto">{t("dashboard.welcomeDesc")}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button onClick={() => navigate("/leads")}><UserPlus className="mr-2 h-4 w-4" /> {t("dashboard.addLead")}</Button>
                  <Button variant="outline" onClick={() => navigate("/packages/tour")}><Package2 className="mr-2 h-4 w-4" /> {text.setupServiceCatalog}</Button>
                  <Button variant="outline" onClick={() => navigate("/quotations/new")}><Send className="mr-2 h-4 w-4" /> {t("dashboard.createQuotation")}</Button>
                  <Button variant="outline" onClick={() => navigate("/payments")}><CreditCard className="mr-2 h-4 w-4" /> {text.startCollectingPayments}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <WidgetCard
            title={t("dashboard.activeLeads")}
            value={stats?.activeLeads ?? 0}
            icon={UserPlus}
            color="text-blue-600"
            loading={loading}
            onClick={() => navigate("/leads")}
            subtitle={stats?.followUpsDueToday ? `${stats.followUpsDueToday} ${t("dashboard.followUpsDue")}` : undefined}
            subtitleColor={stats?.followUpsDueToday ? "text-orange-600 dark:text-orange-400" : undefined}
          />
          <WidgetCard
            title={t("dashboard.quotationsSent")}
            value={stats?.quotationsSentThisMonth ?? 0}
            icon={Send}
            color="text-indigo-600"
            loading={loading}
            onClick={() => navigate("/quotations")}
            subtitle={stats?.quotationsAwaitingApproval ? `${stats.quotationsAwaitingApproval} ${t("dashboard.awaitingApproval")}` : undefined}
          />
          <WidgetCard
            title={t("dashboard.confirmedBookings")}
            value={stats?.confirmedBookings ?? 0}
            icon={CheckCircle2}
            color="text-emerald-600"
            loading={loading}
            onClick={() => navigate("/bookings")}
          />
          <WidgetCard
            title={t("dashboard.upcomingDepartures")}
            value={stats?.upcomingDepartures ?? 0}
            icon={Plane}
            color="text-violet-600"
            loading={loading}
            onClick={() => navigate("/operations/services?desk=departures")}
            subtitle={t("dashboard.next7Days")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <WidgetCard
            title={t("dashboard.salesThisMonth")}
            value={`৳${(stats?.salesThisMonth ?? 0).toLocaleString()}`}
            icon={TrendingUp}
            color="text-emerald-600"
            loading={loading}
          />
          <WidgetCard
            title={t("dashboard.overdueInvoices")}
            value={stats?.overdueInvoices ?? 0}
            icon={AlertTriangle}
            color="text-destructive"
            loading={loading}
            onClick={() => navigate("/invoices")}
            subtitle={stats?.overdueInvoiceAmount ? `৳${stats.overdueInvoiceAmount.toLocaleString()} ${t("dashboard.outstanding")}` : undefined}
            subtitleColor="text-destructive"
          />
          <WidgetCard
            title={t("dashboard.vendorDues")}
            value={`৳${(stats?.vendorDues ?? 0).toLocaleString()}`}
            icon={Building2}
            color="text-orange-600"
            loading={loading}
            onClick={() => navigate("/vendors")}
          />
          <WidgetCard
            title={t("dashboard.totalRevenue")}
            value={`৳${(stats?.totalRevenue ?? 0).toLocaleString()}`}
            icon={DollarSign}
            color="text-amber-600"
            loading={loading}
          />
        </div>

        <InquiryFollowUpWidget />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <WidgetCard
            title={t("dashboard.openSupportTickets")}
            value={stats?.openSupportTickets ?? 0}
            icon={Headphones}
            color="text-rose-600"
            loading={loading}
            onClick={() => navigate("/support")}
            subtitle={t("dashboard.viewSupport")}
          />
          <WidgetCard
            title={t("dashboard.passportsExpiringSoon")}
            value={stats?.passportsExpiringSoon ?? 0}
            icon={IdCard}
            color="text-amber-600"
            loading={loading}
            onClick={() => navigate("/clients?filter=passport")}
            subtitle={
              stats?.passportsExpired
                ? t("dashboard.passportsExpiredCount", { count: stats.passportsExpired })
                : t("dashboard.passportsWindow")
            }
            subtitleColor={stats?.passportsExpired ? "text-destructive" : undefined}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg"><Plane className="h-5 w-5" /> {t("dashboard.recentBookings")}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/bookings")}>{t("common.viewAll")} <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : !stats?.recentBookings?.length ? (
                <EmptyState icon={Plane} title={t("dashboard.noBookings")} description="" actionLabel={t("dashboard.newBooking")} onAction={() => navigate("/bookings")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("dashboard.booking")}</TableHead>
                      <TableHead>{t("dashboard.destination")}</TableHead>
                      <TableHead className="text-right">{t("common.amount")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("dashboard.travelDate")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentBookings.map((b) => (
                      <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{b.title || b.clientName || b.type}</p>
                            <p className="text-xs text-muted-foreground capitalize">{b.type}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{b.destination || "—"}</TableCell>
                        <TableCell className="text-right font-medium">৳{b.amount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[b.status] || ""}`}>
                            {b.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {b.travelDateFrom ? new Date(b.travelDateFrom).toLocaleDateString() : new Date(b.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5" /> {t("dashboard.topDestinations")}</CardTitle>
              <CardDescription>{t("dashboard.byBookingCount")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : !stats?.topDestinations?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("dashboard.destinationHint")}</p>
              ) : (
                <div className="space-y-3">
                  {stats.topDestinations.map((d) => {
                    const maxCount = stats.topDestinations[0]?.count || 1;
                    return (
                      <div key={d.destination} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{d.destination}</span>
                          <Badge variant="secondary">{d.count}</Badge>
                        </div>
                        <Progress value={(d.count / maxCount) * 100} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Briefcase className="h-5 w-5" /> {t("dashboard.bookingsByType")}</CardTitle>
              <CardDescription>{t("dashboard.bookingsByTypeHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : !stats?.bookingsByType?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("dashboard.noBookings")}</p>
              ) : (
                <div className="space-y-3">
                  {stats.bookingsByType.map((row) => {
                    const maxCount = stats.bookingsByType![0]?.count || 1;
                    return (
                      <div key={row.type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">
                            {t(`bookingsForm.types.${row.type}`, { defaultValue: row.type })}
                          </span>
                          <Badge variant="secondary">{row.count}</Badge>
                        </div>
                        <Progress value={(row.count / maxCount) * 100} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5" /> {t("dashboard.recentPayments")}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/payments")}>{t("common.viewAll")} <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : !stats?.recentPayments?.length ? (
                <EmptyState icon={CreditCard} title={t("dashboard.noPayments")} description="" actionLabel={text.payments} onAction={() => navigate("/payments")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("dashboard.method")}</TableHead>
                      <TableHead className="text-right">{t("common.amount")}</TableHead>
                      <TableHead>{t("dashboard.reference")}</TableHead>
                      <TableHead>{t("common.date")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="capitalize font-medium text-sm">{p.method}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">৳{p.amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.transactionRef || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(p.date).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5" /> {t("dashboard.quickSummary")}</CardTitle>
              <CardDescription>{text.businessFlow}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label={t("dashboard.totalClients")} value={stats?.totalClients ?? 0} loading={loading} />
                <MiniStat label={t("dashboard.totalBookings")} value={stats?.totalBookings ?? 0} loading={loading} />
                <MiniStat label={t("dashboard.teamMembers")} value={stats?.totalUsers ?? 0} loading={loading} />
                <MiniStat label={t("dashboard.followUpsToday")} value={stats?.followUpsDueToday ?? 0} loading={loading} highlight={!!stats?.followUpsDueToday} />
              </div>

              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Package2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">{text.serviceHub}</p>
                </div>
                <p className="text-xs text-muted-foreground">{text.businessFlow}</p>
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button key={action.path} size="sm" variant={action.variant} onClick={() => navigate(action.path)}>
                        <Icon className="mr-1 h-3.5 w-3.5" /> {action.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

function WidgetCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
  onClick,
  subtitle,
  subtitleColor,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  loading: boolean;
  onClick?: () => void;
  subtitle?: string;
  subtitleColor?: string;
}) {
  return (
    <Card
      className={`border-border/60 transition-all duration-200 ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-border" : "hover:shadow-sm"}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
            {subtitle ? <p className={`text-xs mt-1 ${subtitleColor || "text-muted-foreground"}`}>{subtitle}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, loading, highlight }: { label: string; value: number; loading: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-orange-300 dark:border-orange-600" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="h-6 w-12 mt-1" />
      ) : (
        <p className={`text-lg font-bold ${highlight ? "text-orange-600 dark:text-orange-400" : ""}`}>{value}</p>
      )}
    </div>
  );
}

export default Dashboard;
