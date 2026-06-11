import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MessageSquare, Send, Loader2, Search, CheckCircle2, XCircle, Clock,
  RefreshCw, Phone, BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { smsApi, type SmsLog, type SmsLogStatus, type SmsLogFilters } from "@/lib/smsApi";

const AdminSmsLogs = () => {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [filters, setFilters] = useState<SmsLogFilters>({ page: 1, limit: 20 });
  const [searchPhone, setSearchPhone] = useState("");
  const [sendForm, setSendForm] = useState({ phone: "", message: "" });
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const text = {
    title: isBn ? "এসএমএস লগ" : "SMS Logs",
    subtitle: isBn ? "এসএমএস পাঠান এবং ডেলিভারি লগ দেখুন" : "Send SMS messages and view delivery logs",
    refresh: isBn ? "রিফ্রেশ" : "Refresh",
    sendSms: isBn ? "এসএমএস পাঠান" : "Send SMS",
    totalSent: isBn ? "মোট পাঠানো" : "Total Sent",
    delivered: isBn ? "ডেলিভার হয়েছে" : "Delivered",
    failed: isBn ? "ব্যর্থ" : "Failed",
    pending: isBn ? "অপেক্ষমান" : "Pending",
    searchPhone: isBn ? "ফোন নম্বর দিয়ে খুঁজুন..." : "Search by phone...",
    allStatus: isBn ? "সব স্ট্যাটাস" : "All Status",
    search: isBn ? "খুঁজুন" : "Search",
    noLogs: isBn ? "কোনো এসএমএস লগ পাওয়া যায়নি" : "No SMS logs found",
    noLogsSub: isBn ? "এখানে লগ দেখতে আপনার প্রথম এসএমএস পাঠান।" : "Send your first SMS to see logs here.",
    phone: isBn ? "ফোন" : "Phone",
    message: isBn ? "বার্তা" : "Message",
    provider: isBn ? "প্রোভাইডার" : "Provider",
    status: isBn ? "স্ট্যাটাস" : "Status",
    error: isBn ? "ত্রুটি" : "Error",
    sentAt: isBn ? "পাঠানোর সময়" : "Sent At",
    page: isBn ? "পৃষ্ঠা" : "Page",
    of: isBn ? "/" : "of",
    totalLogs: isBn ? "মোট লগ" : "total logs",
    previous: isBn ? "পূর্ববর্তী" : "Previous",
    next: isBn ? "পরবর্তী" : "Next",
    dialogTitle: isBn ? "এসএমএস পাঠান" : "Send SMS",
    dialogDesc: isBn ? "একটি ফোন নম্বরে একক এসএমএস পাঠান।" : "Send a single SMS message to a phone number.",
    phoneNumber: isBn ? "ফোন নম্বর" : "Phone Number",
    includeCode: isBn ? "কান্ট্রি কোডসহ দিন (যেমন +880)" : "Include country code (e.g. +880)",
    typeMessage: isBn ? "আপনার বার্তা লিখুন..." : "Type your message...",
    characters: isBn ? "অক্ষর" : "characters",
    cancel: isBn ? "বাতিল" : "Cancel",
    send: isBn ? "পাঠান" : "Send",
    required: isBn ? "ফোন নম্বর এবং বার্তা আবশ্যক" : "Phone and message are required",
    sendSuccess: isBn ? "এসএমএস সফলভাবে পাঠানো হয়েছে" : "SMS sent successfully",
    sendFailed: isBn ? "এসএমএস পাঠানো ব্যর্থ হয়েছে" : "SMS failed",
    failedToSend: isBn ? "এসএমএস পাঠানো যায়নি" : "Failed to send SMS",
  };

  const STATUS_CONFIG: Record<SmsLogStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
    sent: { label: text.delivered, icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    failed: { label: text.failed, icon: XCircle, className: "bg-destructive/15 text-destructive" },
    pending: { label: text.pending, icon: Clock, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        smsApi.getLogs(filters),
        smsApi.getLogStats(),
      ]);
      setLogs(logsRes.logs);
      setTotal(logsRes.total);
      setStats(statsRes);
    } catch {
      const demoLogs: SmsLog[] = [
        { id: "1", phone: "+8801712345678", message: "Dear John, your tour booking (BK-001) is confirmed. Amount: 25000 BDT.", status: "sent", provider: "sslwireless", sentAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: "2", phone: "+8801898765432", message: "Dear Sarah, we received your payment of 15000 BDT for Invoice #INV-042.", status: "sent", provider: "sslwireless", sentAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: "3", phone: "+8801555000111", message: "Your verification code is 482913. Valid for 5 minutes.", status: "failed", provider: "bulksms", errorMessage: "Invalid phone number", sentAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: "4", phone: "+8801612340000", message: "Dear Ali, a payment of 8000 BDT for Invoice #INV-051 is due on 2025-04-15.", status: "pending", provider: "sslwireless", sentAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      ];
      setLogs(demoLogs);
      setTotal(demoLogs.length);
      setStats({ total: 4, sent: 2, failed: 1, pending: 1 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSend = async () => {
    if (!sendForm.phone.trim() || !sendForm.message.trim()) {
      toast({ title: text.required, variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await smsApi.send({ phone: sendForm.phone, message: sendForm.message });
      if (res.success) {
        toast({ title: text.sendSuccess });
      } else {
        toast({ title: text.sendFailed, description: res.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: text.failedToSend, description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
      setSendOpen(false);
      setSendForm({ phone: "", message: "" });
      fetchData();
    }
  };

  const handleSearch = () => {
    setFilters((f) => ({ ...f, phone: searchPhone || undefined, page: 1 }));
  };

  const totalPages = Math.ceil(total / (filters.limit || 20));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="h-8 w-8" /> {text.title}
            </h1>
            <p className="text-muted-foreground">{text.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchData} title={text.refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setSendOpen(true)}>
              <Send className="mr-2 h-4 w-4" /> {text.sendSms}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[
            { label: text.totalSent, value: stats.total, icon: BarChart3, color: "text-primary" },
            { label: text.delivered, value: stats.sent, icon: CheckCircle2, color: "text-emerald-500" },
            { label: text.failed, value: stats.failed, icon: XCircle, color: "text-destructive" },
            { label: text.pending, value: stats.pending, icon: Clock, color: "text-amber-500" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value}</p>
                  </div>
                  <s.icon className={`h-8 w-8 ${s.color} opacity-70`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={text.searchPhone}
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.status || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? undefined : v as SmsLogStatus, page: 1 }))}
          >
            <SelectTrigger className="w-[150px]"><SelectValue placeholder={text.status} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{text.allStatus}</SelectItem>
              <SelectItem value="sent">{text.delivered}</SelectItem>
              <SelectItem value="failed">{text.failed}</SelectItem>
              <SelectItem value="pending">{text.pending}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSearch}>
            <Search className="mr-2 h-4 w-4" /> {text.search}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{text.noLogs}</p>
                <p className="text-sm">{text.noLogsSub}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{text.phone}</TableHead>
                    <TableHead className="hidden md:table-cell">{text.message}</TableHead>
                    <TableHead>{text.provider}</TableHead>
                    <TableHead>{text.status}</TableHead>
                    <TableHead className="hidden lg:table-cell">{text.error}</TableHead>
                    <TableHead>{text.sentAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const cfg = STATUS_CONFIG[log.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">{log.phone}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-[280px]">
                          <p className="text-sm text-muted-foreground truncate">{log.messagePreview || log.message}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{log.provider}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`gap-1 ${cfg.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px]">
                          {log.errorMessage ? (
                            <p className="text-xs text-destructive truncate">{log.errorMessage}</p>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(log.sentAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isBn
                ? `পৃষ্ঠা ${filters.page} / ${totalPages} · মোট ${total} টি লগ`
                : `Page ${filters.page} of ${totalPages} · ${total} total logs`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                disabled={(filters.page || 1) <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}
              >
                {text.previous}
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={(filters.page || 1) >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
              >
                {text.next}
              </Button>
            </div>
          </div>
        )}

        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{text.dialogTitle}</DialogTitle>
              <DialogDescription>{text.dialogDesc}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{text.phoneNumber}</Label>
                <Input
                  placeholder="+8801XXXXXXXXX"
                  value={sendForm.phone}
                  onChange={(e) => setSendForm({ ...sendForm, phone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{text.includeCode}</p>
              </div>
              <div className="space-y-2">
                <Label>{text.message}</Label>
                <Textarea
                  rows={4}
                  placeholder={text.typeMessage}
                  value={sendForm.message}
                  onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{sendForm.message.length} {text.characters}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendOpen(false)}>{text.cancel}</Button>
              <Button onClick={handleSend} disabled={sending || !sendForm.phone || !sendForm.message}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {text.send}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSmsLogs;
