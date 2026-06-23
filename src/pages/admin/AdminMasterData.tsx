import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Database, Loader2, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import {
  adminMasterDataApi,
  MASTER_DATA_CATEGORIES,
  type MasterDataCategory,
  type MasterReference,
} from "@/lib/masterDataApi";

const emptyForm = {
  code: "",
  name: "",
  nameBn: "",
  parentId: "",
  sortOrder: 0,
  isActive: true,
};

export default function AdminMasterData() {
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const tx = (en: string, bn: string) => (isBn ? bn : en);
  const { toast } = useToast();

  const [tab, setTab] = useState<MasterDataCategory>("country");
  const [items, setItems] = useState<MasterReference[]>([]);
  const [parents, setParents] = useState<MasterReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const tabConfig = useMemo(() => MASTER_DATA_CATEGORIES.find((c) => c.id === tab), [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminMasterDataApi.list(tab, search || undefined);
      setItems(data);
      if (tabConfig?.parent) {
        const p = await adminMasterDataApi.list(tabConfig.parent);
        setParents(p);
      } else {
        setParents([]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: tx("Load failed", "লোড ব্যর্থ"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tab, search, tabConfig?.parent, toast, isBn]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: MasterReference) => {
    setEditId(row.id);
    setForm({
      code: row.code || "",
      name: row.name,
      nameBn: row.nameBn || "",
      parentId: row.parentId || "",
      sortOrder: row.sortOrder || 0,
      isActive: row.isActive,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: tx("Name is required", "নাম আবশ্যক"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: tab,
        code: form.code || null,
        name: form.name.trim(),
        nameBn: form.nameBn.trim() || null,
        parentId: form.parentId || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (editId) await adminMasterDataApi.update(editId, payload);
      else await adminMasterDataApi.create(payload);
      toast({ title: tx("Saved", "সংরক্ষিত") });
      setDialogOpen(false);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: tx("Save failed", "সংরক্ষণ ব্যর্থ"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(tx("Delete this item?", "এই আইটেম মুছবেন?"))) return;
    try {
      await adminMasterDataApi.remove(id);
      toast({ title: tx("Deleted", "মুছে ফেলা হয়েছে") });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: tx("Delete failed", "মুছতে ব্যর্থ"), description: message, variant: "destructive" });
    }
  };

  const runSeed = async () => {
    setSeeding(true);
    try {
      const result = await adminMasterDataApi.seed();
      toast({
        title: tx("Default data loaded", "ডিফল্ট ডেটা লোড হয়েছে"),
        description: Object.entries(result.counts || {}).map(([k, v]) => `${k}: ${v}`).join(", "),
      });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: tx("Seed failed", "সিড ব্যর্থ"), description: message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Database className="h-8 w-8" />
              {tx("Master Reference Data", "মাস্টার রেফারেন্স ডেটা")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {tx(
                "Countries, cities, airlines, airports and more — shared across all travel agencies.",
                "দেশ, শহর, এয়ারলাইন্স, বিমানবন্দর — সব এজেন্সির জন্য সাধারণ তথ্য।",
              )}
            </p>
          </div>
          <Button variant="outline" onClick={runSeed} disabled={seeding}>
            {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {tx("Load Bangladesh defaults", "বাংলাদেশ ডিফল্ট লোড")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{tx("Catalog", "ক্যাটালগ")}</CardTitle>
            <CardDescription>
              {tx("Service categories are configured per agency in Tenants → Edit.", "সার্ভিস ক্যাটাগরি এজেন্সি অনুযায়ী Tenants → Edit থেকে সেট করুন।")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as MasterDataCategory)}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {MASTER_DATA_CATEGORIES.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} className="text-xs sm:text-sm">
                    {isBn ? c.labelBn : c.labelEn}
                  </TabsTrigger>
                ))}
              </TabsList>

              {MASTER_DATA_CATEGORIES.map((c) => (
                <TabsContent key={c.id} value={c.id} className="space-y-4 mt-4">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={tx("Search...", "খুঁজুন...")}
                        className="pl-9"
                      />
                    </div>
                    <Button size="sm" onClick={openCreate}>
                      <Plus className="mr-2 h-4 w-4" /> {tx("Add", "যোগ করুন")}
                    </Button>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tx("Code", "কোড")}</TableHead>
                          <TableHead>{tx("Name", "নাম")}</TableHead>
                          <TableHead>{tx("Name (BN)", "নাম (বাংলা)")}</TableHead>
                          {c.parent ? <TableHead>{tx("Parent", "প্যারেন্ট")}</TableHead> : null}
                          <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
                          <TableHead className="w-[100px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              {tx("No items — click Load Bangladesh defaults or Add.", "কোনো ডেটা নেই — ডিফল্ট লোড বা যোগ করুন।")}
                            </TableCell>
                          </TableRow>
                        ) : items.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.code || "—"}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-muted-foreground">{row.nameBn || "—"}</TableCell>
                            {c.parent ? <TableCell>{row.parent?.name || "—"}</TableCell> : null}
                            <TableCell>
                              <Badge variant={row.isActive ? "default" : "secondary"}>
                                {row.isActive ? tx("Active", "সক্রিয়") : tx("Off", "বন্ধ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => remove(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? tx("Edit item", "সম্পাদনা") : tx("Add item", "নতুন যোগ")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>{tx("Code (optional)", "কোড (ঐচ্ছিক)")}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BD / DAC / BG" />
            </div>
            <div className="grid gap-2">
              <Label>{tx("Name", "নাম")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>{tx("Name (Bengali)", "নাম (বাংলা)")}</Label>
              <Input value={form.nameBn} onChange={(e) => setForm({ ...form, nameBn: e.target.value })} />
            </div>
            {tabConfig?.parent ? (
              <div className="grid gap-2">
                <Label>{isBn ? MASTER_DATA_CATEGORIES.find((x) => x.id === tabConfig.parent)?.labelBn : MASTER_DATA_CATEGORIES.find((x) => x.id === tabConfig.parent)?.labelEn}</Label>
                <Select value={form.parentId || "none"} onValueChange={(v) => setForm({ ...form, parentId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder={tx("Select...", "নির্বাচন...")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {parents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <Label>{tx("Active", "সক্রিয়")}</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tx("Save", "সংরক্ষণ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
