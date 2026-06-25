import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { taxRuleApi, type TaxRule } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const emptyForm = { name: "", rate: 0, type: "percentage" as "percentage" | "fixed", appliesTo: "all", isDefault: false, isActive: true };

export default function SettingsTax() {
  const { toast } = useToast();
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRules(await taxRuleApi.list());
    } catch { toast({ title: "Failed to load tax rules", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(rule: TaxRule) {
    setEditingId(rule.id);
    setForm({ name: rule.name, rate: rule.rate, type: rule.type as "percentage" | "fixed", appliesTo: rule.appliesTo, isDefault: rule.isDefault, isActive: rule.isActive });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    setSaving(true);
    try {
      if (editingId) {
        await taxRuleApi.update(editingId, form);
        toast({ title: "Tax rule updated" });
      } else {
        await taxRuleApi.create(form);
        toast({ title: "Tax rule created" });
      }
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      toast({ title: (e as Error).message || "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await taxRuleApi.delete(id);
      toast({ title: "Deleted" });
      load();
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tax / VAT Rules</h1>
            <p className="text-muted-foreground text-sm mt-1">Configure tax rates applied to invoices and quotations</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Tax Rule
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Active Tax Rules</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-muted-foreground text-sm">Loading...</p>
            ) : rules.length === 0 ? (
              <p className="p-6 text-muted-foreground text-sm">No tax rules configured. Add one to start applying tax to invoices.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Rate</th>
                    <th className="text-left px-4 py-3 font-medium">Applies To</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        {rule.name}
                        {rule.isDefault && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                      </td>
                      <td className="px-4 py-3">
                        {rule.type === "percentage" ? `${rule.rate}%` : `BDT ${rule.rate}`}
                      </td>
                      <td className="px-4 py-3 capitalize">{rule.appliesTo}</td>
                      <td className="px-4 py-3">
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(rule)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(rule.id, rule.name)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Tax Rule" : "Add Tax Rule"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Rule Name</Label>
                <Input placeholder="e.g. VAT 15%, Service Tax" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "percentage" | "fixed" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Rate {form.type === "percentage" ? "(%)" : "(BDT)"}</Label>
                  <Input type="number" min={0} step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Applies To</Label>
                <Select value={form.appliesTo} onValueChange={(v) => setForm({ ...form, appliesTo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="tour_domestic">Domestic Tours</SelectItem>
                    <SelectItem value="tour_international">International Tours</SelectItem>
                    <SelectItem value="hajj_umrah">Hajj/Umrah</SelectItem>
                    <SelectItem value="corporate">Corporate Travel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">Set as Default</p>
                  <p className="text-xs text-muted-foreground">Auto-apply to new invoices</p>
                </div>
                <Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <p className="font-medium text-sm">Active</p>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Rule"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
