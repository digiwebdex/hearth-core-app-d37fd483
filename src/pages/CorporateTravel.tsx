import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useHumanError } from "@/hooks/useHumanError";
import { usePermissions } from "@/hooks/usePermissions";
import { clientApi, type CorporateSummary, type Client } from "@/lib/api";
import { Building2, Eye, Plus, Pencil, CreditCard, CalendarClock } from "lucide-react";

const money = (n: number) => `৳${(n || 0).toLocaleString()}`;

const emptyForm = {
  companyName: "", name: "", phone: "", email: "", address: "",
  creditLimit: "", contractRef: "", contractExpiry: "",
};

const CorporateTravel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatError, errorTitle } = useHumanError();
  const { can } = usePermissions();
  const canCreate = can("clients", "create");
  const canEdit = can("clients", "edit");

  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [summary, setSummary] = useState<CorporateSummary | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, list] = await Promise.all([
        clientApi.getCorporateSummary(month).catch(() => null),
        clientApi.listCorporate().catch(() => [] as Client[]),
      ]);
      setSummary(sum);
      setClients(list);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      companyName: c.companyName || "",
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      creditLimit: c.creditLimit != null ? String(c.creditLimit) : "",
      contractRef: c.contractRef || "",
      contractExpiry: c.contractExpiry || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.companyName.trim() && !form.name.trim()) {
      toast({ variant: "destructive", title: errorTitle(), description: t("corporate.nameRequired") });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientType: "corporate" as const,
        companyName: form.companyName.trim() || form.name.trim(),
        name: form.name.trim() || form.companyName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim() || undefined,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
        contractRef: form.contractRef.trim() || undefined,
        contractExpiry: form.contractExpiry || undefined,
      };
      if (editing) {
        await clientApi.update(editing.id, payload);
        toast({ title: t("corporate.updated") });
      } else {
        await clientApi.create(payload);
        toast({ title: t("corporate.created") });
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast({ variant: "destructive", title: errorTitle(), description: formatError(err) });
    } finally {
      setSaving(false);
    }
  };

  const totals = summary?.totals;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-7 w-7" />
              {t("corporate.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("corporate.subtitle")}</p>
          </div>
          {canCreate && (
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              {t("corporate.new")}
            </Button>
          )}
        </div>

        {loading ? (
          <LoadingState />
        ) : (
          <Tabs defaultValue="clients" className="space-y-4">
            <TabsList>
              <TabsTrigger value="clients">{t("corporate.clientsTab")} ({clients.length})</TabsTrigger>
              <TabsTrigger value="billing">{t("corporate.billingTab")}</TabsTrigger>
            </TabsList>

            {/* ── Clients management ── */}
            <TabsContent value="clients">
              {clients.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title={t("corporate.emptyTitle")}
                  description={t("corporate.emptyDesc")}
                  action={canCreate ? <Button onClick={openNew}>{t("corporate.addCorporateClient")}</Button> : undefined}
                />
              ) : (
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("corporate.colCompany")}</TableHead>
                          <TableHead>{t("corporate.colContact")}</TableHead>
                          <TableHead className="text-right">{t("corporate.colCreditLimit")}</TableHead>
                          <TableHead>{t("corporate.colContract")}</TableHead>
                          <TableHead className="text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="font-medium">{c.companyName || c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.name}</div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.phone || c.email || "—"}</TableCell>
                            <TableCell className="text-right">
                              {c.creditLimit != null ? (
                                <span className="inline-flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" />{money(c.creditLimit)}</span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.contractExpiry ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <CalendarClock className="h-3.5 w-3.5" />{c.contractExpiry}
                                </span>
                              ) : (c.contractRef || "—")}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/clients/${c.id}`)} aria-label={t("corporate.view")}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canEdit && (
                                <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label={t("common.edit")}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Billing summary (existing) ── */}
            <TabsContent value="billing" className="space-y-4">
              <div className="flex justify-end">
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
              </div>
              {!summary || summary.clients.length === 0 ? (
                <EmptyState icon={Building2} title={t("corporate.emptyTitle")} description={t("corporate.emptyDesc")} />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: t("corporate.kpiClients"), value: totals!.clients },
                      { label: t("corporate.kpiInvoices"), value: totals!.invoiceCount },
                      { label: t("corporate.kpiBilled"), value: money(totals!.monthTotal) },
                      { label: t("corporate.kpiDue"), value: money(totals!.monthDue), amber: true },
                    ].map((kpi) => (
                      <Card key={kpi.label}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className={`text-2xl font-bold ${kpi.amber ? "text-amber-600" : ""}`}>{kpi.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("corporate.colCompany")}</TableHead>
                            <TableHead>{t("corporate.colContact")}</TableHead>
                            <TableHead className="text-right">{t("corporate.colInvoices")}</TableHead>
                            <TableHead className="text-right">{t("corporate.colBilled")}</TableHead>
                            <TableHead className="text-right">{t("corporate.colPaid")}</TableHead>
                            <TableHead className="text-right">{t("corporate.colDue")}</TableHead>
                            <TableHead className="text-right">{t("corporate.colOpen")}</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.clients.map((row) => (
                            <TableRow key={row.clientId}>
                              <TableCell>
                                <div className="font-medium">{row.companyName}</div>
                                <div className="text-xs text-muted-foreground">{row.name}</div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.phone || row.email || "—"}</TableCell>
                              <TableCell className="text-right">{row.invoiceCount}</TableCell>
                              <TableCell className="text-right">{money(row.monthTotal)}</TableCell>
                              <TableCell className="text-right text-green-600">{money(row.monthPaid)}</TableCell>
                              <TableCell className="text-right text-amber-600">{money(row.monthDue)}</TableCell>
                              <TableCell className="text-right">{row.openInvoices}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => navigate(`/clients/${row.clientId}`)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("corporate.editClient") : t("corporate.new")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t("corporate.fCompany")}</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div>
              <Label>{t("corporate.fContactName")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t("corporate.fPhone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>{t("corporate.fEmail")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t("corporate.fCreditLimit")}</Label>
              <Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
            </div>
            <div>
              <Label>{t("corporate.fContractRef")}</Label>
              <Input value={form.contractRef} onChange={(e) => setForm({ ...form, contractRef: e.target.value })} />
            </div>
            <div>
              <Label>{t("corporate.fContractExpiry")}</Label>
              <Input type="date" value={form.contractExpiry} onChange={(e) => setForm({ ...form, contractExpiry: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("corporate.fAddress")}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CorporateTravel;
