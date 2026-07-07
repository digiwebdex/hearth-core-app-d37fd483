import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Building2, Users, Crown,
  Download, AlertTriangle, BarChart3,
} from "lucide-react";
import { adminApi, type AdminStats, type AdminTenant, type AdminPaymentRequest } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { useToast } from "@/hooks/use-toast";

const PLAN_COLORS: Record<string, string> = {
  free: "#94a3b8",
  basic: "#3b82f6",
  pro: "#8b5cf6",
  business: "#10b981",
  enterprise: "#f59e0b",
};

function planMonthlyPrice(planId?: string | null) {
  const plan = PLANS.find((p) => p.id === planId);
  return plan && plan.monthlyPrice > 0 ? plan.monthlyPrice : 0;
}

const AdminReports = () => {
  const [period, setPeriod] = useState("6m");
  const [platformStats, setPlatformStats] = useState<AdminStats | null>(null);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<AdminPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, tn, pr] = await Promise.all([
          adminApi.getStats().catch(() => null),
          adminApi.getTenants({ excludePlatform: true }).catch(() => []),
          adminApi.getPaymentRequests().catch(() => []),
        ]);
        if (s) setPlatformStats(s);
        setTenants(tn);
        setPaymentRequests(pr);
      } catch {
        toast({ title: isBn ? "রিপোর্ট লোড ব্যর্থ" : "Failed to load reports", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [isBn, toast]);

  const planDist = useMemo(() => {
    const map: Record<string, number> = {};
    tenants.forEach((t) => {
      const plan = t.subscriptionPlan || "free";
      map[plan] = (map[plan] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: PLAN_COLORS[name] || "#64748b",
    }));
  }, [tenants]);

  const revenueByPlan = useMemo(() => {
    const map: Record<string, { revenue: number; tenants: number }> = {};
    tenants.forEach((t) => {
      const plan = t.subscriptionPlan || "free";
      if (!map[plan]) map[plan] = { revenue: 0, tenants: 0 };
      map[plan].tenants += 1;
      if (["active", "trial"].includes(t.subscriptionStatus || "")) {
        map[plan].revenue += planMonthlyPrice(plan);
      }
    });
    return Object.entries(map).map(([plan, data]) => ({
      plan: plan.charAt(0).toUpperCase() + plan.slice(1),
      revenue: data.revenue,
      tenants: data.tenants,
    }));
  }, [tenants]);

  const tenantGrowth = useMemo(() => {
    const months = period === "3m" ? 3 : period === "12m" ? 12 : 6;
    const buckets: Array<{ month: string; newTenants: number; totalTenants: number; churned: number }> = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("en", { month: "short" });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const newTenants = tenants.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= monthStart && created <= monthEnd;
      }).length;
      const totalTenants = tenants.filter((t) => new Date(t.createdAt) <= monthEnd).length;
      const churned = tenants.filter((t) => {
        if (!["expired", "cancelled", "suspended"].includes(t.subscriptionStatus || "")) return false;
        const updated = t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt);
        return updated >= monthStart && updated <= monthEnd;
      }).length;
      buckets.push({ month: key, newTenants, totalTenants, churned });
    }
    return buckets;
  }, [tenants, period]);

  const overduePayments = useMemo(() => {
    const today = Date.now();
    return tenants
      .filter((t) => ["expired", "overdue", "suspended"].includes(t.subscriptionStatus || ""))
      .map((t) => {
        const dueDate = t.subscriptionExpiry || t.createdAt;
        const dueMs = new Date(dueDate).getTime();
        const daysPastDue = Math.max(0, Math.floor((today - dueMs) / 86400000));
        return {
          tenantName: t.name,
          plan: (t.subscriptionPlan || "free").charAt(0).toUpperCase() + (t.subscriptionPlan || "free").slice(1),
          amount: planMonthlyPrice(t.subscriptionPlan),
          dueDate: dueDate.slice(0, 10),
          daysPastDue,
        };
      })
      .sort((a, b) => b.daysPastDue - a.daysPastDue)
      .slice(0, 10);
  }, [tenants]);

  const topTenants = useMemo(() =>
    [...tenants]
      .sort((a, b) => (b._count?.bookings || 0) - (a._count?.bookings || 0))
      .slice(0, 5)
      .map((t) => ({
        name: t.name,
        plan: (t.subscriptionPlan || "free").charAt(0).toUpperCase() + (t.subscriptionPlan || "free").slice(1),
        mrr: planMonthlyPrice(t.subscriptionPlan),
        users: t._count?.users || t.users?.length || 0,
        bookings: t._count?.bookings || 0,
      })),
  [tenants]);

  const mrrData = useMemo(() =>
    tenantGrowth.map((row) => ({
      month: row.month,
      mrr: tenants
        .filter((t) => ["active", "trial"].includes(t.subscriptionStatus || ""))
        .reduce((sum, t) => sum + planMonthlyPrice(t.subscriptionPlan), 0),
      arr: tenants
        .filter((t) => ["active", "trial"].includes(t.subscriptionStatus || ""))
        .reduce((sum, t) => sum + planMonthlyPrice(t.subscriptionPlan), 0) * 12,
    })),
  [tenantGrowth, tenants]);

  const collectedVsDue = useMemo(() =>
    tenantGrowth.map((row) => ({
      month: row.month,
      collected: paymentRequests
        .filter((p) => p.status === "approved")
        .reduce((sum, p) => sum + (p.amount || 0), 0),
      due: overduePayments.reduce((sum, p) => sum + p.amount, 0),
    })),
  [tenantGrowth, paymentRequests, overduePayments]);

  const text = {
    title: isBn ? "প্ল্যাটফর্ম রিপোর্ট" : "Platform Reports",
    subtitle: isBn ? "রাজস্ব, গ্রোথ, চার্ন এবং আর্থিক অ্যানালিটিক্স" : "Revenue, growth, churn, and financial analytics",
    last3: isBn ? "শেষ ৩ মাস" : "Last 3 Months",
    last6: isBn ? "শেষ ৬ মাস" : "Last 6 Months",
    last12: isBn ? "শেষ ১২ মাস" : "Last 12 Months",
    mrr: "MRR",
    arr: "ARR",
    totalAgencies: isBn ? "মোট এজেন্সি" : "Total Agencies",
    activeSubs: isBn ? "সক্রিয় সাবস্ক্রিপশন" : "Active Subs",
    totalUsers: isBn ? "মোট ব্যবহারকারী" : "Total Users",
    churnRate: isBn ? "চার্ন রেট" : "Churn Rate",
    overdue: isBn ? "বকেয়া" : "Overdue",
    revenue: isBn ? "রাজস্ব" : "Revenue",
    growth: isBn ? "এজেন্সি গ্রোথ" : "Agency Growth",
    plans: isBn ? "প্ল্যান অ্যানালিটিক্স" : "Plan Analytics",
    overdueChurn: isBn ? "বকেয়া ও চার্ন" : "Overdue & Churn",
    export: isBn ? "এক্সপোর্ট" : "Export",
    mrrTrend: isBn ? "এমআরআর ট্রেন্ড" : "MRR Trend",
    collectedVsDue: isBn ? "আদায় বনাম বকেয়া" : "Collected vs Due",
    collected: isBn ? "আদায়" : "Collected",
    due: isBn ? "বকেয়া" : "Due",
    revenueByPlan: isBn ? "প্ল্যানভিত্তিক রাজস্ব" : "Revenue by Plan",
    plan: isBn ? "প্ল্যান" : "Plan",
    agencies: isBn ? "এজেন্সি" : "Agencies",
    monthlyRevenue: isBn ? "মাসিক রাজস্ব" : "Monthly Revenue",
    percentMrr: isBn ? "এমআরআরের %" : "% of MRR",
    topAgencies: isBn ? "শীর্ষ এজেন্সি" : "Top Agencies",
    agency: isBn ? "এজেন্সি" : "Agency",
    users: isBn ? "ব্যবহারকারী" : "Users",
    bookings: isBn ? "বুকিং" : "Bookings",
    planDistribution: isBn ? "প্ল্যান বন্টন" : "Plan Distribution",
    planBreakdown: isBn ? "প্ল্যান বিভাজন" : "Plan Breakdown",
    overduePayments: isBn ? "বকেয়া পেমেন্ট" : "Overdue Payments",
    amount: isBn ? "পরিমাণ" : "Amount",
    dueDate: isBn ? "বকেয়া তারিখ" : "Due",
    daysLate: isBn ? "বিলম্বিত দিন" : "Days Late",
    monthlyChurn: isBn ? "মাসিক চার্ন" : "Monthly Churn",
    total: isBn ? "মোট" : "Total",
    newLabel: isBn ? "নতুন" : "New",
    churned: isBn ? "চার্নড" : "Churned",
  };

  const planLabel = (value: string) => {
    const key = String(value || "").toLowerCase();
    const map: Record<string, string> = {
      free: isBn ? "ফ্রি ট্রায়াল" : "Free Trial",
      trial: isBn ? "ফ্রি ট্রায়াল" : "Free Trial",
      basic: isBn ? "স্টার্টার" : "Starter",
      pro: isBn ? "প্রফেশনাল" : "Professional",
      business: isBn ? "বিজনেস" : "Business",
      enterprise: isBn ? "এন্টারপ্রাইজ" : "Enterprise",
    };
    return map[key] || value;
  };

  const stats = useMemo(() => {
    const estimatedMrr = tenants
      .filter((t) => ["active", "trial"].includes(t.subscriptionStatus || ""))
      .reduce((sum, t) => sum + planMonthlyPrice(t.subscriptionPlan), 0);
    const activeSubs = tenants.filter((t) => t.subscriptionStatus === "active").length;
    const totalOverdue = overduePayments.reduce((s, p) => s + p.amount, 0);
    const latestGrowth = tenantGrowth[tenantGrowth.length - 1];
    const prevGrowth = tenantGrowth[tenantGrowth.length - 2];
    const churnRate = latestGrowth && prevGrowth && prevGrowth.totalTenants > 0
      ? ((latestGrowth.churned / prevGrowth.totalTenants) * 100).toFixed(1)
      : "0.0";
    return {
      latestMrr: estimatedMrr,
      mrrGrowth: "0.0",
      totalTenants: platformStats?.totalTenants ?? tenants.length,
      churnRate,
      totalOverdue,
      totalUsers: platformStats?.totalUsers ?? tenants.reduce((s, t) => s + (t._count?.users || 0), 0),
      activeSubs,
    };
  }, [tenants, tenantGrowth, overduePayments, platformStats]);

  const handleExport = (reportName: string) => {
    let csv = "";
    if (reportName === "mrr") {
      csv = "Month,MRR,ARR\n" + mrrData.map((d) => `${d.month},${d.mrr},${d.arr}`).join("\n");
    } else if (reportName === "tenants") {
      csv = "Month,New,Total,Churned\n" + tenantGrowth.map((d) => `${d.month},${d.newTenants},${d.totalTenants},${d.churned}`).join("\n");
    } else if (reportName === "overdue") {
      csv = "Tenant,Plan,Amount,Due Date,Days Past Due\n" + overduePayments.map((d) => `${d.tenantName},${d.plan},${d.amount},${d.dueDate},${d.daysPastDue}`).join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `admin-${reportName}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {loading && (
          <p className="text-sm text-muted-foreground">{isBn ? "রিপোর্ট লোড হচ্ছে…" : "Loading live platform reports…"}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{text.title}</h1>
            <p className="text-muted-foreground">{text.subtitle}</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">{text.last3}</SelectItem>
              <SelectItem value="6m">{text.last6}</SelectItem>
              <SelectItem value="12m">{text.last12}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold">৳{stats.latestMrr.toLocaleString()}</p><p className="text-xs text-muted-foreground">{text.mrr}</p><p className="text-[10px] text-green-600 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />{stats.mrrGrowth}%</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><BarChart3 className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">৳{(stats.latestMrr * 12).toLocaleString()}</p><p className="text-xs text-muted-foreground">{text.arr}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Building2 className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{stats.totalTenants}</p><p className="text-xs text-muted-foreground">{text.totalAgencies}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Crown className="h-8 w-8 text-purple-500" /><div><p className="text-2xl font-bold">{stats.activeSubs}</p><p className="text-xs text-muted-foreground">{text.activeSubs}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-indigo-500" /><div><p className="text-2xl font-bold">{stats.totalUsers}</p><p className="text-xs text-muted-foreground">{text.totalUsers}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingDown className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">{stats.churnRate}%</p><p className="text-xs text-muted-foreground">{text.churnRate}</p></div></div></CardContent></Card>
          <Card className="border-red-300 dark:border-red-600"><CardContent className="pt-6"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">৳{stats.totalOverdue.toLocaleString()}</p><p className="text-xs text-muted-foreground">{text.overdue}</p></div></div></CardContent></Card>
        </div>

        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="revenue">{text.revenue}</TabsTrigger>
            <TabsTrigger value="growth">{text.growth}</TabsTrigger>
            <TabsTrigger value="plans">{text.plans}</TabsTrigger>
            <TabsTrigger value="overdue">{text.overdueChurn}</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="space-y-4">
            <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => handleExport("mrr")}><Download className="mr-1 h-4 w-4" /> {text.export}</Button></div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">{text.mrrTrend}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={mrrData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `৳${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [`৳${v.toLocaleString()}`, text.mrr]} />
                      <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">{text.collectedVsDue}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={collectedVsDue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `৳${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                      <Bar dataKey="collected" fill="#10b981" radius={[4,4,0,0]} name={text.collected} />
                      <Bar dataKey="due" fill="#f59e0b" radius={[4,4,0,0]} name={text.due} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">{text.revenueByPlan}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{text.plan}</TableHead><TableHead className="text-right">{text.agencies}</TableHead><TableHead className="text-right">{text.monthlyRevenue}</TableHead><TableHead className="text-right">{text.percentMrr}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {revenueByPlan.map((r) => (
                      <TableRow key={r.plan}>
                        <TableCell><Badge variant="secondary" className="capitalize">{planLabel(r.plan)}</Badge></TableCell>
                        <TableCell className="text-right">{r.tenants}</TableCell>
                        <TableCell className="text-right font-semibold">৳{r.revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{stats.latestMrr > 0 ? ((r.revenue/stats.latestMrr)*100).toFixed(1) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="growth" className="space-y-4">
            <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => handleExport("tenants")}><Download className="mr-1 h-4 w-4" /> {text.export}</Button></div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">{text.growth}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={tenantGrowth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="totalTenants" stroke="hsl(var(--primary))" strokeWidth={2} name={text.total} />
                      <Line type="monotone" dataKey="newTenants" stroke="#10b981" strokeWidth={2} name={text.newLabel} />
                      <Line type="monotone" dataKey="churned" stroke="#ef4444" strokeWidth={2} name={text.churned} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">{text.topAgencies}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>{text.agency}</TableHead><TableHead>{text.plan}</TableHead><TableHead className="text-right">{text.users}</TableHead><TableHead className="text-right">{text.bookings}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {topTenants.map((t) => (
                        <TableRow key={t.name}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{planLabel(t.plan)}</Badge></TableCell>
                          <TableCell className="text-right">{t.users}</TableCell>
                          <TableCell className="text-right">{t.bookings}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">{text.planDistribution}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={planDist} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${planLabel(String(name))} ${(percent*100).toFixed(0)}%`}>
                        {planDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(_v, _n, item: any) => [`${item?.payload?.value}`, planLabel(item?.payload?.name)]} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">{text.planBreakdown}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {planDist.map((p) => {
                      const total = planDist.reduce((s, d) => s + d.value, 0);
                      const pct = Math.round((p.value / total) * 100);
                      return (
                        <div key={p.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{planLabel(p.name)}</span>
                            <span className="text-muted-foreground">{isBn ? `${p.value} এজেন্সি (${pct}%)` : `${p.value} agencies (${pct}%)`}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="overdue" className="space-y-4">
            <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => handleExport("overdue")}><Download className="mr-1 h-4 w-4" /> {text.export}</Button></div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> {text.overduePayments}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>{text.agency}</TableHead><TableHead>{text.plan}</TableHead><TableHead className="text-right">{text.amount}</TableHead><TableHead>{text.dueDate}</TableHead><TableHead className="text-right">{text.daysLate}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {overduePayments.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{p.tenantName}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{planLabel(p.plan)}</Badge></TableCell>
                          <TableCell className="text-right font-semibold text-red-600">৳{p.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground">{p.dueDate}</TableCell>
                          <TableCell className="text-right"><Badge variant="destructive">{isBn ? `${p.daysPastDue} দিন` : `${p.daysPastDue}d`}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">{text.monthlyChurn}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={tenantGrowth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="churned" fill="#ef4444" radius={[4,4,0,0]} name={text.churned} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
