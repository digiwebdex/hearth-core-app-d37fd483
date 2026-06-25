import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  whatsappTemplateApi,
  DEFAULT_WHATSAPP_TEMPLATES,
  type WhatsAppTemplate,
} from "@/lib/platformAdminApi";

const emptyForm = {
  name: "",
  type: "subscriptionRenewal",
  message: "",
  metaTemplateName: "",
  isActive: true,
};

const AdminWhatsAppTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await whatsappTemplateApi.list();
      setTemplates(data.length ? data : DEFAULT_WHATSAPP_TEMPLATES.map((t, i) => ({ ...t, id: `default-${i}`, createdAt: new Date().toISOString() })));
    } catch {
      setTemplates(DEFAULT_WHATSAPP_TEMPLATES.map((t, i) => ({ ...t, id: `default-${i}`, createdAt: new Date().toISOString() })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (t: WhatsAppTemplate) => {
    setForm({
      name: t.name,
      type: t.type,
      message: t.message,
      metaTemplateName: t.metaTemplateName || "",
      isActive: t.isActive,
    });
    setEditId(t.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        metaTemplateName: form.metaTemplateName.trim() || null,
      };
      if (editId && !editId.startsWith("default-")) {
        await whatsappTemplateApi.update(editId, payload);
      } else {
        await whatsappTemplateApi.create(payload);
      }
      toast({ title: "Template saved" });
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Save failed", description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith("default-")) return;
    try {
      await whatsappTemplateApi.delete(id);
      toast({ title: "Template deleted" });
      load();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Delete failed", description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="h-7 w-7" />
              WhatsApp Templates
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Renewal and payment reminder messages. Use Meta template name when WHATSAPP_PROVIDER=meta.
            </p>
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />New template</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Meta template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.metaTemplateName || "—"}</TableCell>
                      <TableCell><Badge variant={t.isActive ? "default" : "secondary"}>{t.isActive ? "Active" : "Off"}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        {!t.id.startsWith("default-") ? (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscriptionRenewal">Subscription renewal</SelectItem>
                    <SelectItem value="subscriptionExpiring">Subscription expiring</SelectItem>
                    <SelectItem value="paymentReminder">Payment reminder</SelectItem>
                    <SelectItem value="trialDripLast">Trial last day</SelectItem>
                    <SelectItem value="passportExpiryAlert">Passport expiry alert</SelectItem>
                    <SelectItem value="passportExpiryAlertBn">Passport expiry (BN)</SelectItem>
                    <SelectItem value="travelDepartureReminder">Travel departure reminder</SelectItem>
                    <SelectItem value="travelDepartureReminderBn">Travel departure (BN)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Message</Label><Textarea rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Meta template name (optional)</Label><Input value={form.metaTemplateName} onChange={(e) => setForm((f) => ({ ...f, metaTemplateName: e.target.value }))} placeholder="approved_template_name" /></div>
              <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} /><Label>Active</Label></div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminWhatsAppTemplates;
