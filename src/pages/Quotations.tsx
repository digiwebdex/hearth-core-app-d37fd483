import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { quotationApi, type Quotation, type QuotationStatus } from "@/lib/api";
import {
  FileText, Plus, Search, Eye, Pencil, Trash2, Copy, ArrowRight, Send,
  DollarSign, Users, MapPin, MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_META: { value: QuotationStatus; color: string }[] = [
  { value: "draft", color: "bg-muted text-muted-foreground" },
  { value: "sent", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "expired", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
];

const getStatusMeta = (s: QuotationStatus) => STATUS_META.find((x) => x.value === s) || STATUS_META[0];

const Quotations = () => {
  const { t } = useTranslation();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await quotationApi.list();
      setQuotations(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    return quotations.filter((q) => {
      const matchSearch = !search ||
        q.title?.toLowerCase().includes(search.toLowerCase()) ||
        q.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        q.destination?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotations, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: quotations.length };
    STATUS_META.forEach((s) => { counts[s.value] = quotations.filter((q) => q.status === s.value).length; });
    return counts;
  }, [quotations]);

  const handleDelete = async (id: string) => {
    try {
      await quotationApi.delete(id);
      setQuotations((p) => p.filter((q) => q.id !== id));
      toast({ title: t("quotationsForm.toast.deleted") });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("quotationsForm.toast.error"), description: err.message });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const dup = await quotationApi.duplicate(id);
      setQuotations((p) => [dup, ...p]);
      toast({ title: t("quotationsForm.toast.duplicated") });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("quotationsForm.toast.error"), description: err.message });
    }
  };

  const handleConvert = async (q: Quotation) => {
    try {
      const booking = await quotationApi.convertToBooking(q.id);
      toast({ title: t("quotationsForm.toast.converted") });
      navigate(`/bookings?highlight=${booking.id}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: t("quotationsForm.toast.error"), description: err.message });
    }
  };

  const handleSend = async (q: Quotation) => {
    try {
      const updated = await quotationApi.updateStatus(q.id, "sent");
      setQuotations((prev) => prev.map((row) => (row.id === q.id ? updated : row)));
      toast({ title: t("quotationsForm.toast.sent", "Quotation sent to client") });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("quotationsForm.toast.error"), description: err.message });
    }
  };

  // Summary cards
  const totalValue = quotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
  const totalProfit = quotations.reduce((sum, q) => sum + (q.totalProfit || 0), 0);
  const approvedCount = quotations.filter((q) => q.status === "approved").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-8 w-8" /> {t("sidebar.quotations")}
            </h1>
            <p className="text-muted-foreground">{t("pages.quotationsSubtitle")}</p>
          </div>
          <PermissionGate module="quotations" action="create">
            <Button onClick={() => navigate("/quotations/new")}>
              <Plus className="mr-2 h-4 w-4" /> {t("pages.newQuotation")}
            </Button>
          </PermissionGate>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("quotationsForm.widgets.totalQuotes")}</div>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{quotations.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("quotationsForm.widgets.approved")}</div>
                <Badge variant="secondary">{approvedCount}</Badge>
              </div>
              <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("quotationsForm.widgets.totalValue")}</div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">৳{totalValue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("quotationsForm.widgets.estProfit")}</div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">৳{totalProfit.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>
            {t("quotationsForm.all")} ({statusCounts.all})
          </Button>
          {STATUS_META.map((s) => (
            <Button key={s.value} variant={statusFilter === s.value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s.value)}>
              {t(`quotationsForm.statuses.${s.value}`)} ({statusCounts[s.value] || 0})
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("quotationsForm.searchPh")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : quotations.length === 0 ? (
          <EmptyState icon={FileText} title={t("quotationsForm.empty.title")} description={t("quotationsForm.empty.desc")} actionLabel={t("quotationsForm.empty.action")} onAction={() => navigate("/quotations/new")} />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("quotationsForm.table.title")}</TableHead>
                    <TableHead>{t("quotationsForm.table.client")}</TableHead>
                    <TableHead>{t("quotationsForm.table.destination")}</TableHead>
                    <TableHead>{t("quotationsForm.table.travelers")}</TableHead>
                    <TableHead>{t("quotationsForm.table.grandTotal")}</TableHead>
                    <TableHead>{t("quotationsForm.table.profit")}</TableHead>
                    <TableHead>{t("quotationsForm.table.status")}</TableHead>
                    <TableHead>{t("quotationsForm.table.version")}</TableHead>
                    <TableHead>{t("quotationsForm.table.validUntil")}</TableHead>
                    <TableHead className="w-[140px]">{t("quotationsForm.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t("quotationsForm.table.noMatch")}</TableCell></TableRow>
                  ) : (

                    filtered.map((q) => {
                      const meta = getStatusMeta(q.status);
                      return (
                        <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                          <TableCell className="font-medium max-w-[200px] truncate">{q.title || t("quotationsForm.table.untitled")}</TableCell>
                          <TableCell className="text-sm">{q.clientName || q.leadName || "—"}</TableCell>
                          <TableCell>
                            {q.destination ? (
                              <div className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{q.destination}</div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm"><Users className="h-3 w-3 text-muted-foreground" />{q.travelerCount || 1}</div>
                          </TableCell>
                          <TableCell className="font-medium">৳{(q.grandTotal || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-green-600">৳{(q.totalProfit || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>{t(`quotationsForm.statuses.${q.status}`)}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">v{q.version || 1}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{q.validUntil || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" title={t("quotationsForm.actions.view")} onClick={() => navigate(`/quotations/${q.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" title={t("quotationsForm.table.actions")}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  {q.status === "draft" ? (
                                    <PermissionGate module="quotations" action="edit">
                                      <DropdownMenuItem onClick={() => handleSend(q)}>
                                        <Send className="mr-2 h-4 w-4 text-blue-600" /> {t("quotationsForm.actions.send", "Send to client")}
                                      </DropdownMenuItem>
                                    </PermissionGate>
                                  ) : null}
                                  <PermissionGate module="quotations" action="edit">
                                    <DropdownMenuItem onClick={() => navigate(`/quotations/${q.id}/edit`)}>
                                      <Pencil className="mr-2 h-4 w-4" /> {t("quotationsForm.actions.edit")}
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                  <PermissionGate module="quotations" action="create">
                                    <DropdownMenuItem onClick={() => handleDuplicate(q.id)}>
                                      <Copy className="mr-2 h-4 w-4" /> {t("quotationsForm.actions.duplicate")}
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                  {(q.status === "approved" || q.status === "sent") ? (
                                    <PermissionGate module="quotations" action="approve">
                                      <DropdownMenuItem onClick={() => handleConvert(q)}>
                                        <ArrowRight className="mr-2 h-4 w-4 text-green-600" /> {t("quotationsForm.actions.convert")}
                                      </DropdownMenuItem>
                                    </PermissionGate>
                                  ) : null}
                                  <PermissionGate module="quotations" action="delete">
                                    <DropdownMenuItem onClick={() => handleDelete(q.id)} className="text-destructive focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> {t("quotationsForm.actions.delete")}
                                    </DropdownMenuItem>
                                  </PermissionGate>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
      </div>
    </DashboardLayout>
  );
};

export default Quotations;
