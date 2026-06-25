import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingUp, Users, MapPin, BarChart2 } from "lucide-react";
import { analyticsApi, type SalesAnalytics } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function fmt(n: number) { return `৳ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }
function pct(n: number) { return `${n.toFixed(1)}%`; }

export default function SalesAnalyticsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await analyticsApi.getSalesAnalytics({ from, to });
      setData(d);
    } catch { toast({ title: "Failed to load analytics", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold">Sales Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">Destination trends, agent performance and conversion funnel</p>
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="w-36 h-8 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="w-36 h-8 text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Apply
            </Button>
          </div>
        </div>

        {loading && !data && (
          <div className="grid md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Bookings</p>
                <p className="text-2xl font-bold mt-1">{data.summary.totalBookings.toLocaleString()}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
                <p className="text-2xl font-bold mt-1">{fmt(data.summary.totalRevenue)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Profit</p>
                <p className="text-2xl font-bold mt-1 text-green-700">{fmt(data.summary.totalProfit)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Booking Value</p>
                <p className="text-2xl font-bold mt-1">{fmt(data.summary.avgBookingValue)}</p>
              </CardContent></Card>
            </div>

            {/* Conversion Funnel */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" />Conversion Funnel</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: "Leads", value: data.conversionFunnel.leads },
                    { label: "Leads Converted", value: data.conversionFunnel.leadsConverted, rate: pct(data.conversionFunnel.leadConversionRate) },
                    { label: "Quotations", value: data.conversionFunnel.quotations },
                    { label: "Quotes Accepted", value: data.conversionFunnel.quotationsAccepted, rate: pct(data.conversionFunnel.quotationConversionRate) },
                    { label: "Bookings", value: data.conversionFunnel.bookings },
                    { label: "Confirmed", value: data.conversionFunnel.bookingsConfirmed },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="rounded-lg border p-3 min-w-[110px] text-center">
                        <p className="text-xl font-bold">{item.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                        {item.rate && <p className="text-xs font-semibold text-primary mt-1">{item.rate}</p>}
                      </div>
                      {i < 5 && <span className="text-muted-foreground text-lg">→</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Destinations */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" />Top Destinations</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {data.topDestinations.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No destination data in range.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Destination</th>
                          <th className="text-right px-4 py-2 font-medium">Bookings</th>
                          <th className="text-right px-4 py-2 font-medium">Revenue</th>
                          <th className="text-right px-4 py-2 font-medium">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topDestinations.map((d, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-4 py-2.5 font-medium">{d.destination || "Unspecified"}</td>
                            <td className="px-4 py-2.5 text-right">{d.bookings}</td>
                            <td className="px-4 py-2.5 text-right">{fmt(d.revenue)}</td>
                            <td className="px-4 py-2.5 text-right text-green-700">{fmt(d.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* Agent Performance */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Agent Performance</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {data.agentPerformance.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No agent data in range.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Agent</th>
                          <th className="text-right px-4 py-2 font-medium">Bookings</th>
                          <th className="text-right px-4 py-2 font-medium">Revenue</th>
                          <th className="text-right px-4 py-2 font-medium">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.agentPerformance.map((a) => (
                          <tr key={a.agentId} className="border-b last:border-0">
                            <td className="px-4 py-2.5 font-medium">{a.agentName}</td>
                            <td className="px-4 py-2.5 text-right">{a.bookings}</td>
                            <td className="px-4 py-2.5 text-right">{fmt(a.revenue)}</td>
                            <td className="px-4 py-2.5 text-right text-green-700">{fmt(a.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Trend + Service Breakdown */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart2 className="w-4 h-4" />Monthly Trend</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Month</th>
                        <th className="text-right px-4 py-2 font-medium">Bookings</th>
                        <th className="text-right px-4 py-2 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthlyTrend.map((m, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2.5">{m.month}</td>
                          <td className="px-4 py-2.5 text-right">{m.bookings}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(m.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Service Breakdown</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Service</th>
                        <th className="text-right px-4 py-2 font-medium">Bookings</th>
                        <th className="text-right px-4 py-2 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.serviceBreakdown.map((s, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2.5 capitalize">{s.serviceType}</td>
                          <td className="px-4 py-2.5 text-right">{s.bookings}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(s.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
