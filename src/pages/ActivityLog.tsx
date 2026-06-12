import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Search, Download, Eye, ArrowRight, Activity, Clock, RefreshCw } from "lucide-react";
import {
  MODULE_LABELS,
  ACTION_LABELS,
  getActionColor,
  type AuditModule,
} from "@/lib/auditLog";
import { auditLogApi, type AuditLogEntry } from "@/lib/auditLogApi";
import { useToast } from "@/hooks/use-toast";

const ADMIN_ROLES = new Set(["tenant_owner", "owner", "manager"]);

const ActivityLog = () => {
  const { t } = useTranslation();
  const { appRole } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();
  const canView = ADMIN_ROLES.has(appRole);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await auditLogApi.list();
      setLogs(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: t("activityLog.loadFailed"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) fetchLogs();
  }, [canView]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchSearch =
        search === "" ||
        l.actorName.toLowerCase().includes(search.toLowerCase()) ||
        l.actorEmail.toLowerCase().includes(search.toLowerCase()) ||
        (l.targetLabel || "").toLowerCase().includes(search.toLowerCase()) ||
        (ACTION_LABELS[l.action as keyof typeof ACTION_LABELS] || l.action)
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchModule = moduleFilter === "all" || l.module === moduleFilter;
      return matchSearch && matchModule;
    });
  }, [logs, search, moduleFilter]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      today: logs.filter((l) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
    };
  }, [logs]);

  const handleExport = () => {
    const headers = ["Timestamp", "Actor", "Email", "Role", "Module", "Action", "Target", "Old", "New"];
    const rows = filtered.map((l) =>
      [
        l.createdAt,
        l.actorName,
        l.actorEmail,
        l.actorRole,
        l.module,
        l.action,
        l.targetLabel || "",
        l.oldValue || "",
        l.newValue || "",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("activityLog.title")}</h1>
            <p className="text-muted-foreground">{t("activityLog.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {t("activityLog.refresh")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> {t("activityLog.export")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{loading ? "…" : stats.total}</p>
                <p className="text-xs text-muted-foreground">{t("activityLog.stats.total")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{loading ? "…" : stats.today}</p>
                <p className="text-xs text-muted-foreground">{t("activityLog.stats.today")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("activityLog.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("activityLog.moduleFilter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("activityLog.allModules")}</SelectItem>
              {Object.entries(MODULE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("activityLog.tableTitle", { count: filtered.length })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("activityLog.timestamp")}</TableHead>
                    <TableHead>{t("activityLog.actor")}</TableHead>
                    <TableHead>{t("activityLog.module")}</TableHead>
                    <TableHead>{t("activityLog.action")}</TableHead>
                    <TableHead>{t("activityLog.target")}</TableHead>
                    <TableHead>{t("activityLog.changes")}</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t("activityLog.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{log.actorName}</div>
                          <div className="text-xs text-muted-foreground">{log.actorRole}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {MODULE_LABELS[log.module as AuditModule] || log.module}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getActionColor(log.action as keyof typeof ACTION_LABELS)}>
                            {ACTION_LABELS[log.action as keyof typeof ACTION_LABELS] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{log.targetLabel || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {log.oldValue && log.newValue ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <span className="truncate max-w-[80px]">{log.oldValue}</span>
                              <ArrowRight className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[80px]">{log.newValue}</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedLog(log);
                              setDetailOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("activityLog.detailTitle")}</DialogTitle>
            </DialogHeader>
            {selectedLog ? (
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("activityLog.timestamp")}: </span>
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("activityLog.actor")}: </span>
                  {selectedLog.actorName} ({selectedLog.actorEmail})
                </div>
                <div>
                  <span className="text-muted-foreground">{t("activityLog.module")}: </span>
                  {MODULE_LABELS[selectedLog.module as AuditModule] || selectedLog.module}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("activityLog.action")}: </span>
                  {ACTION_LABELS[selectedLog.action as keyof typeof ACTION_LABELS] || selectedLog.action}
                </div>
                {selectedLog.targetLabel ? (
                  <div>
                    <span className="text-muted-foreground">{t("activityLog.target")}: </span>
                    {selectedLog.targetLabel}
                  </div>
                ) : null}
                {selectedLog.oldValue ? (
                  <div>
                    <span className="text-muted-foreground">{t("activityLog.oldValue")}: </span>
                    {selectedLog.oldValue}
                  </div>
                ) : null}
                {selectedLog.newValue ? (
                  <div>
                    <span className="text-muted-foreground">{t("activityLog.newValue")}: </span>
                    {selectedLog.newValue}
                  </div>
                ) : null}
              </div>
            ) : null}
            <DialogClose asChild>
              <Button variant="outline">{t("common.cancel")}</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ActivityLog;
