import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MessageSquare, Plus, Pencil, Trash2, Eye, Copy, Loader2, Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type SmsTemplate, type SmsTemplateType,
  TEMPLATE_VARIABLES, DEFAULT_TEMPLATES,
  extractVariables, renderTemplate,
  smsTemplateApi,
} from "@/lib/smsTemplateApi";

const TYPE_COLORS: Record<SmsTemplateType, string> = {
  booking: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  payment: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  otp: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  reminder: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  custom: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

const emptyForm = {
  name: "",
  type: "booking" as SmsTemplateType,
  message: "",
  variables: [] as string[],
  isActive: true,
};

const AdminSmsTemplates = () => {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<SmsTemplate | null>(null);
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").toLowerCase().startsWith("bn");
  const tx = (en: string, bn: string) => (isBn ? bn : en);

  const TYPE_LABELS: Record<SmsTemplateType, string> = {
    booking: tx("Booking", "বুকিং"),
    payment: tx("Payment", "পেমেন্ট"),
    otp: "OTP",
    reminder: tx("Reminder", "রিমাইন্ডার"),
    custom: tx("Custom", "কাস্টম"),
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await smsTemplateApi.list();
      setTemplates(data);
    } catch {
      const fallback: SmsTemplate[] = DEFAULT_TEMPLATES.map((t, i) => ({
        ...t,
        id: `tpl-${i + 1}`,
        createdAt: new Date().toISOString(),
      }));
      setTemplates(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleOpen = (template?: SmsTemplate) => {
    if (template) {
      setEditId(template.id);
      setForm({
        name: template.name,
        type: template.type,
        message: template.message,
        variables: template.variables,
        isActive: template.isActive,
      });
    } else {
      setEditId(null);
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.message.trim()) {
      toast({ title: tx("Name and message are required", "নাম এবং বার্তা আবশ্যক"), variant: "destructive" });
      return;
    }

    const vars = extractVariables(form.message);
    const payload = { ...form, variables: vars };

    setSaving(true);
    try {
      if (editId) {
        await smsTemplateApi.update(editId, payload);
        setTemplates((prev) => prev.map((t) => (t.id === editId ? { ...t, ...payload } : t)));
      } else {
        const created = await smsTemplateApi.create(payload);
        setTemplates((prev) => [...prev, created]);
      }
      toast({ title: editId ? tx("Template updated", "টেমপ্লেট আপডেট হয়েছে") : tx("Template created", "টেমপ্লেট তৈরি হয়েছে") });
    } catch {
      if (editId) {
        setTemplates((prev) => prev.map((t) => (t.id === editId ? { ...t, ...payload } : t)));
      } else {
        setTemplates((prev) => [...prev, { ...payload, id: `tpl-${Date.now()}`, createdAt: new Date().toISOString() }]);
      }
      toast({ title: editId ? tx("Template updated", "টেমপ্লেট আপডেট হয়েছে") : tx("Template created", "টেমপ্লেট তৈরি হয়েছে") });
    } finally {
      setSaving(false);
      setDialogOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await smsTemplateApi.delete(id);
    } catch { /* offline */ }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast({ title: tx("Template deleted", "টেমপ্লেট মুছে ফেলা হয়েছে") });
  };

  const handlePreview = (template: SmsTemplate) => {
    setSelectedTemplate(template);
    const sampleData: Record<string, string> = {};
    const availableVars = TEMPLATE_VARIABLES[template.type] || [];
    template.variables.forEach((v) => {
      const found = availableVars.find((av) => av.key === v);
      sampleData[v] = found ? `[${found.label}]` : `[${v}]`;
    });
    setPreviewData(sampleData);
    setPreviewOpen(true);
  };

  const insertVariable = (key: string) => {
    setForm((f) => ({ ...f, message: f.message + `{{${key}}}` }));
  };

  const filtered = templates.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.message.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || t.type === filterType;
    return matchSearch && matchType;
  });

  const detectedVariables = extractVariables(form.message).map((v) => `{{${v}}}`).join(", ") || tx("none", "কোনোটি নেই");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <MessageSquare className="h-8 w-8" /> {tx("SMS Templates", "এসএমএস টেমপ্লেট")}
            </h1>
            <p className="text-muted-foreground">{tx("Manage SMS message templates with dynamic variables", "ডাইনামিক ভ্যারিয়েবলসহ এসএমএস বার্তার টেমপ্লেট পরিচালনা করুন")}</p>
          </div>
          <Button onClick={() => handleOpen()}>
            <Plus className="mr-2 h-4 w-4" /> {tx("New Template", "নতুন টেমপ্লেট")}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={tx("Search templates...", "টেমপ্লেট খুঁজুন...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder={tx("Filter type", "ধরন ফিল্টার")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All Types", "সব ধরন")}</SelectItem>
              <SelectItem value="booking">{TYPE_LABELS.booking}</SelectItem>
              <SelectItem value="payment">{TYPE_LABELS.payment}</SelectItem>
              <SelectItem value="otp">OTP</SelectItem>
              <SelectItem value="reminder">{TYPE_LABELS.reminder}</SelectItem>
              <SelectItem value="custom">{TYPE_LABELS.custom}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{tx("No templates found", "কোনো টেমপ্লেট পাওয়া যায়নি")}</p>
                <p className="text-sm">{tx("Create your first SMS template to get started.", "শুরু করতে আপনার প্রথম এসএমএস টেমপ্লেট তৈরি করুন।")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Name", "নাম")}</TableHead>
                    <TableHead>{tx("Type", "ধরন")}</TableHead>
                    <TableHead className="hidden md:table-cell">{tx("Message Preview", "বার্তার প্রিভিউ")}</TableHead>
                    <TableHead>{tx("Variables", "ভ্যারিয়েবল")}</TableHead>
                    <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
                    <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tpl) => (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-medium">{tpl.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={TYPE_COLORS[tpl.type]}>
                          {TYPE_LABELS[tpl.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[300px]">
                        <p className="text-sm text-muted-foreground truncate">{tpl.message}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tpl.variables.slice(0, 3).map((v) => (
                            <Badge key={v} variant="outline" className="text-xs font-mono">
                              {`{{${v}}}`}
                            </Badge>
                          ))}
                          {tpl.variables.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{tpl.variables.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tpl.isActive ? "default" : "secondary"}>
                          {tpl.isActive ? tx("Active", "সক্রিয়") : tx("Inactive", "নিষ্ক্রিয়")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handlePreview(tpl)} title={tx("Preview", "প্রিভিউ")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpen(tpl)} title={tx("Edit", "এডিট")}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tpl.id)} title={tx("Delete", "মুছুন")} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? tx("Edit Template", "টেমপ্লেট এডিট করুন") : tx("New SMS Template", "নতুন এসএমএস টেমপ্লেট")}</DialogTitle>
              <DialogDescription>
                {tx("Use {{variable}} syntax to insert dynamic content into your messages.", "আপনার বার্তায় ডাইনামিক কনটেন্ট যোগ করতে {{variable}} সিনট্যাক্স ব্যবহার করুন।")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tx("Template Name", "টেমপ্লেট নাম")}</Label>
                  <Input placeholder={tx("e.g. Booking Confirmation", "যেমন: বুকিং কনফার্মেশন")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{tx("Type", "ধরন")}</Label>
                  <Select value={form.type} onValueChange={(v: SmsTemplateType) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="booking">{TYPE_LABELS.booking}</SelectItem>
                      <SelectItem value="payment">{TYPE_LABELS.payment}</SelectItem>
                      <SelectItem value="otp">OTP</SelectItem>
                      <SelectItem value="reminder">{TYPE_LABELS.reminder}</SelectItem>
                      <SelectItem value="custom">{TYPE_LABELS.custom}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{tx("Available Variables", "উপলব্ধ ভ্যারিয়েবল")}</Label>
                <p className="text-xs text-muted-foreground">{tx("Click to insert into message", "বার্তায় যুক্ত করতে ক্লিক করুন")}</p>
                <div className="flex flex-wrap gap-2">
                  {(TEMPLATE_VARIABLES[form.type] || []).map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs font-mono h-7"
                      onClick={() => insertVariable(v.key)}
                      title={v.label}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      {`{{${v.key}}}`}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{tx("Message Template", "বার্তার টেমপ্লেট")}</Label>
                <Textarea
                  rows={4}
                  placeholder={tx("e.g. Dear {{name}}, your booking ({{bookingId}}) is confirmed.", "যেমন: প্রিয় {{name}}, আপনার বুকিং ({{bookingId}}) কনফার্ম হয়েছে।")}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {form.message.length} {tx("characters", "অক্ষর")} · {tx("Detected variables", "শনাক্ত ভ্যারিয়েবল")}: {detectedVariables}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label>{tx("Active", "সক্রিয়")}</Label>
              </div>

              {form.message && (
                <Card className="bg-muted/50">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">{tx("Live Preview", "লাইভ প্রিভিউ")}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-sm">
                      {renderTemplate(form.message, Object.fromEntries(
                        extractVariables(form.message).map((v) => {
                          const found = (TEMPLATE_VARIABLES[form.type] || []).find((tv) => tv.key === v);
                          return [v, found ? found.label : v];
                        })
                      ))}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editId ? tx("Update Template", "টেমপ্লেট আপডেট করুন") : tx("Create Template", "টেমপ্লেট তৈরি করুন")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{tx("Template Preview", "টেমপ্লেট প্রিভিউ")}</DialogTitle>
              <DialogDescription>
                {tx("Fill in sample values to see how the SMS will look.", "এসএমএসটি কেমন দেখাবে তা দেখতে নমুনা ভ্যালু দিন।")}
              </DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={TYPE_COLORS[selectedTemplate.type]}>
                    {TYPE_LABELS[selectedTemplate.type]}
                  </Badge>
                  <span className="font-medium">{selectedTemplate.name}</span>
                </div>

                <div className="space-y-3">
                  {selectedTemplate.variables.map((v) => {
                    const found = (TEMPLATE_VARIABLES[selectedTemplate.type] || []).find((tv) => tv.key === v);
                    return (
                      <div key={v} className="space-y-1">
                        <Label className="text-xs">{found?.label || v} <span className="font-mono text-muted-foreground">{`{{${v}}}`}</span></Label>
                        <Input
                          value={previewData[v] || ""}
                          onChange={(e) => setPreviewData({ ...previewData, [v]: e.target.value })}
                          placeholder={found?.label || v}
                          className="h-8 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>

                <Card className="bg-muted/50">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">{tx("Rendered SMS", "রেন্ডার করা এসএমএস")}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-sm whitespace-pre-wrap">
                      {renderTemplate(selectedTemplate.message, previewData)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {renderTemplate(selectedTemplate.message, previewData).length} {tx("characters", "অক্ষর")}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>{tx("Close", "বন্ধ করুন")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSmsTemplates;
