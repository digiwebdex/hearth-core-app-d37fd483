import { useState, useMemo } from "react";
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

const mrrData = [
  { month: "Oct", mrr: 68000, arr: 816000 }, { month: "Nov", mrr: 74000, arr: 888000 },
  { month: "Dec", mrr: 82000, arr: 984000 }, { month: "Jan", mrr: 78000, arr: 936000 },
  { month: "Feb", mrr: 89000, arr: 1068000 }, { month: "Mar", mrr: 95000, arr: 1140000 },
];

const tenantGrowth = [
  { month: "Oct", newTenants: 12, totalTenants: 145, churned: 2 },
  { month: "Nov", newTenants: 18, totalTenants: 161, churned: 3 },
  { month: "Dec", newTenants: 22, totalTenants: 180, churned: 4 },
  { month: "Jan", newTenants: 15, totalTenants: 191, churned: 5 },
  { month: "Feb", newTenants: 20, totalTenants: 206, churned: 3 },
  { month: "Mar", newTenants: 28, totalTenants: 231, churned: 4 },
];

const planDist = [
  { name: "Free", value: 65, color: "#94a3b8" }, { name: "Basic", value: 48, color: "#3b82f6" },
  { name: "Pro", value: 52, color: "#8b5cf6" }, { name: "Business", value: 25, color: "#10b981" },
  { name: "Enterprise", value: 5, color: "#f59e0b" },
];

const revenueByPlan = [
  { plan: "Free", revenue: 0, tenants: 65 }, { plan: "Basic", revenue: 38400, tenants: 48 },
  { plan: "Pro", revenue: 78000, tenants: 52 }, { plan: "Business", revenue: 75000, tenants: 25 },
  { plan: "Enterprise", revenue: 49500, tenants: 5 },
];

const overduePayments = [
  { tenantName: "Dream Trips", plan: "Pro", amount: 1500, dueDate: "2026-03-15", daysPastDue: 17 },
  { tenantName: "Sky Wings", plan: "Basic", amount: 800, dueDate: "2026-03-20", daysPastDue: 12 },
  { tenantName: "Royal Travels", plan: "Business", amount: 3000, dueDate: "2026-03-25", daysPastDue: 7 },
];

const collectedVsDue = [
  { month: "Oct", collected: 62000, due: 68000 }, { month: "Nov", collected: 70000, due: 74000 },
  { month: "Dec", collected: 78000, due: 82000 }, { month: "Jan", collected: 71000, due: 78000 },
  { month: "Feb", collected: 84000, due: 89000 }, { month: "Mar", collected: 88000, due: 95000 },
];

const topTenants = [
  { name: "Acme Travel", plan: "Business", mrr: 3000, users: 12, bookings: 145 },
  { name: "Globe Tours", plan: "Pro", plan_mrr: 1500, users: 8, bookings: 98 },
  { name: "Star Holidays", plan: "Business", mrr: 3000, users: 15, bookings: 210 },
  { name: "Royal Travels", plan: "Pro", mrr: 1500, users: 6, bookings: 67 },
  { name: "Dream Trips", plan: "Enterprise", mrr: 9900, users: 25, bookings: 320 },
];

const AdminReports = () => {
  const [period, setPeriod] = useState("6m");
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

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
    const map: Record<string, string> = {
      Free: isBn ? "ফ্রি" : "Free",
      Basic: isBn ? "বেসিক" : "Basic",
      Pro: isBn ? "প্রো" : "Pro",
      Business: isBn ? "বিজনেস" : "Business",
      Enterprise: isBn ? "এন্টারপ্রাইজ" : "Enterprise",
    };
    return map[value] || value;
  };

  const stats = useMemo(() => {
    const latestMrr = mrrData[mrrData.length - 1].mrr;
    const prevMrr = mrrData[mrrData.length - 2].mrr;
    const mrrGrowth = ((latestMrr - prevMrr) / prevMrr * 100).toFixed(1);
    const totalTenants = tenantGrowth[tenantGrowth.length - 1].totalTenants;
    const churnRate = ((tenantGrowth[tenantGrowth.length - 1].churned / tenantGrowth[tenantGrowth.length - 2].totalTenants) * 100).toFixed(1);
    const totalOverdue = overduePayments.reduce((s, p) => s + p.amount, 0);
    return { latestMrr, mrrGrowth, totalTenants, churnRate, totalOverdue, totalUsers: 847, activeSubs: 130 };
  }, []);

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
