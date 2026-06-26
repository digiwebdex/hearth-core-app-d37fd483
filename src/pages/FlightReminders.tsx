import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Send, Plane } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let msg = res.statusText || "Request failed";
    try { const p = JSON.parse(raw) as { message?: string }; msg = p.message || msg; } catch { /* noop */ }
    throw new Error(msg);
  }
  return res.json();
}

interface ReminderBooking {
  id: string;
  title: string | null;
  destination: string | null;
  travelDateFrom: string;
  daysLeft: number;
  status: string;
  client: { name: string | null; phone: string | null; email: string | null };
  reminderSentToday: boolean;
}

const FlightReminders = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<ReminderBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState("7");
  const [sending, setSending] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ bookings: ReminderBooking[] }>(`/flight-reminders/upcoming?days=${days}`);
      setBookings(data.bookings ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("flightReminders.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  useEffect(() => { load(); }, [load]);

  const sendReminder = async (bookingId: string) => {
    setSending(bookingId);
    try {
      await apiFetch(`/flight-reminders/send/${bookingId}`, { method: "POST", body: JSON.stringify({}) });
      toast({ title: t("flightReminders.sent") });
      await load();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("flightReminders.sendFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(null);
    }
  };

  const runAll = async () => {
    setRunning(true);
    try {
      const result = await apiFetch<{ sent: number; skipped: number }>("/flight-reminders/run-now", { method: "POST", body: JSON.stringify({}) });
      toast({ title: t("flightReminders.runSuccess"), description: `Sent: ${result.sent}, Skipped: ${result.skipped}` });
      await load();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: String(err instanceof Error ? err.message : err) });
    } finally {
      setRunning(false);
    }
  };

  const canRunAll = user?.role === "super_admin" || user?.role === "tenant_owner";

  if (loading) return <DashboardLayout><LoadingState rows={6} /></DashboardLayout>;
  if (error) return <DashboardLayout><ErrorState message={error} onRetry={load} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="h-6 w-6" />
              {t("flightReminders.title")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{t("flightReminders.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 7, 14, 30].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {t("flightReminders.daysWindow", { days: d })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canRunAll && (
              <Button variant="outline" onClick={runAll} disabled={running}>
                <Bell className="h-4 w-4 mr-2" />
                {running ? t("flightReminders.running") : t("flightReminders.runAll")}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {bookings.length} upcoming departure{bookings.length !== 1 ? "s" : ""} in {days} days
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {bookings.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">{t("flightReminders.none")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("flightReminders.columns.client")}</TableHead>
                    <TableHead>{t("flightReminders.columns.destination")}</TableHead>
                    <TableHead>{t("flightReminders.columns.departure")}</TableHead>
                    <TableHead>{t("flightReminders.columns.daysLeft")}</TableHead>
                    <TableHead>{t("flightReminders.columns.status")}</TableHead>
                    <TableHead>{t("flightReminders.columns.reminderSent")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium">{b.client.name || "—"}</div>
                        {b.client.phone && (
                          <div className="text-xs text-muted-foreground">{b.client.phone}</div>
                        )}
                      </TableCell>
                      <TableCell>{b.destination || b.title || "—"}</TableCell>
                      <TableCell>{b.travelDateFrom?.slice(0, 10) || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={b.daysLeft <= 1 ? "destructive" : b.daysLeft <= 3 ? "secondary" : "outline"}>
                          {b.daysLeft}d
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{b.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.reminderSentToday ? "default" : "secondary"}>
                          {b.reminderSentToday
                            ? t("flightReminders.badge.sent")
                            : t("flightReminders.badge.pending")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendReminder(b.id)}
                          disabled={sending === b.id}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          {sending === b.id
                            ? t("flightReminders.sending")
                            : t("flightReminders.send")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FlightReminders;
