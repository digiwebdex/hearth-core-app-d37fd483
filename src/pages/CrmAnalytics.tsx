import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Target, Repeat, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { crmAnalyticsApi, type CrmAnalytics } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", quoted: "Quoted", won: "Won", lost: "Lost" };
const fmt = (n: number) => n.toLocaleString();

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({ label, value, max, right }: { label: string; value: number; max: number; right?: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="capitalize truncate">{label}</span>
        <span className="text-muted-foreground shrink-0 ml-2">{right ?? value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${w}%` }} /></div>
    </div>
  );
}

export default function CrmAnalytics() {
  const { toast } = useToast();
  const [data, setData] = useState<CrmAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await crmAnalyticsApi.get(from || undefined, to || undefined)); }
    catch (err: unknown) { toast({ title: "Failed to load analytics", description: err instanceof Error ? err.message : String(err), variant: "destructive" }); }
    finally { setLoading(false); }
  }, [from, to, toast]);
  useEffect(() => { load(); }, [load]);

  const funnelMax = data ? Math.max(1, ...data.leads.funnel.map((f) => f.count)) : 1;
  const sourceMax = data ? Math.max(1, ...data.bySource.map((s) => s.total)) : 1;
  const assigneeMax = data ? Math.max(1, ...data.byAssignee.map((a) => a.total)) : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">CRM analytics</h1>
            </div>
            <p className="text-muted-foreground">Lead conversion, source ROI, team performance and customer retention.</p>
          </div>
          <div className="flex items-end gap-2">
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" /></div>
            {(from || to) && <Button variant="outline" size="sm" className="h-9" onClick={() => { setFrom(""); setTo(""); }}>Clear</Button>}
          </div>
        </div>

        {loading || !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Total leads" value={fmt(data.leads.total)} />
              <Metric label="Won" value={fmt(data.leads.won)} sub={`${data.leads.conversionRate}% conversion`} />
              <Metric label="Lost" value={fmt(data.leads.lost)} sub={`${data.leads.lostRate}% lost`} />
              <Metric label="Repeat customers" value={`${data.retention.repeatRate}%`} sub={`${fmt(data.retention.repeatCustomers)} of ${fmt(data.retention.totalCustomers)}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Lead funnel</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.leads.funnel.map((f) => <Bar key={f.status} label={STATUS_LABEL[f.status] || f.status} value={f.count} max={funnelMax} right={`${f.count} · ${f.pct}%`} />)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Lead source ROI</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.bySource.length === 0 ? <p className="text-sm text-muted-foreground">No leads in range.</p> :
                    data.bySource.map((s) => <Bar key={s.source} label={s.source} value={s.total} max={sourceMax} right={`${s.total} · ${s.won} won · ${s.conversion}%`} />)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Executive performance</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.byAssignee.map((a) => <Bar key={a.userId} label={a.name} value={a.total} max={assigneeMax} right={`${a.won} won / ${a.total} · ${a.conversion}%`} />)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" /> Service &amp; engagement</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Metric label="Complaints" value={fmt(data.complaints.total)} sub={`${data.complaints.open} open · ${data.complaints.resolved} resolved`} />
                  <Metric label="Avg. satisfaction" value={data.complaints.avgRating != null ? `${data.complaints.avgRating}★` : "—"} />
                  <Metric label="Campaigns" value={fmt(data.campaigns.total)} />
                  <Metric label="Messages sent" value={fmt(data.campaigns.messagesSent)} />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
