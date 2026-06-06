import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import {
  Search, Download, Eye, ArrowRight, Shield, FileText,
  Activity, Clock, RefreshCw,
} from "lucide-react";
import {
  MODULE_LABELS, ACTION_LABELS, getActionColor,
  type AuditModule,
} from "@/lib/auditLog";
import { auditLogApi, type AuditLogEntry } from "@/lib/auditLogApi";
import { useToast } from "@/hooks/use-toast";

const AdminAuditLog = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await auditLogApi.list();
      setLogs(data);
    } catch (err: any) {
      toast({ title: t("adminAuditLog.loadFailed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const tenants = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => { if (l.tenantName) set.add(l.tenantName); });
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchSearch = search === "" ||
        l.actorName.toLowerCase().includes(search.toLowerCase()) ||
        l.actorEmail.toLowerCase().includes(search.toLowerCase()) ||
        (l.targetLabel || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.tenantName || "").toLowerCase().includes(search.toLowerCase()) ||
        (ACTION_LABELS[l.action as keyof typeof ACTION_LABELS] || l.action).toLowerCase().includes(search.toLowerCase());
      const matchModule = moduleFilter === "all" || l.module === moduleFilter;
      const matchTenant = tenantFilter === "all" || l.tenantName === tenantFilter;
      return matchSearch && matchModule && matchTenant;
    });
  }, [logs, search, moduleFilter, tenantFilter]);

  const stats = useMemo(() => {
    const moduleCounts: Record<string, number> = {};
    logs.forEach((l) => { moduleCounts[l.module] = (moduleCounts[l.module] || 0) + 1; });
    return {
      total: logs.length,
      today: logs.filter((l) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
      securityEvents: logs.filter((l) => l.module === "auth").length,
      moduleCounts,
    };
  }, [logs]);

  const handleExport = () => {
    const headers = ["Timestamp", "Actor", "Email", "Role", "Tenant", "Module", "Action", "Target", "Old Value", "New Value", "IP"];
    const rows = filtered.map((l) => [
      l.createdAt, l.actorName, l.actorEmail, l.actorRole,
      l.tenantName || "", MODULE_LABELS[l.module as AuditModule] || l.module,
      ACTION_LABELS[l.action as keyof typeof ACTION_LABELS] || l.action,
      l.targetLabel || "", l.oldValue || "", l.newValue || "", l.ipAddress || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-log.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("adminAuditLog.title")}</h1>
            <p className="text-muted-foreground">{t("adminAuditLog.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("adminAuditLog.refresh")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-1 h-4 w-4" /> {t("adminAuditLog.export")}</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Activity className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{loading ? "…" : stats.total}</p><p className="text-xs text-muted-foreground">{t("adminAuditLog.stats.total")}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{loading ? "…" : stats.today}</p><p className="text-xs text-muted-foreground">{t("adminAuditLog.stats.today")}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Shield className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">{loading ? "…" : stats.securityEvents}</p><p className="text-xs text-muted-foreground">{t("adminAuditLog.stats.auth")}</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{loading ? "…" : Object.keys(stats.moduleCounts).length}</p><p className="text-xs text-muted-foreground">{t("adminAuditLog.stats.modules")}</p></div></div></CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("adminAuditLog.filters.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder={t("adminAuditLog.filters.module")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminAuditLog.filters.allModules")}</SelectItem>
              {(Object.keys(MODULE_LABELS) as AuditModule[]).map((m) => (
                <SelectItem key={m} value={m}>{MODULE_LABELS[m]} {stats.moduleCounts[m] ? `(${stats.moduleCounts[m]})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder={t("adminAuditLog.filters.tenant")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminAuditLog.filters.allTenants")}</SelectItem>
              {tenants.map((tn) => <SelectItem key={tn} value={tn}>{tn}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("adminAuditLog.table.title", { count: filtered.length })}</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminAuditLog.table.timestamp")}</TableHead>
                    <TableHead>{t("adminAuditLog.table.actor")}</TableHead>
                    <TableHead>{t("adminAuditLog.table.tenant")}</TableHead>
                    <TableHead>{t("adminAuditLog.table.module")}</TableHead>
                    <TableHead>{t("adminAuditLog.table.action")}</TableHead>
                    <TableHead>{t("adminAuditLog.table.target")}</TableHead>
                    <TableHead>{t("adminAuditLog.table.changes")}</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("adminAuditLog.table.empty")}</TableCell></TableRow>
                  ) : (
                    filtered.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString()}<br />
                          <span className="text-[10px]">{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{log.actorName}</p>
                            <p className="text-[10px] text-muted-foreground">{log.actorRole}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{log.tenantName || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] capitalize">{MODULE_LABELS[log.module as AuditModule] || log.module}</Badge></TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getActionColor(log.action as any)}`}>
                            {ACTION_LABELS[log.action as keyof typeof ACTION_LABELS] || log.action}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={log.targetLabel || undefined}>
                          {log.targetLabel || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.oldValue && log.newValue ? (
                            <span className="flex items-center gap-1 text-[10px]">
                              <span className="line-through text-muted-foreground">{log.oldValue}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-medium">{log.newValue}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedLog(log); setDetailOpen(true); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("adminAuditLog.detail.title")}</DialogTitle></DialogHeader>
            {selectedLog && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <span className="text-muted-foreground">{t("adminAuditLog.detail.timestamp")}:</span>
                  <span>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                  <span className="text-muted-foreground">{t("adminAuditLog.detail.actor")}:</span>
                  <span className="font-medium">{selectedLog.actorName}</span>
                  <span className="text-muted-foreground">{t("adminAuditLog.detail.email")}:</span>
                  <span>{selectedLog.actorEmail}</span>
                  <span className="text-muted-foreground">{t("adminAuditLog.detail.role")}:</span>
                  <Badge variant="outline" className="capitalize w-fit">{selectedLog.actorRole}</Badge>
                  {selectedLog.tenantName && (
                    <>
                      <span className="text-muted-foreground">{t("adminAuditLog.detail.tenant")}:</span>
                      <span>{selectedLog.tenantName}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">{t("adminAuditLog.detail.module")}:</span>
                  <Badge variant="outline" className="w-fit">{MODULE_LABELS[selectedLog.module as AuditModule] || selectedLog.module}</Badge>
                  <span className="text-muted-foreground">{t("adminAuditLog.detail.action")}:</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium w-fit ${getActionColor(selectedLog.action as any)}`}>
                    {ACTION_LABELS[selectedLog.action as keyof typeof ACTION_LABELS] || selectedLog.action}
                  </span>
                  {selectedLog.targetLabel && (
                    <>
                      <span className="text-muted-foreground">{t("adminAuditLog.detail.target")}:</span>
                      <span>{selectedLog.targetLabel}</span>
                    </>
                  )}
                  {selectedLog.oldValue && (
                    <>
                      <span className="text-muted-foreground">{t("adminAuditLog.detail.oldValue")}:</span>
                      <span className="break-words">{selectedLog.oldValue}</span>
                    </>
                  )}
                  {selectedLog.newValue && (
                    <>
                      <span className="text-muted-foreground">{t("adminAuditLog.detail.newValue")}:</span>
                      <span className="break-words">{selectedLog.newValue}</span>
                    </>
                  )}
                  {selectedLog.ipAddress && (
                    <>
                      <span className="text-muted-foreground">IP:</span>
                      <span>{selectedLog.ipAddress}</span>
                    </>
                  )}
                </div>
                <div className="flex justify-end">
                  <DialogClose asChild><Button variant="outline">{t("adminAuditLog.detail.close")}</Button></DialogClose>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLog;
