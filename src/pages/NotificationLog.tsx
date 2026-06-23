import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search, Bell, Download, Eye, MessageSquare,
  CheckCircle, XCircle, Clock, Settings, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  automationApi,
  type AutomationDelivery,
  type AutomationEventType,
  type AutomationLogStats,
  type DeliveryStatus,
} from "@/lib/automationApi";

const STATUS_META: Record<DeliveryStatus, { icon: typeof CheckCircle; className: string }> = {
  pending: { icon: Clock, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  sent: { icon: CheckCircle, className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  failed: { icon: XCircle, className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const EVENT_KEYS: AutomationEventType[] = ["lead_created", "booking_created", "payment_received", "quotation_sent"];

const EVENT_LABELS: Record<AutomationEventType, string> = {
  lead_created: "Lead Created",
  booking_created: "Booking Created",
  payment_received: "Payment Received",
  quotation_sent: "Quotation Sent",
};

const NotificationLog = () => {
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<AutomationDelivery[]>([]);
  const [stats, setStats] = useState<AutomationLogStats>({ total: 0, sent: 0, failed: 0, pending: 0, bySms: 0, byInApp: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [selectedDelivery, setSelectedDelivery] = useState<AutomationDelivery | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [automationEvents, setAutomationEvents] = useState<Array<{ eventType: AutomationEventType; label: string; sms: boolean; inApp: boolean }>>([]);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const { toast } = useToast();

  const eventLabel = (ev: AutomationEventType) =>
    t(`notificationLog.events.${ev}`, { defaultValue: EVENT_LABELS[ev] });

  const channelLabel = (channel: string) =>
    channel === "in_app"
      ? t("notificationLog.channels.inApp", { defaultValue: "In-app" })
      : t("notificationLog.channels.sms", { defaultValue: "SMS" });

  const statusLabel = (s: DeliveryStatus) => t(`notificationLog.status.${s}`, { defaultValue: s });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        automationApi.getLogs({
          search: search || undefined,
          status: statusFilter === "all" ? undefined : (statusFilter as DeliveryStatus),
          channel: channelFilter === "all" ? undefined : (channelFilter as "sms" | "in_app"),
          eventType: eventFilter === "all" ? undefined : (eventFilter as AutomationEventType),
          limit: 100,
        }),
        automationApi.getLogStats(),
      ]);
      setDeliveries(logsRes.items);
      setStats(statsRes);
    } catch {
      // silent — empty state
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, channelFilter, eventFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadAutomationConfig = useCallback(async () => {
    try {
      const data = await automationApi.getAutomation();
      setAutomationEvents(data.events);
      setSmsEnabled(data.settings.smsEnabled);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (configOpen) loadAutomationConfig();
  }, [configOpen, loadAutomationConfig]);

  const openDetail = async (row: AutomationDelivery) => {
    try {
      const full = await automationApi.getLog(row.id);
      setSelectedDelivery(full);
      setDetailOpen(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load details";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleSaveConfig = async () => {
    try {
      await automationApi.updateAutomation({
        settings: { smsEnabled },
        events: automationEvents.map((e) => ({
          eventType: e.eventType,
          sms: e.sms,
          inApp: e.inApp,
        })),
      });
      setConfigOpen(false);
      toast({ title: t("notificationLog.config.saved") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExport = () => {
    const headers = ["Date", "Event", "Channel", "Recipient", "Name", "Status", "Message", "Attempts", "Error"];
    const rows = deliveries.map((d) => [
      d.createdAt,
      eventLabel(d.eventType),
      d.channel,
      d.recipient,
      d.recipientName || "",
      d.status,
      d.messagePreview || d.message || "",
      d.attempts,
      d.errorMessage || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notification-log.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("notificationLog.title")}</h1>
            <p className="text-muted-foreground">{t("notificationLog.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className="mr-1 h-4 w-4" /> {t("notificationLog.refresh", { defaultValue: "Refresh" })}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings className="mr-1 h-4 w-4" /> {t("notificationLog.configure")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> {t("notificationLog.export")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Bell className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">{t("notificationLog.stats.total")}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{stats.sent}</p><p className="text-xs text-muted-foreground">{t("notificationLog.stats.sent")}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><XCircle className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">{stats.failed}</p><p className="text-xs text-muted-foreground">{t("notificationLog.stats.failed")}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">{t("notificationLog.stats.pending")}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><MessageSquare className="h-8 w-8 text-pink-500" /><div><p className="text-2xl font-bold">{stats.bySms}</p><p className="text-xs text-muted-foreground">{t("notificationLog.stats.sms")}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Bell className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{stats.byInApp}</p><p className="text-xs text-muted-foreground">{t("notificationLog.stats.inApp", { defaultValue: "In-app" })}</p></div></div></CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("notificationLog.filters.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("notificationLog.filters.event")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("notificationLog.filters.allEvents")}</SelectItem>
              {EVENT_KEYS.map((k) => <SelectItem key={k} value={k}>{eventLabel(k)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder={t("notificationLog.filters.channel")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("notificationLog.filters.allChannels")}</SelectItem>
              <SelectItem value="sms">{t("notificationLog.channels.sms")}</SelectItem>
              <SelectItem value="in_app">{t("notificationLog.channels.inApp", { defaultValue: "In-app" })}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder={t("notificationLog.filters.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("notificationLog.filters.allStatus")}</SelectItem>
              <SelectItem value="sent">{t("notificationLog.status.sent")}</SelectItem>
              <SelectItem value="failed">{t("notificationLog.status.failed")}</SelectItem>
              <SelectItem value="pending">{t("notificationLog.status.pending")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("notificationLog.table.title")} ({deliveries.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("notificationLog.table.event")}</TableHead>
                  <TableHead>{t("notificationLog.table.channel")}</TableHead>
                  <TableHead>{t("notificationLog.table.recipient")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("notificationLog.table.message")}</TableHead>
                  <TableHead>{t("notificationLog.table.status")}</TableHead>
                  <TableHead>{t("notificationLog.table.attempts")}</TableHead>
                  <TableHead>{t("notificationLog.table.date")}</TableHead>
                  <TableHead className="w-[60px]">{t("notificationLog.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("notificationLog.loading", { defaultValue: "Loading…" })}</TableCell></TableRow>
                ) : deliveries.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("notificationLog.table.empty")}</TableCell></TableRow>
                ) : (
                  deliveries.map((d) => {
                    const meta = STATUS_META[d.status] || STATUS_META.pending;
                    const StatusIcon = meta.icon;
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{eventLabel(d.eventType)}</Badge>
                        </TableCell>
                        <TableCell>
                          {d.channel === "sms"
                            ? <MessageSquare className="h-4 w-4 text-pink-500" />
                            : <Bell className="h-4 w-4 text-blue-500" />}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{d.recipientName || "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{d.recipient}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[250px]">
                          <p className="text-xs text-muted-foreground truncate">{d.messagePreview || d.message}</p>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>
                            <StatusIcon className="h-3 w-3" />{statusLabel(d.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">{d.attempts}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(d)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("notificationLog.detail.title")}</DialogTitle></DialogHeader>
            {selectedDelivery && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <span className="text-muted-foreground">{t("notificationLog.detail.event")}</span>
                  <Badge variant="outline" className="w-fit">{eventLabel(selectedDelivery.eventType)}</Badge>
                  <span className="text-muted-foreground">{t("notificationLog.detail.channel")}</span>
                  <span>{channelLabel(selectedDelivery.channel)}</span>
                  <span className="text-muted-foreground">{t("notificationLog.detail.recipient")}</span>
                  <span className="font-medium">{selectedDelivery.recipientName || "—"}</span>
                  <span className="text-muted-foreground">{t("notificationLog.detail.address")}</span>
                  <span className="font-mono text-xs">{selectedDelivery.recipient}</span>
                  <span className="text-muted-foreground">{t("notificationLog.detail.status")}</span>
                  {(() => {
                    const m = STATUS_META[selectedDelivery.status] || STATUS_META.pending;
                    return (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium w-fit ${m.className}`}>
                        {statusLabel(selectedDelivery.status)}
                      </span>
                    );
                  })()}
                  <span className="text-muted-foreground">{t("notificationLog.detail.attempts")}</span>
                  <span>{selectedDelivery.attempts}</span>
                  <span className="text-muted-foreground">{t("notificationLog.detail.created")}</span>
                  <span>{new Date(selectedDelivery.createdAt).toLocaleString()}</span>
                  {selectedDelivery.sentAt && (
                    <>
                      <span className="text-muted-foreground">{t("notificationLog.detail.sentAt")}</span>
                      <span>{new Date(selectedDelivery.sentAt).toLocaleString()}</span>
                    </>
                  )}
                  {selectedDelivery.errorMessage && (
                    <>
                      <span className="text-muted-foreground">{t("notificationLog.detail.failureReason")}</span>
                      <span className="text-destructive text-xs">{selectedDelivery.errorMessage}</span>
                    </>
                  )}
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium mb-1">{t("notificationLog.detail.message")}</p>
                  <p className="text-sm">{selectedDelivery.message}</p>
                </div>
              </div>
            )}
            <DialogClose asChild><Button variant="outline" className="w-full">{t("notificationLog.detail.close")}</Button></DialogClose>
          </DialogContent>
        </Dialog>

        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("notificationLog.config.title")}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t("notificationLog.config.intro")}</p>
            <div className="flex items-center justify-between rounded-md border p-3 mb-2">
              <Label className="text-sm">{t("notificationLog.config.masterSms", { defaultValue: "Enable SMS automation" })}</Label>
              <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
            </div>
            <div className="space-y-4 py-2">
              {automationEvents.map((config, i) => (
                <div key={config.eventType} className="rounded-md border p-3 space-y-2">
                  <p className="text-sm font-medium">{config.label || eventLabel(config.eventType)}</p>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.sms}
                        onCheckedChange={(v) => {
                          const updated = [...automationEvents];
                          updated[i] = { ...updated[i], sms: v };
                          setAutomationEvents(updated);
                        }}
                      />
                      <Label className="text-xs">{t("notificationLog.config.sms")}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.inApp}
                        onCheckedChange={(v) => {
                          const updated = [...automationEvents];
                          updated[i] = { ...updated[i], inApp: v };
                          setAutomationEvents(updated);
                        }}
                      />
                      <Label className="text-xs">{t("notificationLog.config.inApp", { defaultValue: "In-app" })}</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleSaveConfig}>{t("notificationLog.config.save")}</Button>
            <DialogClose asChild><Button variant="outline" className="w-full">{t("notificationLog.config.cancel")}</Button></DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default NotificationLog;
