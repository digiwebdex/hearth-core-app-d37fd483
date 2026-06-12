import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Plus, Receipt, CreditCard, Eye, Mail, Wallet, Search, Download, Plane,
  DollarSign, AlertTriangle, Clock, CheckCircle2, XCircle, RefreshCcw,
  Upload, Trash2, ArrowLeft, FileText, RotateCcw, Ban, Send, TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { emailApi } from "@/lib/emailApi";
import PaymentGatewayDialog from "@/components/PaymentGatewayDialog";
import {
  invoiceApi, paymentApi, bookingApi, type Invoice, type Payment, type InvoiceStatus,
  type PaymentMethod, type InvoiceRefund, type InvoiceAuditEvent, type InvoiceInstallment, type Booking,
} from "@/lib/api";
import { InvoiceInstallmentsPanel } from "@/components/invoices/InvoiceInstallmentsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import DataExport from "@/components/DataExport";
import { isAfter, isBefore, parseISO } from "date-fns";

const STATUS_META: { value: InvoiceStatus; color: string; icon: any }[] = [
  { value: "unpaid", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
  { value: "partial", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  { value: "paid", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  { value: "overdue", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: AlertTriangle },
  { value: "refunded", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: RotateCcw },
  { value: "cancelled", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: Ban },
];

const PAYMENT_METHOD_VALUES: PaymentMethod[] = ["cash", "bank", "card", "mobile_banking", "cheque", "online"];

const getStatusMeta = (s: InvoiceStatus) => STATUS_META.find((x) => x.value === s) || STATUS_META[0];

const Invoices = () => {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [payGatewayOpen, setPayGatewayOpen] = useState(false);
  const [payGatewayInvoice, setPayGatewayInvoice] = useState<{ id: string; amount: number } | null>(null);
  const [fromBookingOpen, setFromBookingOpen] = useState(false);
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Selection & sub-data
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<Payment[]>([]);
  const [invoiceRefunds, setInvoiceRefunds] = useState<InvoiceRefund[]>([]);
  const [invoiceAudit, setInvoiceAudit] = useState<InvoiceAuditEvent[]>([]);
  const [invoiceInstallments, setInvoiceInstallments] = useState<InvoiceInstallment[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Forms
  const [invoiceForm, setInvoiceForm] = useState({
    bookingId: "", bookingTitle: "", clientName: "", totalAmount: 0,
    bookingCost: 0, dueDate: "", notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: 0, method: "cash" as PaymentMethod, transactionRef: "",
    date: new Date().toISOString().split("T")[0], notes: "", receivedBy: "",
  });
  const [refundForm, setRefundForm] = useState({ amount: 0, reason: "", method: "" });
  const [cancelReason, setCancelReason] = useState("");

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoiceApi.list();
      // Auto-detect overdue
      const now = new Date();
      const processed = (data as Invoice[]).map((inv) => {
        if (inv.status === "unpaid" || inv.status === "partial") {
          if (inv.dueDate && isBefore(parseISO(inv.dueDate), now)) {
            return { ...inv, status: "overdue" as InvoiceStatus };
          }
        }
        return inv;
      });
      setInvoices(processed);
    } catch (err: any) {
      setError(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const loadInvoiceDetails = async (id: string) => {
    setSelectedInvoiceId(id);
    try {
      const [pays, refs, audit, installments] = await Promise.all([
        invoiceApi.getPayments(id).catch(() => []),
        invoiceApi.getRefunds(id).catch(() => []),
        invoiceApi.getAuditTrail(id).catch(() => []),
        invoiceApi.getInstallments(id).catch(() => []),
      ]);
      setInvoicePayments(pays);
      setInvoiceRefunds(refs);
      setInvoiceAudit(audit);
      setInvoiceInstallments(installments);
    } catch {}
  };

  // ── Create Invoice ──
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await invoiceApi.create({
        bookingId: invoiceForm.bookingId,
        bookingTitle: invoiceForm.bookingTitle,
        clientName: invoiceForm.clientName,
        totalAmount: invoiceForm.totalAmount,
        paidAmount: 0,
        dueAmount: invoiceForm.totalAmount,
        bookingCost: invoiceForm.bookingCost,
        bookingProfit: invoiceForm.totalAmount - invoiceForm.bookingCost,
        status: "unpaid",
        dueDate: invoiceForm.dueDate || undefined,
        notes: invoiceForm.notes,
      } as any);
      setInvoices((prev) => [...prev, created as Invoice]);
      setInvoiceForm({ bookingId: "", bookingTitle: "", clientName: "", totalAmount: 0, bookingCost: 0, dueDate: "", notes: "" });
      setCreateDialogOpen(false);
      toast({ title: t("invoicesForm.toast.created") });
    } catch (err: any) {
      toast({ title: t("invoicesForm.toast.failed"), description: err.message, variant: "destructive" });
    }
  };

  // ── Add Payment ──
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const payAmount = Math.min(paymentForm.amount, selectedInvoice.dueAmount);
    if (payAmount <= 0) {
      toast({ title: t("invoicesForm.toast.invalidAmount"), variant: "destructive" });
      return;
    }
    try {
      const payment = await invoiceApi.addPayment(selectedInvoice.id, {
        invoiceId: selectedInvoice.id,
        bookingId: selectedInvoice.bookingId,
        amount: payAmount,
        method: paymentForm.method,
        transactionRef: paymentForm.transactionRef,
        date: paymentForm.date,
        notes: paymentForm.notes,
        receivedBy: paymentForm.receivedBy || user?.name || "",
        receivedByName: paymentForm.receivedBy || user?.name || "",
        tenantId: selectedInvoice.tenantId,
      } as any);
      setInvoicePayments((p) => [...p, payment]);
      // Update invoice locally
      setInvoices((prev) => prev.map((inv) => {
        if (inv.id !== selectedInvoice.id) return inv;
        const newPaid = inv.paidAmount + payAmount;
        const newDue = inv.totalAmount - newPaid;
        const newStatus: InvoiceStatus = newDue <= 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
        return { ...inv, paidAmount: newPaid, dueAmount: Math.max(0, newDue), status: newStatus };
      }));
      setPaymentForm({ amount: 0, method: "cash", transactionRef: "", date: new Date().toISOString().split("T")[0], notes: "", receivedBy: "" });
      setPayDialogOpen(false);
      toast({ title: t("invoicesForm.toast.paymentRecorded"), description: `৳${payAmount.toLocaleString()} · ${t(`invoicesForm.methods.${paymentForm.method}`)}` });
    } catch (err: any) {
      toast({ title: t("invoicesForm.toast.failed"), description: err.message, variant: "destructive" });
    }
  };

  // ── Refund ──
  const handleRefund = async () => {
    if (!selectedInvoice || refundForm.amount <= 0) return;
    try {
      const refund = await invoiceApi.addRefund(selectedInvoice.id, {
        amount: refundForm.amount, reason: refundForm.reason, method: refundForm.method,
      });
      setInvoiceRefunds((p) => [...p, refund]);
      setInvoices((prev) => prev.map((inv) => {
        if (inv.id !== selectedInvoice.id) return inv;
        const newRefunded = (inv.refundedAmount || 0) + refundForm.amount;
        const isFullRefund = newRefunded >= inv.paidAmount;
        return { ...inv, refundedAmount: newRefunded, status: isFullRefund ? "refunded" : inv.status };
      }));
      setRefundForm({ amount: 0, reason: "", method: "" });
      setRefundDialogOpen(false);
      toast({ title: t("invoicesForm.toast.refundProcessed") });
    } catch (err: any) {
      toast({ title: t("invoicesForm.toast.refundFailed"), description: err.message, variant: "destructive" });
    }
  };

  // ── Cancel ──
  const handleCancel = async () => {
    if (!selectedInvoice) return;
    try {
      await invoiceApi.updateStatus(selectedInvoice.id, "cancelled");
      setInvoices((prev) => prev.map((inv) =>
        inv.id === selectedInvoice.id ? { ...inv, status: "cancelled" as InvoiceStatus, cancelReason } : inv
      ));
      setCancelReason("");
      setCancelDialogOpen(false);
      toast({ title: t("invoicesForm.toast.cancelled") });
    } catch (err: any) {
      toast({ title: t("invoicesForm.toast.failed"), description: err.message, variant: "destructive" });
    }
  };

  // ── Filters ──
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch = !search ||
        inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
        inv.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        inv.bookingTitle?.toLowerCase().includes(search.toLowerCase()) ||
        inv.bookingId?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);

  // ── Totals ──
  const totals = useMemo(() => {
    const total = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const paid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const due = invoices.reduce((s, i) => s + i.dueAmount, 0);
    const refunded = invoices.reduce((s, i) => s + (i.refundedAmount || 0), 0);
    const profit = invoices.reduce((s, i) => s + (i.bookingProfit || 0), 0);
    const overdueCount = invoices.filter((i) => i.status === "overdue").length;
    return { total, paid, due, refunded, profit, overdueCount };
  }, [invoices]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: invoices.length };
    STATUS_META.forEach((s) => { counts[s.value] = invoices.filter((i) => i.status === s.value).length; });
    return counts;
  }, [invoices]);

  // ── Export ──
  const handleExport = () => {
    if (!filtered.length) return;
    const headers = ["Invoice #", "Booking", "Client", "Total", "Paid", "Due", "Status", "Due Date", "Created"];
    const rows = filtered.map((inv) => [
      inv.invoiceNumber || inv.id.slice(0, 8),
      inv.bookingTitle || inv.bookingId?.slice(0, 8) || "",
      inv.clientName || "",
      inv.totalAmount.toString(),
      inv.paidAmount.toString(),
      inv.dueAmount.toString(),
      inv.status,
      inv.dueDate || "",
      inv.createdAt?.slice(0, 10) || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "invoices.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: t("invoicesForm.toast.exported") });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-8 w-8" /> {t("pages.invoicesTitle")}
            </h1>
            <p className="text-muted-foreground">{t("pages.invoicesSubtitle")}</p>
          </div>
          <div className="flex gap-2">
            <PermissionGate module="invoices" action="export">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!filtered.length}>
                <Download className="mr-1 h-4 w-4" /> {t("pages.exportCsv")}
              </Button>
            </PermissionGate>
            <PermissionGate module="invoices" action="create">
              <Button variant="outline" onClick={async () => {
                setFromBookingOpen(true);
                setBookingsLoading(true);
                try {
                  const bks = await bookingApi.list();
                  setBookingsList(bks);
                } catch { setBookingsList([]); }
                finally { setBookingsLoading(false); }
              }}>
                <Plane className="mr-2 h-4 w-4" /> {t("pages.fromBooking")}
              </Button>
            </PermissionGate>
            <PermissionGate module="invoices" action="create">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />{t("pages.newInvoice")}</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>{t("invoicesForm.createTitle")}</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateInvoice} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("invoicesForm.bookingId")}</Label>
                        <Input value={invoiceForm.bookingId} onChange={(e) => setInvoiceForm((f) => ({ ...f, bookingId: e.target.value }))} placeholder={t("invoicesForm.bookingIdPh")} required />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("invoicesForm.bookingTitle")}</Label>
                        <Input value={invoiceForm.bookingTitle} onChange={(e) => setInvoiceForm((f) => ({ ...f, bookingTitle: e.target.value }))} placeholder={t("invoicesForm.bookingTitlePh")} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoicesForm.clientName")}</Label>
                      <Input value={invoiceForm.clientName} onChange={(e) => setInvoiceForm((f) => ({ ...f, clientName: e.target.value }))} placeholder={t("invoicesForm.clientNamePh")} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("invoicesForm.invoiceAmount")}</Label>
                        <Input type="number" min={0.01} step={0.01} value={invoiceForm.totalAmount || ""} onChange={(e) => setInvoiceForm((f) => ({ ...f, totalAmount: parseFloat(e.target.value) || 0 }))} required />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("invoicesForm.cost")}</Label>
                        <Input type="number" min={0} step={0.01} value={invoiceForm.bookingCost || ""} onChange={(e) => setInvoiceForm((f) => ({ ...f, bookingCost: parseFloat(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    {invoiceForm.totalAmount > 0 && (
                      <div className="rounded-md border p-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> {t("invoicesForm.profit")}</span>
                        <span className={`font-semibold ${invoiceForm.totalAmount - invoiceForm.bookingCost >= 0 ? "text-green-600" : "text-destructive"}`}>
                          ৳{(invoiceForm.totalAmount - invoiceForm.bookingCost).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{t("invoicesForm.dueDate")}</Label>
                      <Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoicesForm.notes")}</Label>
                      <Textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("invoicesForm.notesPh")} rows={2} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">{t("invoicesForm.createBtn")}</Button>
                      <DialogClose asChild><Button type="button" variant="outline">{t("invoicesForm.cancel")}</Button></DialogClose>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </PermissionGate>
          </div>
        </div>

        {/* Dashboard Widgets */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("invoicesForm.widgets.totalInvoiced")}</div>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">৳{totals.total.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("invoicesForm.widgets.collected")}</div>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">৳{totals.paid.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("invoicesForm.widgets.outstanding")}</div>
                <DollarSign className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-destructive">৳{totals.due.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("invoicesForm.widgets.profit")}</div>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">৳{totals.profit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className={totals.overdueCount > 0 ? "border-orange-300 dark:border-orange-600" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("invoicesForm.widgets.overdue")}</div>
                <AlertTriangle className={`h-4 w-4 ${totals.overdueCount > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
              </div>
              <p className="text-2xl font-bold">{totals.overdueCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("invoicesForm.widgets.refunded")}</div>
                <RotateCcw className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold">৳{totals.refunded.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>
              {t("invoicesForm.all")} ({statusCounts.all})
            </Button>
            {STATUS_META.map((s) => (
              <Button key={s.value} variant={statusFilter === s.value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s.value)}>
                {t(`invoicesForm.statuses.${s.value}`)} ({statusCounts[s.value] || 0})
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("invoicesForm.searchPh")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>


        {/* Invoice Table */}
        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchInvoices} />
        ) : invoices.length === 0 ? (
          <EmptyState icon={Receipt} title={t("invoicesForm.empty.title")} description={t("invoicesForm.empty.desc")} actionLabel={t("invoicesForm.empty.action")} onAction={() => setCreateDialogOpen(true)} />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("invoicesForm.table.invoice")}</TableHead>
                    <TableHead>{t("invoicesForm.table.booking")}</TableHead>
                    <TableHead>{t("invoicesForm.table.client")}</TableHead>
                    <TableHead className="text-right">{t("invoicesForm.table.total")}</TableHead>
                    <TableHead className="text-right">{t("invoicesForm.table.paid")}</TableHead>
                    <TableHead className="text-right">{t("invoicesForm.table.due")}</TableHead>
                    <TableHead>{t("invoicesForm.table.progress")}</TableHead>
                    <TableHead>{t("invoicesForm.table.dueDate")}</TableHead>
                    <TableHead>{t("invoicesForm.table.status")}</TableHead>
                    <TableHead className="w-[160px]">{t("invoicesForm.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t("invoicesForm.table.noMatch")}</TableCell></TableRow>
                  ) : (
                    filtered.map((inv) => {
                      const meta = getStatusMeta(inv.status);
                      const pct = inv.totalAmount > 0 ? (inv.paidAmount / inv.totalAmount) * 100 : 0;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div>
                              <p className="font-mono text-xs font-medium">{inv.invoiceNumber || `INV-${inv.id.slice(0, 6).toUpperCase()}`}</p>
                              <p className="text-[10px] text-muted-foreground">{inv.createdAt?.slice(0, 10)}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm truncate max-w-[140px]">{inv.bookingTitle || inv.bookingId?.slice(0, 8) || "—"}</TableCell>
                          <TableCell className="text-sm">{inv.clientName || "—"}</TableCell>
                          <TableCell className="text-right font-medium">৳{inv.totalAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">৳{inv.paidAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-destructive font-semibold">৳{inv.dueAmount.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[80px]">
                              <Progress value={pct} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.dueDate ? (
                              <span className={inv.status === "overdue" ? "text-orange-600 font-medium" : ""}>{inv.dueDate}</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>{t(`invoicesForm.statuses.${inv.status}`)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" title={t("invoicesForm.actions.viewDetails")} onClick={() => { loadInvoiceDetails(inv.id); setDetailDialogOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title={t("invoicesForm.actions.viewReceipt")} onClick={() => navigate(`/invoices/${inv.id}/receipt`)}>
                                <FileText className="h-4 w-4" />
                              </Button>
                              {inv.status !== "paid" && inv.status !== "cancelled" && inv.status !== "refunded" && (
                                <PermissionGate module="invoices" action="edit">
                                  <Button variant="ghost" size="icon" title={t("invoicesForm.actions.addPayment")} onClick={() => { setSelectedInvoiceId(inv.id); setPayDialogOpen(true); }}>
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                </PermissionGate>
                              )}
                              <Button variant="ghost" size="icon" title={t("invoicesForm.actions.sendEmail")} onClick={async () => {
                                try { await emailApi.sendInvoice(inv.id); toast({ title: t("invoicesForm.toast.emailSent") }); }
                                catch (err: any) { toast({ title: t("invoicesForm.toast.emailFailed"), description: err.message, variant: "destructive" }); }
                              }}>
                                <Mail className="h-4 w-4 text-primary" />
                              </Button>
                              {inv.status !== "paid" && inv.status !== "cancelled" && inv.status !== "refunded" && (
                                <Button variant="ghost" size="icon" title={t("invoicesForm.actions.payOnline")} onClick={() => { setPayGatewayInvoice({ id: inv.id, amount: inv.dueAmount }); setPayGatewayOpen(true); }}>
                                  <Wallet className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}


        {/* ═══════ DETAIL DIALOG ═══════ */}
        <Dialog open={detailDialogOpen} onOpenChange={(open) => { setDetailDialogOpen(open); if (!open) setSelectedInvoiceId(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("invoicesForm.detail.title")}</DialogTitle></DialogHeader>
            {selectedInvoice && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="rounded-md border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{selectedInvoice.invoiceNumber || `INV-${selectedInvoice.id.slice(0, 6).toUpperCase()}`}</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusMeta(selectedInvoice.status).color}`}>
                      {t(`invoicesForm.statuses.${selectedInvoice.status}`)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">{t("invoicesForm.detail.client")}:</span> {selectedInvoice.clientName || "—"}</div>
                    <div><span className="text-muted-foreground">{t("invoicesForm.detail.booking")}:</span> {selectedInvoice.bookingTitle || selectedInvoice.bookingId?.slice(0, 8)}</div>
                    <div><span className="text-muted-foreground">{t("invoicesForm.detail.dueDate")}:</span> {selectedInvoice.dueDate || t("invoicesForm.detail.notSet")}</div>
                    <div><span className="text-muted-foreground">{t("invoicesForm.detail.created")}:</span> {selectedInvoice.createdAt?.slice(0, 10)}</div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">{t("invoicesForm.detail.total")}</p>
                      <p className="font-bold">৳{selectedInvoice.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">{t("invoicesForm.detail.paid")}</p>
                      <p className="font-bold text-green-600">৳{selectedInvoice.paidAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">{t("invoicesForm.detail.due")}</p>
                      <p className="font-bold text-destructive">৳{selectedInvoice.dueAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">{t("invoicesForm.detail.profit")}</p>
                      <p className={`font-bold ${(selectedInvoice.bookingProfit || 0) >= 0 ? "text-green-600" : "text-destructive"}`}>
                        ৳{(selectedInvoice.bookingProfit || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Progress value={selectedInvoice.totalAmount > 0 ? (selectedInvoice.paidAmount / selectedInvoice.totalAmount) * 100 : 0} className="h-2" />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {selectedInvoice.status !== "paid" && selectedInvoice.status !== "cancelled" && selectedInvoice.status !== "refunded" && (
                    <>
                      <PermissionGate module="invoices" action="edit">
                        <Button size="sm" onClick={() => setPayDialogOpen(true)}>
                          <CreditCard className="mr-1 h-3.5 w-3.5" /> {t("invoicesForm.detail.recordPayment")}
                        </Button>
                      </PermissionGate>
                      <Button size="sm" variant="outline" onClick={async () => {
                        try { await emailApi.sendInvoice(selectedInvoice.id); toast({ title: t("invoicesForm.toast.reminderSent") }); }
                        catch (err: any) { toast({ title: t("invoicesForm.toast.failed"), description: err.message, variant: "destructive" }); }
                      }}>
                        <Send className="mr-1 h-3.5 w-3.5" /> {t("invoicesForm.detail.sendReminder")}
                      </Button>
                    </>
                  )}
                  {selectedInvoice.paidAmount > 0 && selectedInvoice.status !== "refunded" && (
                    <PermissionGate module="invoices" action="approve">
                      <Button size="sm" variant="outline" onClick={() => setRefundDialogOpen(true)}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> {t("invoicesForm.detail.refund")}
                      </Button>
                    </PermissionGate>
                  )}
                  {selectedInvoice.status !== "cancelled" && selectedInvoice.status !== "refunded" && (
                    <PermissionGate module="invoices" action="delete">
                      <Button size="sm" variant="destructive" onClick={() => setCancelDialogOpen(true)}>
                        <Ban className="mr-1 h-3.5 w-3.5" /> {t("invoicesForm.detail.cancel")}
                      </Button>
                    </PermissionGate>
                  )}
                </div>

                {/* Tabs: Payments / Refunds / Audit Trail */}
                <Tabs defaultValue="payments">
                  <TabsList>
                    <TabsTrigger value="payments">{t("invoicesForm.detail.payments")} ({invoicePayments.length})</TabsTrigger>
                    <TabsTrigger value="installments">{t("invoicesForm.detail.installments")} ({invoiceInstallments.length})</TabsTrigger>
                    <TabsTrigger value="refunds">{t("invoicesForm.detail.refunds")} ({invoiceRefunds.length})</TabsTrigger>
                    <TabsTrigger value="audit">{t("invoicesForm.detail.audit")} ({invoiceAudit.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="installments" className="mt-3">
                    <InvoiceInstallmentsPanel
                      invoiceId={selectedInvoice.id}
                      installments={invoiceInstallments}
                      onChange={setInvoiceInstallments}
                    />
                  </TabsContent>


                  <TabsContent value="payments" className="mt-3">
                    {invoicePayments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("invoicesForm.detail.noPayments")}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("invoicesForm.detail.date")}</TableHead>
                            <TableHead className="text-right">{t("invoicesForm.detail.amount")}</TableHead>
                            <TableHead>{t("invoicesForm.detail.method")}</TableHead>
                            <TableHead>{t("invoicesForm.detail.reference")}</TableHead>
                            <TableHead>{t("invoicesForm.detail.notes")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoicePayments.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-sm">{p.date}</TableCell>
                              <TableCell className="text-right font-medium text-green-600">৳{p.amount.toLocaleString()}</TableCell>
                              <TableCell className="text-sm">{p.method ? t(`invoicesForm.methods.${p.method}`) : "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.transactionRef || "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{p.notes || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="refunds" className="mt-3">
                    {invoiceRefunds.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("invoicesForm.detail.noRefunds")}</p>
                    ) : (
                      <div className="space-y-2">
                        {invoiceRefunds.map((r) => (
                          <div key={r.id} className="rounded-md border p-3 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-purple-600">-৳{r.amount.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">{r.createdAt?.slice(0, 10)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{t("invoicesForm.detail.reason")}: {r.reason}</p>
                            {r.method && <p className="text-xs text-muted-foreground">{t("invoicesForm.detail.method")}: {r.method}</p>}
                            {r.processedByName && <p className="text-xs text-muted-foreground">{t("invoicesForm.detail.by")}: {r.processedByName}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="audit" className="mt-3">
                    {invoiceAudit.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("invoicesForm.detail.noAudit")}</p>
                    ) : (
                      <div className="space-y-2">
                        {invoiceAudit.map((evt) => (
                          <div key={evt.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              {evt.type === "payment" ? <CreditCard className="h-3.5 w-3.5 text-green-600" /> :
                               evt.type === "refund" ? <RotateCcw className="h-3.5 w-3.5 text-purple-600" /> :
                               evt.type === "cancellation" ? <Ban className="h-3.5 w-3.5 text-destructive" /> :
                               <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">{evt.content}</p>
                              <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="capitalize">{evt.type.replace("_", " ")}</span>
                                {evt.createdByName && <span>· {evt.createdByName}</span>}
                                <span>· {evt.createdAt?.slice(0, 16).replace("T", " ")}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══════ ADD PAYMENT DIALOG ═══════ */}
        <Dialog open={payDialogOpen} onOpenChange={(open) => { setPayDialogOpen(open); if (!open && !detailDialogOpen) setSelectedInvoiceId(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("invoicesForm.payDialog.title")}</DialogTitle></DialogHeader>
            {selectedInvoice && (
              <div className="mb-3 rounded-md border p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("invoicesForm.payDialog.totalLabel")}</span><span className="font-medium">৳{selectedInvoice.totalAmount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("invoicesForm.payDialog.paidLabel")}</span><span className="text-green-600 font-medium">৳{selectedInvoice.paidAmount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("invoicesForm.payDialog.remainingLabel")}</span><span className="text-destructive font-semibold">৳{selectedInvoice.dueAmount.toLocaleString()}</span></div>
              </div>
            )}
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("invoicesForm.payDialog.amount")}</Label>
                  <Input type="number" min={0.01} step={0.01} max={selectedInvoice?.dueAmount} value={paymentForm.amount || ""} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("invoicesForm.payDialog.method")}</Label>
                  <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm((f) => ({ ...f, method: v as PaymentMethod }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_VALUES.map((m) => <SelectItem key={m} value={m}>{t(`invoicesForm.methods.${m}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("invoicesForm.payDialog.date")}</Label>
                  <Input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t("invoicesForm.payDialog.ref")}</Label>
                  <Input value={paymentForm.transactionRef} onChange={(e) => setPaymentForm((f) => ({ ...f, transactionRef: e.target.value }))} placeholder={t("invoicesForm.payDialog.refPh")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("invoicesForm.payDialog.receivedBy")}</Label>
                  <Input value={paymentForm.receivedBy} onChange={(e) => setPaymentForm((f) => ({ ...f, receivedBy: e.target.value }))} placeholder={user?.name || t("invoicesForm.payDialog.receivedByPh")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("invoicesForm.payDialog.notes")}</Label>
                  <Input value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t("invoicesForm.payDialog.notesPh")} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{t("invoicesForm.payDialog.submit")}</Button>
                <DialogClose asChild><Button type="button" variant="outline">{t("invoicesForm.cancel")}</Button></DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>


        {/* ═══════ REFUND DIALOG ═══════ */}
        <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("invoicesForm.refundDialog.title")}</DialogTitle></DialogHeader>
            {selectedInvoice && (
              <div className="mb-3 rounded-md border p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("invoicesForm.refundDialog.paidAmount")}</span><span className="font-medium text-green-600">৳{selectedInvoice.paidAmount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("invoicesForm.refundDialog.alreadyRefunded")}</span><span className="font-medium text-purple-600">৳{(selectedInvoice.refundedAmount || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("invoicesForm.refundDialog.maxRefundable")}</span><span className="font-semibold">৳{(selectedInvoice.paidAmount - (selectedInvoice.refundedAmount || 0)).toLocaleString()}</span></div>
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("invoicesForm.refundDialog.amount")}</Label>
                <Input type="number" min={0.01} step={0.01} max={selectedInvoice ? selectedInvoice.paidAmount - (selectedInvoice.refundedAmount || 0) : 0} value={refundForm.amount || ""} onChange={(e) => setRefundForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("invoicesForm.refundDialog.reason")}</Label>
                <Textarea value={refundForm.reason} onChange={(e) => setRefundForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("invoicesForm.refundDialog.reasonPh")} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>{t("invoicesForm.refundDialog.method")}</Label>
                <Select value={refundForm.method} onValueChange={(v) => setRefundForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("invoicesForm.refundDialog.methodPh")} /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_VALUES.map((m) => <SelectItem key={m} value={m}>{t(`invoicesForm.methods.${m}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRefund} disabled={!refundForm.amount || !refundForm.reason} className="flex-1">{t("invoicesForm.refundDialog.submit")}</Button>
                <DialogClose asChild><Button variant="outline">{t("invoicesForm.cancel")}</Button></DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ CANCEL DIALOG ═══════ */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("invoicesForm.cancelDialog.title")}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t("invoicesForm.cancelDialog.warning")}</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("invoicesForm.cancelDialog.reason")}</Label>
                <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t("invoicesForm.cancelDialog.reasonPh")} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason.trim()} className="flex-1">{t("invoicesForm.cancelDialog.confirm")}</Button>
                <DialogClose asChild><Button variant="outline">{t("invoicesForm.cancelDialog.keep")}</Button></DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ FROM BOOKING DIALOG ═══════ */}
        <Dialog open={fromBookingOpen} onOpenChange={setFromBookingOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("invoicesForm.fromBooking.title")}</DialogTitle></DialogHeader>
            {bookingsLoading ? (
              <div className="py-8 text-center text-muted-foreground">{t("invoicesForm.fromBooking.loading")}</div>
            ) : bookingsList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">{t("invoicesForm.fromBooking.none")}</div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {bookingsList.map((bk) => (
                  <div
                    key={bk.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setInvoiceForm({
                        bookingId: bk.id,
                        bookingTitle: bk.title || `${bk.type} — ${bk.destination || "Trip"}`,
                        clientName: bk.clientName || "",
                        totalAmount: bk.amount || 0,
                        bookingCost: bk.cost || 0,
                        dueDate: "",
                        notes: "",
                      });
                      setFromBookingOpen(false);
                      setCreateDialogOpen(true);
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium">{bk.title || `${bk.type} — ${bk.destination || "Trip"}`}</p>
                      <p className="text-xs text-muted-foreground">{bk.clientName || t("invoicesForm.fromBooking.noClient")} · {bk.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">৳{(bk.amount || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{bk.createdAt?.slice(0, 10)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>


        {/* Online Payment Gateway */}
        {payGatewayInvoice && (
          <PaymentGatewayDialog
            open={payGatewayOpen}
            onOpenChange={(v) => { setPayGatewayOpen(v); if (!v) setPayGatewayInvoice(null); }}
            invoiceId={payGatewayInvoice.id}
            amount={payGatewayInvoice.amount}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
