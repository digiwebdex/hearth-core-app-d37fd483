import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { subscriptionCouponApi, type SubscriptionCoupon } from "@/lib/platformAdminApi";
import { PLANS } from "@/lib/plans";

const emptyForm = {
  code: "",
  description: "",
  discountType: "percent" as "percent" | "fixed",
  discountValue: "10",
  maxUses: "",
  validFrom: "",
  validUntil: "",
  applicablePlans: [] as string[],
  isActive: true,
};

const AdminCoupons = () => {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<SubscriptionCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCoupons(await subscriptionCouponApi.list());
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Load failed", description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePlan = (planId: string) => {
    setForm((f) => ({
      ...f,
      applicablePlans: f.applicablePlans.includes(planId)
        ? f.applicablePlans.filter((p) => p !== planId)
        : [...f.applicablePlans, planId],
    }));
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (c: SubscriptionCoupon) => {
    setForm({
      code: c.code,
      description: c.description || "",
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      validFrom: c.validFrom ? c.validFrom.slice(0, 10) : "",
      validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
      applicablePlans: c.applicablePlans || [],
      isActive: c.isActive,
    });
    setEditId(c.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        description: form.description || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        applicablePlans: form.applicablePlans,
        isActive: form.isActive,
      };
      if (editId) await subscriptionCouponApi.update(editId, payload);
      else await subscriptionCouponApi.create(payload);
      toast({ title: "Coupon saved" });
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Save failed", description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await subscriptionCouponApi.delete(id);
      toast({ title: "Coupon deleted" });
      load();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="h-7 w-7" />Subscription coupons</h1>
            <p className="text-muted-foreground text-sm">Promo codes for plan renewal checkout.</p>
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />New coupon</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Plans</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                      <TableCell>{c.discountType === "fixed" ? `৳${c.discountValue}` : `${c.discountValue}%`}</TableCell>
                      <TableCell>{c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ""}</TableCell>
                      <TableCell className="text-xs">{c.applicablePlans.length ? c.applicablePlans.join(", ") : "All"}</TableCell>
                      <TableCell><Badge variant={c.isActive ? "default" : "secondary"}>{c.isActive ? "Active" : "Off"}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit coupon" : "New coupon"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} disabled={!!editId} /></div>
              <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.discountType} onValueChange={(v: "percent" | "fixed") => setForm((f) => ({ ...f, discountType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed (BDT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Value</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Valid from</Label><Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Valid until</Label><Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Max uses (optional)</Label><Input type="number" value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Applicable plans (empty = all)</Label>
                <div className="flex flex-wrap gap-2">
                  {PLANS.filter((p) => p.id !== "free").map((p) => (
                    <Button key={p.id} type="button" size="sm" variant={form.applicablePlans.includes(p.id) ? "default" : "outline"} onClick={() => togglePlan(p.id)}>
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /><Label>Active</Label></div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminCoupons;
