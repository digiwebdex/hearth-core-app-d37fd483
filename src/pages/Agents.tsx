import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, UserCog, Search, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { agentApi, tenantApi, type Agent, type AgentStatus, type User } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getPlan } from "@/lib/plans";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

interface AgentFormState {
  name: string;
  phone: string;
  email: string;
  commissionRate: number;
  status: AgentStatus;
  userId: string;
}

const emptyForm: AgentFormState = {
  name: "",
  phone: "",
  email: "",
  commissionRate: 0,
  status: "active",
  userId: "",
};

const Agents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const commissionsMode = location.pathname === "/commissions";
  const { toast } = useToast();
  const { currentPlan } = useAuth();
  const { isSalesAgent, can } = usePermissions();
  const canUseCommission = getPlan(currentPlan).hasAgentCommission;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AgentStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormState>(emptyForm);
  const [redirectChecked, setRedirectChecked] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agentApi.list();
      setAgents(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("agentsForm.loading");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (!can("agents", "edit")) return;
    tenantApi.getMembers().then(setTeamMembers).catch(() => setTeamMembers([]));
  }, [can]);

  useEffect(() => {
    if (!isSalesAgent || redirectChecked) return;
    let cancelled = false;
    agentApi
      .getMe()
      .then((linked) => {
        if (cancelled) return;
        setRedirectChecked(true);
        if (linked) {
          navigate(`/agents/${linked.id}`, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) setRedirectChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isSalesAgent, navigate, redirectChecked]);

  const filtered = useMemo(() => {
    return agents
      .filter((a) => {
        const matchSearch =
          !search ||
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.email.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "all" || a.status === statusFilter;
        const matchCommission =
          !commissionsMode || !canUseCommission || (a.pendingCommission ?? 0) > 0;
        return matchSearch && matchStatus && matchCommission;
      })
      .sort((a, b) => {
        if (!commissionsMode || !canUseCommission) return 0;
        return (b.pendingCommission ?? 0) - (a.pendingCommission ?? 0);
      });
  }, [agents, search, statusFilter, commissionsMode, canUseCommission]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setForm({
      name: agent.name,
      phone: agent.phone,
      email: agent.email,
      commissionRate: agent.commissionRate,
      status: agent.status,
      userId: agent.userId || "",
    });
    setEditingId(agent.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      commissionRate: form.commissionRate,
      status: form.status,
      userId: form.userId || null,
    };
    try {
      if (editingId) {
        const updated = await agentApi.update(editingId, payload);
        setAgents((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...updated } : a)));
        toast({ title: t("agentsForm.agentUpdated") });
      } else {
        const created = await agentApi.create(payload);
        setAgents((prev) => [created, ...prev]);
        toast({ title: t("agentsForm.agentCreated") });
      }
      resetForm();
      setDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("agentsForm.createFailed");
      toast({
        title: editingId ? t("agentsForm.updateFailed") : t("agentsForm.createFailed"),
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await agentApi.delete(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
      toast({ title: t("agentsForm.agentDeleted"), variant: "destructive" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("agentsForm.deleteFailed");
      toast({
        title: t("agentsForm.deleteFailed"),
        description: message.includes("bookings") ? t("agentsForm.deleteBlocked") : message,
        variant: "destructive",
      });
    }
  };

  if (isSalesAgent && !redirectChecked) {
    return (
      <DashboardLayout>
        <LoadingState rows={4} />
      </DashboardLayout>
    );
  }

  if (isSalesAgent && redirectChecked && agents.length === 0) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={UserCog}
          title={t("agentsForm.summary.notLinked")}
          description={t("agentsForm.summary.notLinkedDesc")}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <UserCog className="h-8 w-8" />{" "}
              {commissionsMode ? t("commissionsPage.title") : t("agentsForm.title")}
            </h1>
            <p className="text-muted-foreground">
              {commissionsMode ? t("commissionsPage.subtitle") : t("pages.agentsSubtitle")}
            </p>
          </div>
          <PermissionGate module="agents" action="create">
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" /> {t("pages.newAgent")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingId ? t("agentsForm.editAgent") : t("agentsForm.newAgent")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("agentsForm.name")}</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t("agentsForm.namePlaceholder")}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("agentsForm.email")}</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder={t("agentsForm.emailPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("agentsForm.phone")}</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder={t("agentsForm.phonePlaceholder")}
                      />
                    </div>
                  </div>
                  {canUseCommission && (
                    <div className="space-y-2">
                      <Label>{t("agentsForm.commissionRate")}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={form.commissionRate}
                        onChange={(e) => setForm((f) => ({ ...f, commissionRate: parseFloat(e.target.value) || 0 }))}
                      />
                      <p className="text-xs text-muted-foreground">{t("agentsForm.commissionRateHint")}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("agentsForm.status")}</Label>
                      <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as AgentStatus }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t("agentsForm.statuses.active")}</SelectItem>
                          <SelectItem value="inactive">{t("agentsForm.statuses.inactive")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("agentsForm.linkedUser")}</Label>
                      <Select
                        value={form.userId || "none"}
                        onValueChange={(v) => setForm((f) => ({ ...f, userId: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder={t("agentsForm.linkedUserPlaceholder")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("agentsForm.linkedUserNone")}</SelectItem>
                          {teamMembers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name} ({m.email})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingId ? t("agentsForm.update") : t("agentsForm.create")}
                    </Button>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">{t("agentsForm.cancel")}</Button>
                    </DialogClose>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>

        {!canUseCommission && (
          <p className="text-sm text-muted-foreground">{t("agentsForm.featureGate.commissionDisabled")}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>
            {t("agentsForm.all")} ({agents.length})
          </Button>
          <Button variant={statusFilter === "active" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("active")}>
            {t("agentsForm.active")} ({agents.filter((a) => a.status === "active").length})
          </Button>
          <Button variant={statusFilter === "inactive" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("inactive")}>
            {t("agentsForm.inactive")} ({agents.filter((a) => a.status === "inactive").length})
          </Button>
        </div>

        <div className="flex items-center gap-2 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("agentsForm.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchAgents} />
        ) : agents.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title={t("agentsForm.noAgentsYet")}
            description={t("agentsForm.noAgentsDesc")}
            actionLabel={t("agentsForm.addAgent")}
            onAction={openCreate}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("agentsForm.table.name")}</TableHead>
                    <TableHead>{t("agentsForm.table.email")}</TableHead>
                    <TableHead>{t("agentsForm.table.phone")}</TableHead>
                    {canUseCommission && <TableHead>{t("agentsForm.table.commissionRate")}</TableHead>}
                    <TableHead>{t("agentsForm.table.totalBookings")}</TableHead>
                    <TableHead className="text-right">{t("agentsForm.table.totalRevenue")}</TableHead>
                    {canUseCommission && <TableHead className="text-right">{t("agentsForm.table.pendingCommission")}</TableHead>}
                    <TableHead>{t("agentsForm.table.status")}</TableHead>
                    <TableHead className="w-[120px]">{t("agentsForm.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canUseCommission ? 9 : 7} className="text-center py-8 text-muted-foreground">
                        {t("agentsForm.noAgentsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((agent) => (
                      <TableRow key={agent.id} className="cursor-pointer" onClick={() => navigate(`/agents/${agent.id}`)}>
                        <TableCell className="font-medium">{agent.name}</TableCell>
                        <TableCell>{agent.email || "—"}</TableCell>
                        <TableCell>{agent.phone || "—"}</TableCell>
                        {canUseCommission && (
                          <TableCell>{agent.commissionRate}%</TableCell>
                        )}
                        <TableCell>{agent.totalBookings ?? 0}</TableCell>
                        <TableCell className="text-right">৳{(agent.totalRevenue ?? 0).toLocaleString()}</TableCell>
                        {canUseCommission && (
                          <TableCell className="text-right">৳{(agent.pendingCommission ?? 0).toLocaleString()}</TableCell>
                        )}
                        <TableCell>
                          <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                            {t(`agentsForm.statuses.${agent.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" title={t("agentsForm.view")} onClick={() => navigate(`/agents/${agent.id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <PermissionGate module="agents" action="edit">
                              <Button variant="ghost" size="icon" title={t("agentsForm.edit")} onClick={() => openEdit(agent)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate module="agents" action="delete">
                              <Button variant="ghost" size="icon" title={t("agentsForm.delete")} onClick={() => handleDelete(agent.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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

export default Agents;
