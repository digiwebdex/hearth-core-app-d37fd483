import { useCallback, useEffect, useState } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, Plane, AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
function authHeaders() {
  const token = localStorage.getItem("token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Request failed");
  return res.json();
}

type Departure = {
  id: string;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  destination: string | null;
  travelDateFrom: string;
  daysUntil: number;
  status: string;
  remindersSent: Record<string, string>;
};

function urgencyBadge(days: number) {
  if (days === 0) return <Badge variant="destructive">Today</Badge>;
  if (days === 1) return <Badge variant="destructive">Tomorrow</Badge>;
  if (days <= 3) return <Badge className="bg-orange-100 text-orange-700 border-orange-200">{days} days</Badge>;
  if (days <= 7) return <Badge variant="outline" className="text-yellow-700 border-yellow-300">{days} days</Badge>;
  return <Badge variant="secondary">{days} days</Badge>;
}

function ReminderDots({ sent }: { sent: Record<string, string> }) {
  return (
    <div className="flex items-center gap-1.5">
      {[3, 2, 1].map(d => (
        <div key={d} title={sent[d] ? `${d}d reminder sent ${format(new Date(sent[d]), "PP")}` : `${d}d reminder not sent`}
          className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border ${
            sent[d] ? "bg-green-100 border-green-400 text-green-700" : "bg-muted border-border text-muted-foreground"
          }`}>
          {d}d
        </div>
      ))}
      {sent["manual"] && (
        <div title="Manual reminder sent" className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border bg-blue-100 border-blue-400 text-blue-700">M</div>
      )}
    </div>
  );
}

export default function FlightReminders() {
  const { toast } = useToast();
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [runningCron, setRunningCron] = useState(false);
  const [window, setWindow] = useState("30");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/flight-reminders/upcoming?days=${window}`);
      setDepartures(data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load departures", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [window, toast]);

  useEffect(() => { load(); }, [load]);

  const sendReminder = async (dep: Departure) => {
    setSending(dep.id);
    try {
      const result = await apiFetch(`/flight-reminders/send/${dep.id}`, { method: "POST" });
      toast({ title: `Reminder sent to ${result.clientName}`, description: `Departure in ${result.daysLeft} day(s) on ${result.travelDate}` });
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to send", description: err.message });
    } finally {
      setSending(null);
    }
  };

  const runCron = async () => {
    setRunningCron(true);
    try {
      const result = await apiFetch("/flight-reminders/run-now", { method: "POST" });
      toast({ title: "Reminder run complete", description: `Sent: ${result.sent}, Skipped: ${result.skipped}` });
      await load();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message });
    } finally {
      setRunningCron(false);
    }
  };

  const today = departures.filter(d => d.daysUntil === 0).length;
  const tomorrow = departures.filter(d => d.daysUntil === 1).length;
  const thisWeek = departures.filter(d => d.daysUntil <= 7 && d.daysUntil > 1).length;
  const noContact = departures.filter(d => !d.clientPhone && !d.clientEmail).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-7 w-7" /> Flight Reminders
            </h1>
            <p className="text-muted-foreground mt-1">
              Auto-reminders sent at 3, 2, and 1 days before departure. Manual send available anytime.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={window} onValueChange={setWindow}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Next 7 days</SelectItem>
                <SelectItem value="14">Next 14 days</SelectItem>
                <SelectItem value="30">Next 30 days</SelectItem>
                <SelectItem value="60">Next 60 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={runCron} disabled={runningCron}>
              <Send className="h-4 w-4 mr-1.5" />
              {runningCron ? "Running…" : "Run Auto-Send"}
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Departing today", value: today, icon: AlertCircle, color: "text-destructive" },
            { label: "Tomorrow", value: tomorrow, icon: Clock, color: "text-orange-500" },
            { label: "This week", value: thisWeek, icon: Plane, color: "text-yellow-600" },
            { label: "No contact info", value: noContact, icon: AlertCircle, color: "text-muted-foreground" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-8 w-8 ${color} shrink-0`} />
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Auto-reminder info */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-medium">Automatic reminders are active</p>
                <p>The system automatically sends SMS/WhatsApp/email reminders at <strong>3 days</strong>, <strong>2 days</strong>, and <strong>1 day</strong> before each departure via the daily cron job. The dots below show which reminders have been sent for each booking.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Departures table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming Departures ({departures.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Booking / Destination</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Days left</TableHead>
                  <TableHead>Reminders sent</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : departures.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No upcoming departures in this window</TableCell></TableRow>
                ) : departures.map(dep => (
                  <TableRow key={dep.id} className={dep.daysUntil <= 1 ? "bg-red-50/40 dark:bg-red-950/10" : ""}>
                    <TableCell className="font-medium">{dep.clientName || "—"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{dep.title}</div>
                      {dep.destination && <div className="text-xs text-muted-foreground">{dep.destination}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(parseISO(dep.travelDateFrom), "PP")}
                    </TableCell>
                    <TableCell>{urgencyBadge(dep.daysUntil)}</TableCell>
                    <TableCell><ReminderDots sent={dep.remindersSent} /></TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        {dep.clientPhone && <div className="text-muted-foreground">{dep.clientPhone}</div>}
                        {dep.clientEmail && <div className="text-muted-foreground truncate max-w-[140px]">{dep.clientEmail}</div>}
                        {!dep.clientPhone && !dep.clientEmail && (
                          <span className="text-destructive text-xs">No contact</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="outline"
                        disabled={sending === dep.id || (!dep.clientPhone && !dep.clientEmail)}
                        onClick={() => sendReminder(dep)}
                        title={!dep.clientPhone && !dep.clientEmail ? "No contact info" : "Send reminder now"}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        {sending === dep.id ? "Sending…" : "Send"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
