import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  supportTicketApi,
  tenantApi,
  clientApi,
  type SupportTicket,
  type SupportTicketStatus,
  type SupportTicketPriority,
  type Client,
  type User,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Headphones, Plus, Search, CheckCircle2, User, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const BOARD_STATUSES: SupportTicketStatus[] = ["open", "assigned", "in_progress", "resolved"];

const PRIORITY_VARIANT: Record<SupportTicketPriority, "outline" | "secondary" | "default" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

const COLUMN_BORDER: Record<SupportTicketStatus, string> = {
  open: "border-slate-300",
  assigned: "border-blue-300",
  in_progress: "border-violet-300",
  resolved: "border-green-400",
  closed: "border-muted",
};

const emptyForm = {
  subject: "",
  description: "",
  priority: "medium" as SupportTicketPriority,
  category: "general",
  source: "phone",
  clientId: "",
  assignedTo: "",
};

const SupportTickets = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [items, team, clientList] = await Promise.all([
        supportTicketApi.list(),
        tenantApi.getMembers().catch(() => []),
        clientApi.list().catch(() => []),
      ]);
      setTickets(items);
      setMembers(team);
      setClients(clientList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("supportTickets.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    return tickets
      .filter((ticket) => (showClosed ? true : ticket.status !== "closed"))
      .filter((ticket) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return [
          ticket.ticketNumber,
          ticket.subject,
          ticket.clientName,
          ticket.clientPhone,
          ticket.assigneeName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [tickets, search, showClosed]);

  const grouped = useMemo(() => {
    const columns = [...BOARD_STATUSES];
    if (showClosed) columns.push("closed");
    return columns.map((status) => ({
      status,
      items: visible.filter((t) => t.status === status),
    }));
  }, [visible, showClosed]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      const created = await supportTicketApi.create({
        subject: form.subject.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: form.category,
        source: form.source,
        clientId: form.clientId || null,
        assignedTo: form.assignedTo || null,
      });
      setTickets((prev) => [created, ...prev]);
      setForm(emptyForm);
      setDialogOpen(false);
      toast({ title: t("supportTickets.created") });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("supportTickets.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const patchTicket = (updated: SupportTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleStatusChange = async (ticket: SupportTicket, status: SupportTicketStatus) => {
    try {
      const updated = await supportTicketApi.update(ticket.id, { status });
      patchTicket(updated);
      toast({ title: t("supportTickets.statusUpdated") });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("supportTickets.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleAssign = async (ticket: SupportTicket, assignedTo: string) => {
    try {
      const updated = await supportTicketApi.assign(ticket.id, assignedTo || null);
      patchTicket(updated);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("supportTickets.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleResolve = async () => {
    if (!resolveId) return;
    try {
      const updated = await supportTicketApi.resolve(resolveId, resolveNotes);
      patchTicket(updated);
      setResolveId(null);
      setResolveNotes("");
      toast({ title: t("supportTickets.resolved") });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("supportTickets.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const openCount = tickets.filter((t) => ["open", "assigned", "in_progress"].includes(t.status)).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Headphones className="h-8 w-8" />
              {t("supportTickets.title")}
            </h1>
            <p className="text-muted-foreground">{t("supportTickets.subtitle")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("supportTickets.newTicket")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("supportTickets.newTicket")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("supportTickets.subject")} *</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("supportTickets.description")}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("supportTickets.priority")}</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm((f) => ({ ...f, priority: v as SupportTicketPriority }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["low", "medium", "high", "urgent"] as const).map((p) => (
                          <SelectItem key={p} value={p}>{t(`supportTickets.priorities.${p}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("supportTickets.source")}</Label>
                    <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["phone", "email", "walk_in", "website", "internal"].map((s) => (
                          <SelectItem key={s} value={s}>{t(`supportTickets.sources.${s}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("supportTickets.client")}</Label>
                  <Select
                    value={form.clientId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, clientId: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder={t("supportTickets.clientOptional")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("supportTickets.noClient")}</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("supportTickets.assignTo")}</Label>
                  <Select
                    value={form.assignedTo || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("supportTickets.unassigned")}</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">{t("common.cancel")}</Button>
                  </DialogClose>
                  <Button type="submit" disabled={saving}>{t("supportTickets.create")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="outline">{t("supportTickets.openCount", { count: openCount })}</Badge>
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("supportTickets.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant={showClosed ? "default" : "outline"}
            onClick={() => setShowClosed((v) => !v)}
          >
            {t("supportTickets.showClosed")}
          </Button>
        </div>

        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={Headphones}
            title={t("supportTickets.emptyTitle")}
            description={t("supportTickets.emptyDesc")}
            actionLabel={t("supportTickets.newTicket")}
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {grouped.map(({ status, items }) => (
              <div
                key={status}
                className={cn(
                  "min-w-[260px] max-w-[300px] flex-shrink-0 rounded-lg border-2 bg-muted/30",
                  COLUMN_BORDER[status],
                )}
              >
                <div className="px-3 py-2 border-b bg-background/95 rounded-t-md">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{t(`supportTickets.statuses.${status}`)}</p>
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  </div>
                </div>
                <div className="p-2 space-y-2 min-h-[100px]">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{t("supportTickets.emptyColumn")}</p>
                  ) : (
                    items.map((ticket) => (
                      <Card key={ticket.id} className="shadow-sm">
                        <CardHeader className="p-3 pb-1 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                            <Badge variant={PRIORITY_VARIANT[ticket.priority]} className="text-[10px] h-5">
                              {t(`supportTickets.priorities.${ticket.priority}`)}
                            </Badge>
                          </div>
                          <CardTitle className="text-sm leading-snug">{ticket.subject}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-2">
                          {ticket.clientName ? (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {ticket.clientName}
                              {ticket.clientPhone ? (
                                <span className="inline-flex items-center gap-0.5 ml-1">
                                  <Phone className="h-3 w-3" />
                                  {ticket.clientPhone}
                                </span>
                              ) : null}
                            </p>
                          ) : null}
                          <Select
                            value={ticket.status}
                            onValueChange={(v) => handleStatusChange(ticket, v as SupportTicketStatus)}
                          >
                            <SelectTrigger className="h-7 text-[10px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {([...BOARD_STATUSES, "closed"] as SupportTicketStatus[]).map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {t(`supportTickets.statuses.${s}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={ticket.assignedTo || "__none__"}
                            onValueChange={(v) => handleAssign(ticket, v === "__none__" ? "" : v)}
                          >
                            <SelectTrigger className="h-7 text-[10px]">
                              <SelectValue placeholder={t("supportTickets.unassigned")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t("supportTickets.unassigned")}</SelectItem>
                              {members.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {ticket.status !== "resolved" && ticket.status !== "closed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-xs"
                              onClick={() => {
                                setResolveId(ticket.id);
                                setResolveNotes("");
                              }}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t("supportTickets.resolve")}
                            </Button>
                          ) : null}
                          {ticket.clientId ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full h-7 text-xs"
                              onClick={() => navigate(`/clients/${ticket.clientId}`)}
                            >
                              {t("supportTickets.viewClient")}
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!resolveId} onOpenChange={(open) => !open && setResolveId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("supportTickets.resolveTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("supportTickets.resolutionNotes")}</Label>
                <Textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  rows={4}
                  placeholder={t("supportTickets.resolutionPlaceholder")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setResolveId(null)}>{t("common.cancel")}</Button>
                <Button onClick={handleResolve}>{t("supportTickets.markResolved")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default SupportTickets;
