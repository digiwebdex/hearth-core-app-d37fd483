import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, CheckCircle, Eye, Search, RefreshCw, Plus, Pencil, Trash2, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminTenant } from "@/lib/api";
import ServiceCatalogPicker from "@/components/ServiceCatalogPicker";
import { buildServiceSelectionPayload, normalizeEnabledSubcategories } from "@/lib/enabledServiceTypes";

const AdminTenants = () => {
  const { t: tt } = useTranslation();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editTenant, setEditTenant] = useState<AdminTenant | null>(null);
  const [editForm, setEditForm] = useState({ name: "", subscriptionPlan: "basic", subscriptionStatus: "active", subscriptionExpiry: "", phone: "", whatsapp: "", address: "", city: "", country: "", website: "", notes: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminTenant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editSelectedSubs, setEditSelectedSubs] = useState<string[]>([]);
  const [createSelectedSubs, setCreateSelectedSubs] = useState<string[]>([]);
  const [form, setForm] = useState({
    tenantName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerPhone: "",
    ownerWhatsapp: "",
    companyPhone: "",
    companyWhatsapp: "",
    companyAddress: "",
    companyCity: "",
    companyCountry: "Bangladesh",
    companyWebsite: "",
    companyNotes: "",
    subscriptionPlan: "basic",
    subscriptionStatus: "active",
    subscriptionMonths: 1,
  });

  const resetForm = () => {
    setForm({
      tenantName: "", ownerName: "", ownerEmail: "", ownerPassword: "",
      ownerPhone: "", ownerWhatsapp: "",
      companyPhone: "", companyWhatsapp: "", companyAddress: "", companyCity: "",
      companyCountry: "Bangladesh", companyWebsite: "", companyNotes: "",
      subscriptionPlan: "basic", subscriptionStatus: "active", subscriptionMonths: 1,
    });
    setCreateSelectedSubs([]);
  };

  const handleCreate = async () => {
    if (!form.tenantName || !form.ownerName || !form.ownerEmail || !form.ownerPassword) {
      toast({ title: tt("adminTenants.toast.missingFields"), description: tt("adminTenants.toast.missingFieldsDesc"), variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await adminApi.createTenant({
        ...form,
        subscriptionMonths: Number(form.subscriptionMonths),
        ...buildServiceSelectionPayload(createSelectedSubs),
      });
      toast({ title: tt("adminTenants.toast.agencyCreated"), description: form.tenantName });
      setCreateOpen(false);
      resetForm();
      fetchTenants();
    } catch (err: any) {
      toast({ title: tt("adminTenants.toast.createFailed"), description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getTenants();
      setTenants(data);
    } catch (err: any) {
      toast({ title: tt("adminTenants.toast.loadFailed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.users?.[0]?.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleSuspend = async (tenant: AdminTenant) => {
    const newStatus = tenant.subscriptionStatus === "suspended" ? "active" : "suspended";
    try {
      await adminApi.updateTenant(tenant.id, { subscriptionStatus: newStatus } as any);
      setTenants((prev) =>
        prev.map((t) => t.id === tenant.id ? { ...t, subscriptionStatus: newStatus } : t)
      );
      toast({
        title: newStatus === "suspended" ? tt("adminTenants.toast.companySuspended") : tt("adminTenants.toast.companyReactivated"),
        description: tenant.name,
        variant: newStatus === "suspended" ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({ title: tt("adminTenants.toast.actionFailed"), description: err.message, variant: "destructive" });
    }
  };

  const openEdit = (t: AdminTenant) => {
    const owner = t.users?.find((u) => u.role === "tenant_owner" || u.role === "owner") || t.users?.[0];
    setEditTenant(t);
    setEditSelectedSubs(normalizeEnabledSubcategories(t.enabledSubcategories));
    setEditForm({
      name: t.name || "",
      subscriptionPlan: t.subscriptionPlan || "basic",
      subscriptionStatus: t.subscriptionStatus || "active",
      subscriptionExpiry: (t as any).subscriptionExpiry ? new Date((t as any).subscriptionExpiry).toISOString().slice(0, 10) : "",
      phone: (t as any).phone || "",
      whatsapp: (t as any).whatsapp || "",
      address: (t as any).address || "",
      city: (t as any).city || "",
      country: (t as any).country || "",
      website: (t as any).website || "",
      notes: (t as any).notes || "",
      ownerName: owner?.name || "",
      ownerEmail: owner?.email || "",
      ownerPassword: "",
    });
  };

  const saveEdit = async () => {
    if (!editTenant) return;
    setSavingEdit(true);
    try {
      const owner = editTenant.users?.find((u) => u.role === "tenant_owner" || u.role === "owner") || editTenant.users?.[0];
      const { ownerName, ownerEmail, ownerPassword, ...tenantPayload } = editForm as any;
      if (!tenantPayload.subscriptionExpiry) delete tenantPayload.subscriptionExpiry;
      await adminApi.updateTenant(editTenant.id, {
        ...tenantPayload,
        ...buildServiceSelectionPayload(editSelectedSubs),
      });

      const ownerPayload: { name?: string; email?: string; password?: string } = {};
      if (ownerName && ownerName !== owner?.name) ownerPayload.name = ownerName;
      if (ownerEmail && ownerEmail !== (owner?.email || "")) ownerPayload.email = ownerEmail;
      if (ownerPassword) ownerPayload.password = ownerPassword;
      if (Object.keys(ownerPayload).length > 0) {
        await adminApi.updateTenantOwner(editTenant.id, ownerPayload);
      }

      toast({ title: tt("adminTenants.toast.agencyUpdated"), description: editForm.name });
      setEditTenant(null);
      fetchTenants();
    } catch (err: any) {
      toast({ title: tt("adminTenants.toast.updateFailed"), description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteTenant(deleteTarget.id);
      toast({ title: tt("adminTenants.toast.agencyDeleted"), description: deleteTarget.name, variant: "destructive" });
      setDeleteTarget(null);
      fetchTenants();
    } catch (err: any) {
      toast({ title: tt("adminTenants.toast.deleteFailed"), description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tt("adminTenants.title")}</h1>
            <p className="text-muted-foreground">{tt("adminTenants.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" /> {tt("adminTenants.createAgency")}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{tt("adminTenants.dialog.createTitle")}</DialogTitle>
                  <DialogDescription>{tt("adminTenants.dialog.createDesc")}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{tt("adminTenants.sections.company")}</h3>
                    <div className="grid gap-2">
                      <Label>{tt("adminTenants.fields.companyName")} *</Label>
                      <Input value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} placeholder="Al-Safa Travel Agency" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.companyPhone")}</Label>
                        <Input value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} placeholder="+8801XXXXXXXXX" />
                      </div>
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.companyWhatsapp")}</Label>
                        <Input value={form.companyWhatsapp} onChange={(e) => setForm({ ...form, companyWhatsapp: e.target.value })} placeholder="+8801XXXXXXXXX" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>{tt("adminTenants.fields.address")}</Label>
                      <Input value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.city")}</Label>
                        <Input value={form.companyCity} onChange={(e) => setForm({ ...form, companyCity: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.country")}</Label>
                        <Input value={form.companyCountry} onChange={(e) => setForm({ ...form, companyCountry: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.website")}</Label>
                        <Input value={form.companyWebsite} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} placeholder={tt("adminTenants.fields.websitePlaceholder")} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{tt("adminTenants.sections.ownerAccount")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.ownerName")} *</Label>
                        <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.ownerEmail")} *</Label>
                        <Input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.ownerMobile")}</Label>
                        <Input value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} placeholder="+8801XXXXXXXXX" />
                      </div>
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.ownerWhatsapp")}</Label>
                        <Input value={form.ownerWhatsapp} onChange={(e) => setForm({ ...form, ownerWhatsapp: e.target.value })} placeholder="+8801XXXXXXXXX" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>{tt("adminTenants.fields.tempPassword")} *</Label>
                      <Input type="text" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} placeholder={tt("adminTenants.fields.passwordPlaceholder")} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{tt("adminTenants.sections.subscription")}</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.plan")}</Label>
                        <Select value={form.subscriptionPlan} onValueChange={(v) => setForm({ ...form, subscriptionPlan: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">{tt("adminTenants.plans.basic")}</SelectItem>
                            <SelectItem value="pro">{tt("adminTenants.plans.pro")}</SelectItem>
                            <SelectItem value="business">{tt("adminTenants.plans.business")}</SelectItem>
                            <SelectItem value="enterprise">{tt("adminTenants.plans.enterprise")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.status")}</Label>
                        <Select value={form.subscriptionStatus} onValueChange={(v) => setForm({ ...form, subscriptionStatus: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">{tt("adminTenants.status.active")}</SelectItem>
                            <SelectItem value="trial">{tt("adminTenants.status.trial")}</SelectItem>
                            <SelectItem value="suspended">{tt("adminTenants.status.suspended")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>{tt("adminTenants.fields.months")}</Label>
                        <Input type="number" min={1} value={form.subscriptionMonths} onChange={(e) => setForm({ ...form, subscriptionMonths: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>{tt("adminTenants.fields.notesInternal")}</Label>
                      <Input value={form.companyNotes} onChange={(e) => setForm({ ...form, companyNotes: e.target.value })} placeholder={tt("adminTenants.fields.notesPlaceholder")} />
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      {tt("settingsModules.serviceTypesLabel", { defaultValue: "Agency services" })}
                    </h3>
                    <ServiceCatalogPicker value={createSelectedSubs} onChange={setCreateSelectedSubs} compact />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>{tt("adminTenants.actions.cancel")}</Button>
                  <Button onClick={handleCreate} disabled={creating}>{creating ? tt("adminTenants.creating") : tt("adminTenants.createAgency")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={fetchTenants} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {tt("adminTenants.refresh")}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder={tt("adminTenants.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardHeader><CardTitle>{tt("adminTenants.companies", { count: filtered.length })}</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tt("adminTenants.table.company")}</TableHead>
                    <TableHead>{tt("adminTenants.table.owner")}</TableHead>
                    <TableHead>{tt("adminTenants.table.plan")}</TableHead>
                    <TableHead className="text-center">{tt("adminTenants.table.users")}</TableHead>
                    <TableHead className="text-center">{tt("adminTenants.table.bookings")}</TableHead>
                    <TableHead>{tt("adminTenants.table.status")}</TableHead>
                    <TableHead>{tt("adminTenants.table.created")}</TableHead>
                    <TableHead className="w-[200px]">{tt("adminTenants.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">{tt("adminTenants.noAgencies")}</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((tn) => {
                      const owner = tn.users?.find((u) => u.role === "tenant_owner" || u.role === "owner") || tn.users?.[0];
                      const planKey = (tn.subscriptionPlan || "free") as string;
                      const planLabel = tt(`adminTenants.plans.${planKey}`, { defaultValue: planKey });
                      return (
                        <TableRow key={tn.id} className={tn.subscriptionStatus === "suspended" ? "opacity-60" : ""}>
                          <TableCell className="font-medium">{tn.name}</TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{owner?.name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{owner?.email || "—"}</p>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="secondary">{planLabel}</Badge></TableCell>
                          <TableCell className="text-center">{tn._count?.users || 0}</TableCell>
                          <TableCell className="text-center">{tn._count?.bookings || 0}</TableCell>
                          <TableCell>
                            {tn.subscriptionStatus === "active" ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{tt("adminTenants.status.active")}</Badge>
                            ) : tn.subscriptionStatus === "suspended" ? (
                              <Badge variant="destructive">{tt("adminTenants.status.suspended")}</Badge>
                            ) : (
                              <Badge variant="secondary">{tt(`adminTenants.status.${tn.subscriptionStatus}`, { defaultValue: tn.subscriptionStatus || "—" })}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{new Date(tn.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/tenants/${tn.id}`, { state: { tenant: tn } })} title={tt("adminTenants.actions.viewDetails")}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(tn)} title={tt("adminTenants.actions.edit")}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => toggleSuspend(tn)} title={tn.subscriptionStatus === "suspended" ? tt("adminTenants.actions.reactivate") : tt("adminTenants.actions.suspend")}>
                                {tn.subscriptionStatus === "suspended" ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Ban className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(tn)} title={tt("adminTenants.actions.delete")}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editTenant} onOpenChange={(o) => !o && setEditTenant(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tt("adminTenants.dialog.editTitle")}</DialogTitle>
            <DialogDescription>{tt("adminTenants.dialog.editDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{tt("adminTenants.fields.companyName")}</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>{tt("adminTenants.fields.plan")}</Label>
                <Select value={editForm.subscriptionPlan} onValueChange={(v) => setEditForm({ ...editForm, subscriptionPlan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">{tt("adminTenants.plans.basic")}</SelectItem>
                    <SelectItem value="pro">{tt("adminTenants.plans.pro")}</SelectItem>
                    <SelectItem value="business">{tt("adminTenants.plans.business")}</SelectItem>
                    <SelectItem value="enterprise">{tt("adminTenants.plans.enterprise")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{tt("adminTenants.fields.status")}</Label>
                <Select value={editForm.subscriptionStatus} onValueChange={(v) => setEditForm({ ...editForm, subscriptionStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{tt("adminTenants.status.active")}</SelectItem>
                    <SelectItem value="trial">{tt("adminTenants.status.trial")}</SelectItem>
                    <SelectItem value="suspended">{tt("adminTenants.status.suspended")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{tt("adminTenants.fields.expiry")}</Label>
                <Input type="date" value={editForm.subscriptionExpiry} onChange={(e) => setEditForm({ ...editForm, subscriptionExpiry: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>{tt("adminTenants.fields.phone")}</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{tt("adminTenants.fields.whatsapp")}</Label><Input value={editForm.whatsapp} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{tt("adminTenants.fields.address")}</Label><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2"><Label>{tt("adminTenants.fields.city")}</Label><Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{tt("adminTenants.fields.country")}</Label><Input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{tt("adminTenants.fields.website")}</Label><Input value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{tt("adminTenants.fields.notes")}</Label><Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>

            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {tt("settingsModules.serviceTypesLabel", { defaultValue: "Agency services" })}
              </h3>
              <p className="text-sm text-muted-foreground">{tt("settingsModules.serviceTypesDesc")}</p>
              <ServiceCatalogPicker value={editSelectedSubs} onChange={setEditSelectedSubs} compact />
            </div>

            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{tt("adminTenants.sections.ownerAccount")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>{tt("adminTenants.fields.ownerName")}</Label><Input value={editForm.ownerName} onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{tt("adminTenants.fields.ownerEmail")}</Label><Input type="email" value={editForm.ownerEmail} onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })} /></div>
              </div>
              <div className="grid gap-2">
                <Label>{tt("adminTenants.fields.resetPassword")}</Label>
                <Input type="text" value={editForm.ownerPassword} onChange={(e) => setEditForm({ ...editForm, ownerPassword: e.target.value })} placeholder={tt("adminTenants.fields.resetPasswordPlaceholder")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTenant(null)} disabled={savingEdit}>{tt("adminTenants.actions.cancel")}</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>{savingEdit ? tt("adminTenants.saving") : tt("adminTenants.saveChanges")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tt("adminTenants.dialog.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              <Trans
                i18nKey="adminTenants.dialog.deleteDesc"
                values={{ name: deleteTarget?.name || "" }}
                components={{ 1: <strong /> }}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tt("adminTenants.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? tt("adminTenants.deleting") : tt("adminTenants.deletePermanently")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminTenants;