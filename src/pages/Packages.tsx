import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { travelPackageApi, type TravelPackage } from "@/lib/travelPackageApi";
import { SERVICE_TYPES, getServiceTypeLabel, type ServiceType } from "@/lib/serviceTypes";
import { Loader2, Plus, Package2, Save, Trash2 } from "lucide-react";

const emptyForm = {
  code: "",
  title: "",
  slug: "",
  serviceType: "tour_domestic" as ServiceType,
  summary: "",
  destination: "",
  country: "",
  durationDays: 1,
  durationNights: 0,
  basePrice: 0,
  currency: "BDT",
  status: "draft",
  isFeatured: false,
  heroImage: "",
};

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const Packages = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<TravelPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [form, setForm] = useState(emptyForm);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await travelPackageApi.list();
      setItems(data);
    } catch (err: any) {
      toast({ title: "Failed to load packages", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) return;
    setForm({
      code: selected.code || "",
      title: selected.title || "",
      slug: selected.slug || "",
      serviceType: (selected.serviceType as ServiceType) || "tour_domestic",
      summary: selected.summary || "",
      destination: selected.destination || "",
      country: selected.country || "",
      durationDays: Number(selected.durationDays || 1),
      durationNights: Number(selected.durationNights || 0),
      basePrice: Number(selected.basePrice || 0),
      currency: selected.currency || "BDT",
      status: selected.status || "draft",
      isFeatured: !!selected.isFeatured,
      heroImage: selected.heroImage || "",
    });
  }, [selected]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => filterType === "all" || item.serviceType === filterType);
  }, [items, filterType]);

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) {
      toast({ title: "Code and title are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      slug: slugify(form.slug || form.title),
      durationDays: Number(form.durationDays || 1),
      durationNights: Number(form.durationNights || 0),
      basePrice: Number(form.basePrice || 0),
    };

    try {
      if (selectedId) {
        const updated = await travelPackageApi.update(selectedId, payload);
        setItems((prev) => prev.map((item) => (item.id === selectedId ? updated : item)));
        toast({ title: "Package updated" });
      } else {
        const created = await travelPackageApi.create(payload);
        setItems((prev) => [created, ...prev]);
        setSelectedId(created.id);
        toast({ title: "Package created" });
      }
    } catch (err: any) {
      toast({ title: "Failed to save package", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await travelPackageApi.delete(selectedId);
      setItems((prev) => prev.filter((item) => item.id !== selectedId));
      resetForm();
      toast({ title: "Package deleted" });
    } catch (err: any) {
      toast({ title: "Failed to delete package", description: err.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Package2 className="h-6 w-6" /> Packages</h1>
            <p className="text-sm text-muted-foreground">Manage reusable package templates for tours and travel services.</p>
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Filter by type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All service types</SelectItem>
                {SERVICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{getServiceTypeLabel(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetForm}><Plus className="mr-2 h-4 w-4" />New Package</Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Package Catalog</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Base Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No packages found</TableCell></TableRow>
                    ) : visibleItems.map((item) => (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.title}</TableCell>
                        <TableCell><Badge variant="outline">{getServiceTypeLabel(item.serviceType)}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{item.status || "draft"}</Badge></TableCell>
                        <TableCell className="text-right">{item.currency || "BDT"} {Number(item.basePrice || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selectedId ? "Edit Package" : "Create Package"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Package Code</Label>
                  <Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="TH-6D-001" />
                </div>
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select value={form.serviceType} onValueChange={(value: ServiceType) => setForm((prev) => ({ ...prev, serviceType: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{getServiceTypeLabel(type)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Package Title</Label>
                <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value, slug: prev.slug || slugify(e.target.value) }))} placeholder="Thailand Family Tour" />
              </div>

              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))} placeholder="thailand-family-tour" />
              </div>

              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea rows={3} value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} placeholder="Short summary for sales and website use" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Input value={form.destination} onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value }))} placeholder="Bangkok & Pattaya" />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} placeholder="Thailand" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Duration (Days)</Label>
                  <Input type="number" min={1} value={form.durationDays} onChange={(e) => setForm((prev) => ({ ...prev, durationDays: Number(e.target.value || 1) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Duration (Nights)</Label>
                  <Input type="number" min={0} value={form.durationNights} onChange={(e) => setForm((prev) => ({ ...prev, durationNights: Number(e.target.value || 0) }))} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Base Price</Label>
                  <Input type="number" min={0} value={form.basePrice} onChange={(e) => setForm((prev) => ({ ...prev, basePrice: Number(e.target.value || 0) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hero Image URL</Label>
                  <Input value={form.heroImage} onChange={(e) => setForm((prev) => ({ ...prev, heroImage: e.target.value }))} placeholder="https://..." />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {selectedId ? "Update Package" : "Create Package"}
                </Button>
                {selectedId ? (
                  <Button variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Packages;
