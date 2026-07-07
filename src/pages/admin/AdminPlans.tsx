import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import AdminConfigNotice from "@/components/admin/AdminConfigNotice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Check, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PLANS, getLimitLabel } from "@/lib/plans";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  yearlyPrice: number;
  trialDays: number;
  maxUsers: number;
  maxBranches: number;
  maxDomains: number;
  maxSmsPerMonth: number;
  maxStorageMB: number;
  features: string;
  paymentGateways: string[];
  hasCustomDomain: boolean;
  hasSmsIntegration: boolean;
  hasWhatsApp: boolean;
  hasEmailNotifications: boolean;
  hasAgentCommission: boolean;
  hasAutomation: boolean;
  hasAdvancedAutomation: boolean;
  hasMarketingTools: boolean;
  hasHrPayroll: boolean;
  hasAdvancedAnalytics: boolean;
  hasRefundSystem: boolean;
  hasApiAccess: boolean;
  hasWhiteLabel: boolean;
  hasMarketplace: boolean;
  hasHajjUmrah: boolean;
  hasPrioritySupport: boolean;
  active: boolean;
}

const defaultPlans: Plan[] = PLANS.map((p) => ({
  id: crypto.randomUUID(),
  name: p.name,
  slug: p.id,
  price: p.price === -1 ? 0 : p.price,
  yearlyPrice: p.yearlyPrice === -1 ? 0 : p.yearlyPrice,
  trialDays: p.trialDays,
  maxUsers: p.maxUsers,
  maxBranches: p.maxBranches,
  maxDomains: p.maxDomains,
  maxSmsPerMonth: p.maxSmsPerMonth,
  maxStorageMB: p.maxStorageMB,
  features: p.features.join(", "),
  paymentGateways: p.paymentGateways,
  hasCustomDomain: p.hasCustomDomain,
  hasSmsIntegration: p.hasSmsIntegration,
  hasWhatsApp: p.hasWhatsApp,
  hasEmailNotifications: p.hasEmailNotifications,
  hasAgentCommission: p.hasAgentCommission,
  hasAutomation: p.hasAutomation,
  hasAdvancedAutomation: p.hasAdvancedAutomation,
  hasMarketingTools: p.hasMarketingTools,
  hasHrPayroll: p.hasHrPayroll,
  hasAdvancedAnalytics: p.hasAdvancedAnalytics,
  hasRefundSystem: p.hasRefundSystem,
  hasApiAccess: p.hasApiAccess,
  hasWhiteLabel: p.hasWhiteLabel,
  hasMarketplace: p.hasMarketplace,
  hasHajjUmrah: p.hasHajjUmrah,
  hasPrioritySupport: p.hasPrioritySupport,
  active: true,
}));

const emptyForm: Omit<Plan, "id"> = {
  name: "", slug: "", price: 0, yearlyPrice: 0, trialDays: 14,
  maxUsers: 0, maxBranches: 1, maxDomains: 0,
  maxSmsPerMonth: 0, maxStorageMB: 100,
  features: "", paymentGateways: ["manual"],
  hasCustomDomain: false, hasSmsIntegration: false, hasWhatsApp: false,
  hasEmailNotifications: false, hasAgentCommission: false, hasAutomation: false,
  hasAdvancedAutomation: false, hasMarketingTools: false, hasHrPayroll: false,
  hasAdvancedAnalytics: false, hasRefundSystem: false, hasApiAccess: false,
  hasWhiteLabel: false, hasMarketplace: false, hasHajjUmrah: false, hasPrioritySupport: false,
  active: true,
};

const LIMIT_KEYS = [
  "maxUsers", "maxBranches", "maxDomains", "maxSmsPerMonth", "maxStorageMB",
] as const;

const FEATURE_KEYS = [
  "hasCustomDomain", "hasEmailNotifications", "hasSmsIntegration", "hasWhatsApp",
  "hasAgentCommission", "hasAutomation", "hasAdvancedAutomation", "hasMarketingTools",
  "hasHrPayroll", "hasAdvancedAnalytics", "hasRefundSystem", "hasApiAccess",
  "hasWhiteLabel", "hasMarketplace", "hasHajjUmrah", "hasPrioritySupport",
] as const;

const GATEWAYS = ["manual", "sslcommerz", "bkash", "custom"] as const;

const AdminPlans = () => {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>(defaultPlans);
  const [form, setForm] = useState<Omit<Plan, "id">>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setPlans((prev) => prev.map((p) => p.id === editingId ? { ...p, ...form } : p));
      toast({ title: t("adminPlans.toast.updated"), description: "Preview only — update src/lib/plans.ts to change live pricing." });
    } else {
      setPlans((prev) => [...prev, { ...form, id: crypto.randomUUID() }]);
      toast({ title: t("adminPlans.toast.created"), description: "Preview only — update src/lib/plans.ts to change live pricing." });
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (plan: Plan) => {
    const { id, ...rest } = plan;
    setForm(rest);
    setEditingId(plan.id);
    setDialogOpen(true);
  };

  const toggleActive = (id: string) => {
    setPlans((prev) => prev.map((p) => p.id === id ? { ...p, active: !p.active } : p));
  };

  const toggleGateway = (gw: string) => {
    setForm((f) => ({
      ...f,
      paymentGateways: f.paymentGateways.includes(gw)
        ? f.paymentGateways.filter((g) => g !== gw)
        : [...f.paymentGateways, gw],
    }));
  };

  const yearlySavings = form.price > 0 ? (form.price * 12) - form.yearlyPrice : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminConfigNotice sourceFile="src/lib/plans.ts" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("adminPlans.title")}</h1>
            <p className="text-muted-foreground">{t("adminPlans.subtitle")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />{t("adminPlans.addPlan")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingId ? t("adminPlans.editPlan") : t("adminPlans.createPlan")}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("adminPlans.fields.name")}</Label>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminPlans.fields.slug")}</Label>
                    <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminPlans.fields.trialDays")}</Label>
                    <Input type="number" min={0} value={form.trialDays} onChange={(e) => setForm((f) => ({ ...f, trialDays: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-1"><DollarSign className="h-4 w-4" /> {t("adminPlans.fields.pricing")}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t("adminPlans.fields.monthly")}</Label>
                      <Input type="number" min={0} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminPlans.fields.yearly")}</Label>
                      <Input type="number" min={0} value={form.yearlyPrice} onChange={(e) => setForm((f) => ({ ...f, yearlyPrice: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminPlans.fields.yearlySavings")}</Label>
                      <div className="flex h-10 items-center rounded-md border px-3 text-sm font-medium text-green-600">
                        {yearlySavings > 0 ? t("adminPlans.fields.saved", { amount: yearlySavings.toLocaleString() }) : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-3">{t("adminPlans.fields.limitsTitle")}</h4>
                  <div className="grid grid-cols-4 gap-3">
                    {LIMIT_KEYS.map((key) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{t(`adminPlans.limits.${key}`)}</Label>
                        <Input type="number" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: parseInt(e.target.value) || 0 }))} className="h-8 text-sm" />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t("adminPlans.fields.featuresLabel")}</Label>
                  <Input value={form.features} onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))} placeholder={t("adminPlans.fields.featuresPlaceholder")} />
                </div>

                <div className="space-y-2">
                  <Label>{t("adminPlans.fields.paymentGateways")}</Label>
                  <div className="flex flex-wrap gap-4">
                    {GATEWAYS.map((gw) => (
                      <div key={gw} className="flex items-center gap-2">
                        <Checkbox checked={form.paymentGateways.includes(gw)} onCheckedChange={() => toggleGateway(gw)} />
                        <Label className="text-sm">{t(`adminPlans.gateways.${gw}`)}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("adminPlans.fields.featureAccess")}</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {FEATURE_KEYS.map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <Switch checked={form[key] as boolean} onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))} />
                        <Label className="text-sm">{t(`adminPlans.features.${key}`)}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
                  <Label>{t("adminPlans.fields.active")}</Label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">{editingId ? t("adminPlans.actions.update") : t("adminPlans.actions.create")}</Button>
                  <DialogClose asChild><Button type="button" variant="outline">{t("adminPlans.actions.cancel")}</Button></DialogClose>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("adminPlans.table.plans")}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminPlans.table.name")}</TableHead>
                    <TableHead className="text-right">{t("adminPlans.table.monthly")}</TableHead>
                    <TableHead className="text-right">{t("adminPlans.table.yearly")}</TableHead>
                    <TableHead className="text-center">{t("adminPlans.table.trial")}</TableHead>
                    <TableHead className="text-center">{t("adminPlans.table.users")}</TableHead>
                    <TableHead className="text-center">{t("adminPlans.table.branches", { defaultValue: "Branches" })}</TableHead>
                    <TableHead className="text-center">{t("adminPlans.table.sms")}</TableHead>
                    <TableHead className="text-center">{t("adminPlans.table.storage")}</TableHead>
                    <TableHead>{t("adminPlans.table.features")}</TableHead>
                    <TableHead>{t("adminPlans.table.status")}</TableHead>
                    <TableHead className="w-[100px]">{t("adminPlans.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p) => (
                    <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right font-semibold">৳{p.price.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">{t("adminPlans.table.yearlySuffix", { amount: p.yearlyPrice.toLocaleString() })}</TableCell>
                      <TableCell className="text-center text-sm">{p.trialDays > 0 ? t("adminPlans.table.trialDays", { days: p.trialDays }) : "—"}</TableCell>
                      <TableCell className="text-center text-sm">{getLimitLabel(p.maxUsers)}</TableCell>
                      <TableCell className="text-center text-sm">{getLimitLabel(p.maxBranches)}</TableCell>
                      <TableCell className="text-center text-sm">{getLimitLabel(p.maxSmsPerMonth)}</TableCell>
                      <TableCell className="text-center text-sm">{p.maxStorageMB === -1 ? "∞" : `${p.maxStorageMB} MB`}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.hasCustomDomain && <Badge variant="secondary" className="text-[10px]">{t("adminPlans.badges.domain")}</Badge>}
                          {p.hasSmsIntegration && <Badge variant="secondary" className="text-[10px]">{t("adminPlans.badges.sms")}</Badge>}
                          {p.hasWhatsApp && <Badge variant="secondary" className="text-[10px]">{t("adminPlans.badges.whatsapp")}</Badge>}
                          {p.hasAdvancedAnalytics && <Badge variant="secondary" className="text-[10px]">{t("adminPlans.badges.analytics")}</Badge>}
                          {p.hasApiAccess && <Badge variant="secondary" className="text-[10px]">{t("adminPlans.badges.api")}</Badge>}
                          {p.hasHajjUmrah && <Badge variant="secondary" className="text-[10px]">{t("adminPlans.badges.hajj")}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.active ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t("adminPlans.table.active")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("adminPlans.table.inactive")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleActive(p.id)}>
                            <Check className={`h-4 w-4 ${p.active ? "text-destructive" : "text-green-600"}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPlans;
