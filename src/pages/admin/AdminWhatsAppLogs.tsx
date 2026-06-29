import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, Send, Loader2, Search, CheckCircle2, XCircle, Clock, RefreshCw, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { whatsappLogApi, type WhatsAppLog, type WhatsAppLogFilters } from "@/lib/whatsappLogApi";

const statusIcon = (s: string) => {
  if (s === "sent") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (s === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};

const statusBadge = (s: string) => {
  if (s === "sent") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1"><CheckCircle2 className="h-3 w-3" />Sent</Badge>;
  if (s === "failed") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
};

const AdminWhatsAppLogs = () => {
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [filters, setFilters] = useState<WhatsAppLogFilters>({ page: 1, limit: 20 });
  const [searchPhone, setSearchPhone] = useState("");
  const [sendForm, setSendForm] = useState({ phone: "", message: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit || 20)));

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsappLogApi.list(filters);
      setLogs(res.logs);
      setTotal(res.total);
      setStats(res.stats);
    } catch (err: any) {
      toast({ title: "Failed to load logs", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearch = () => setFilters((f) => ({ ...f, page: 1, phone: searchPhone || undefined }));

  const handleSend = async () => {
    if (!sendForm.phone || !sendForm.message) {
      toast({ title: "Missing fields", description: "Phone and message are required.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const result = await whatsappLogApi.send(sendForm.phone, sendForm.message);
      toast({ title: result.success ? "WhatsApp sent!" : "Send failed", description: result.success ? `Message ID: ${result.messageId}` : result.error, variant: result.success ? "default" : "destructive" });
      setSendOpen(false);
      setSendForm({ phone: "", message: "" });
      fetchLogs();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <MessageCircle className="h-7 w-7 text-green-500" /> WhatsApp Logs
            </h1>
            <p className="text-muted-foreground">History of all WhatsApp notifications sent from the system</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setSendOpen(true)}>
              <Send className="mr-2 h-4 w-4" /> Send WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Sent", value: stats.total, icon: BarChart3, color: "text-primary" },
            { label: "Delivered", value: stats.sent, icon: CheckCircle2, color: "text-green-600" },
            { label: "Failed", value: stats.failed, icon: XCircle, color: "text-destructive" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-muted-foreground" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full bg-muted p-2 ${color}`}><Icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <Label className="mb-1 block text-xs">Search by phone</Label>
                <div className="flex gap-1">
                  <Input
                    placeholder="e.g. 8801XXXXXXXXX"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button size="icon" variant="outline" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="min-w-[140px]">
                <Label className="mb-1 block text-xs">Status</Label>
                <Select value={filters.status || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, page: 1, status: v === "all" ? undefined : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(filters.phone || filters.status) && (
                <Button variant="ghost" size="sm" onClick={() => { setSearchPhone(""); setFilters({ page: 1, limit: 20 }); }}>
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading logs…
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <MessageCircle className="h-10 w-10 opacity-30" />
                <p className="font-medium">No WhatsApp logs found</p>
                <p className="text-sm">Notifications sent via WhatsApp will appear here.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <>
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        >
                          <TableCell className="text-center">{statusIcon(log.status)}</TableCell>
                          <TableCell className="font-mono text-sm">{log.phone}</TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="truncate text-sm">{log.message}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{log.provider}</Badge>
                          </TableCell>
                          <TableCell>
                            {log.templateType ? <Badge variant="secondary" className="text-xs">{log.templateType}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>{statusBadge(log.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {log.sentAt ? new Date(log.sentAt).toLocaleString() : new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                        {expandedId === log.id && (
                          <TableRow key={`${log.id}-expanded`} className="bg-muted/30">
                            <TableCell colSpan={7} className="px-6 py-3">
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Full message:</span> {log.message}</p>
                                {log.providerMessageId && <p><span className="font-medium">Message ID:</span> <span className="font-mono text-xs">{log.providerMessageId}</span></p>}
                                {log.errorMessage && <p className="text-destructive"><span className="font-medium">Error:</span> {log.errorMessage}</p>}
                                <p><span className="font-medium">Created:</span> {new Date(log.createdAt).toLocaleString()}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                  <span>Page {filters.page} of {totalPages} · {total} total logs</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={(filters.page || 1) <= 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={(filters.page || 1) >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={(o) => { setSendOpen(o); if (!o) setSendForm({ phone: "", message: "" }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp Message</DialogTitle>
            <DialogDescription>Send a direct WhatsApp message to any number. It will be logged automatically.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Phone number *</Label>
              <Input value={sendForm.phone} onChange={(e) => setSendForm({ ...sendForm, phone: e.target.value })} placeholder="+8801XXXXXXXXX" />
            </div>
            <div className="grid gap-2">
              <Label>Message *</Label>
              <Textarea value={sendForm.message} onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })} placeholder="Type your message…" rows={4} />
              <p className="text-xs text-muted-foreground text-right">{sendForm.message.length} characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : <><Send className="mr-2 h-4 w-4" /> Send</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWhatsAppLogs;
