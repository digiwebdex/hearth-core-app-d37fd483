import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  travelPackageApi,
  type TravelPackage,
  type TravelPackageDay,
  type TravelPackageInclusion,
  type TravelPackageMedia,
  type TravelPackagePricing,
} from "@/lib/travelPackageApi";
import { SERVICE_TYPES, getServiceTypeLabel, type ServiceType } from "@/lib/serviceTypes";
import { ArrowRight, Loader2, Moon, Package2, Plus, Save, Trash2 } from "lucide-react";

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

const blankDay = (dayNumber: number): TravelPackageDay => ({
  dayNumber,
  title: `Day ${dayNumber}`,
  description: "",
  overnightLocation: "",
});

const blankInclusion = (type: "included" | "excluded", sortOrder: number): TravelPackageInclusion => ({
  type,
  label: "",
  sortOrder,
});

const blankPricing = (): TravelPackagePricing => ({
  label: "Standard",
  travelerMin: 1,
  travelerMax: null,
  price: 0,
  currency: "BDT",
});

const blankMedia = (sortOrder: number): TravelPackageMedia => ({
  url: "",
  altText: "",
  sortOrder,
});

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
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [items, setItems] = useState<TravelPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [form, setForm] = useState(emptyForm);
  const [days, setDays] = useState<TravelPackageDay[]>([]);
  const [inclusions, setInclusions] = useState<TravelPackageInclusion[]>([]);
  const [pricing, setPricing] = useState<TravelPackagePricing[]>([]);
  const [media, setMedia] = useState<TravelPackageMedia[]>([]);

  const text = {
    loadFailed: isBn ? "প্যাকেজ লোড করা যায়নি" : "Failed to load packages",
    loadDetailsFailed: isBn ? "প্যাকেজ ডিটেইল লোড করা যায়নি" : "Failed to load package details",
    saveFailed: isBn ? "প্যাকেজ সেভ করা যায়নি" : "Failed to save package",
    deleteFailed: isBn ? "প্যাকেজ ডিলিট করা যায়নি" : "Failed to delete package",
    required: isBn ? "কোড এবং শিরোনাম আবশ্যক" : "Code and title are required",
    created: isBn ? "প্যাকেজ তৈরি হয়েছে" : "Package created",
    updated: isBn ? "প্যাকেজ আপডেট হয়েছে" : "Package updated",
    deleted: isBn ? "প্যাকেজ ডিলিট হয়েছে" : "Package deleted",
    pageTitle: isBn ? "প্যাকেজ ও সার্ভিসেস" : "Packages & Services",
    pageSubtitle: isBn ? "ট্যুর, হজ্জ-উমরাহ, ভিসা, টিকেট এবং অন্যান্য সার্ভিসের reusable template এখানে ম্যানেজ করুন।" : "Manage reusable templates for tours, Hajj/Umrah, visa, tickets, and other travel services here.",
    migrationTitle: isBn ? "নেভিগেশন মার্জ আপডেট" : "Navigation merge update",
    migrationText: isBn ? "বাম পাশের মেনুতে এখন আলাদা Hajj & Umrah item দেখানো হচ্ছে না। Hajj/Umrah package template এখানেই ম্যানেজ করুন। পুরনো pilgrim/group/payment operations এখনো legacy page-এ আছে।" : "The separate Hajj & Umrah sidebar item is now hidden. Manage Hajj/Umrah package templates here. The old pilgrim/group/payment operations are still available on the legacy page.",
    legacyButton: isBn ? "লেগেসি হজ্জ অপারেশনস" : "Legacy Hajj Operations",
    newPackage: isBn ? "নতুন সার্ভিস" : "New Service",
    filterPlaceholder: isBn ? "সার্ভিস টাইপ ফিল্টার" : "Filter by service type",
    allTypes: isBn ? "সব সার্ভিস টাইপ" : "All service types",
    catalog: isBn ? "সার্ভিস ক্যাটালগ" : "Service Catalog",
    noPackages: isBn ? "কোনো সার্ভিস পাওয়া যায়নি" : "No packages found",
    selected: isBn ? "নির্বাচিত" : "Selected",
    draft: isBn ? "ড্রাফট" : "Draft",
    editService: isBn ? "সার্ভিস এডিট করুন" : "Edit Service",
    createService: isBn ? "নতুন সার্ভিস তৈরি করুন" : "Create Service",
    basic: isBn ? "বেসিক" : "Basic",
    itinerary: isBn ? "ইটিনেরারি" : "Itinerary",
    inclusions: isBn ? "ইনক্লুশন" : "Inclusions",
    pricing: isBn ? "প্রাইসিং" : "Pricing",
    media: isBn ? "মিডিয়া" : "Media",
    packageCode: isBn ? "সার্ভিস কোড" : "Service Code",
    serviceType: isBn ? "সার্ভিস টাইপ" : "Service Type",
    packageTitle: isBn ? "সার্ভিস শিরোনাম" : "Service Title",
    summary: isBn ? "সারাংশ" : "Summary",
    destination: isBn ? "ডেস্টিনেশন" : "Destination",
    country: isBn ? "দেশ" : "Country",
    days: isBn ? "দিন" : "Days",
    nights: isBn ? "রাত" : "Nights",
    basePrice: isBn ? "বেস প্রাইস" : "Base Price",
    status: isBn ? "স্ট্যাটাস" : "Status",
    update: isBn ? "সার্ভিস আপডেট করুন" : "Update Service",
    create: isBn ? "সার্ভিস তৈরি করুন" : "Create Service",
    addDay: isBn ? "দিন যোগ করুন" : "Add Day",
    addIncluded: isBn ? "Included যোগ করুন" : "Add Included",
    addExcluded: isBn ? "Excluded যোগ করুন" : "Add Excluded",
    addPricing: isBn ? "প্রাইসিং স্ল্যাব যোগ করুন" : "Add Pricing Slab",
    addMedia: isBn ? "মিডিয়া যোগ করুন" : "Add Media",
    delete: isBn ? "ডিলিট" : "Delete",
  };

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
      toast({ title: text.loadFailed, description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (id: string) => {
    setDetailLoading(true);
    try {
      const full = await travelPackageApi.get(id);
      setForm({
        code: full.code || "",
        title: full.title || "",
        slug: full.slug || "",
        serviceType: (full.serviceType as ServiceType) || "tour_domestic",
        summary: full.summary || "",
        destination: full.destination || "",
        country: full.country || "",
        durationDays: Number(full.durationDays || 1),
        durationNights: Number(full.durationNights || 0),
        basePrice: Number(full.basePrice || 0),
        currency: full.currency || "BDT",
        status: full.status || "draft",
        isFeatured: !!full.isFeatured,
        heroImage: full.heroImage || "",
      });
      setDays((full.days || []).map((item, index) => ({
        ...item,
        dayNumber: Number(item.dayNumber || index + 1),
      })));
      setInclusions((full.inclusions || []).map((item, index) => ({
        ...item,
        sortOrder: Number(item.sortOrder ?? index),
      })));
      setPricing((full.pricing || []).map((item) => ({
        ...item,
        travelerMin: Number(item.travelerMin || 1),
        travelerMax: item.travelerMax ?? null,
        price: Number(item.price || 0),
        currency: item.currency || full.currency || "BDT",
      })));
      setMedia((full.media || []).map((item, index) => ({
        ...item,
        sortOrder: Number(item.sortOrder ?? index),
      })));
    } catch (err: any) {
      toast({ title: text.loadDetailsFailed, description: err.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadDetails(selectedId);
  }, [selectedId]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => filterType === "all" || item.serviceType === filterType);
  }, [items, filterType]);

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setDays([]);
    setInclusions([]);
    setPricing([]);
    setMedia([]);
  };

  const normalizeDays = () =>
    days
      .map((item, index) => ({
        ...item,
        dayNumber: index + 1,
        title: String(item.title || `Day ${index + 1}`).trim(),
        description: item.description || "",
        overnightLocation: item.overnightLocation || "",
      }))
      .filter((item) => item.title);

  const normalizeInclusions = () =>
    inclusions
      .map((item, index) => ({
        ...item,
        type: item.type === "excluded" ? "excluded" : "included",
        label: String(item.label || "").trim(),
        sortOrder: index,
      }))
      .filter((item) => item.label);

  const normalizePricing = () =>
    pricing
      .map((item) => ({
        ...item,
        label: String(item.label || "Standard").trim(),
        travelerMin: Math.max(1, Number(item.travelerMin || 1)),
        travelerMax: item.travelerMax ? Number(item.travelerMax) : null,
        price: Number(item.price || 0),
        currency: String(item.currency || form.currency || "BDT").toUpperCase(),
      }))
      .filter((item) => item.label);

  const normalizeMedia = () =>
    media
      .map((item, index) => ({
        ...item,
        url: String(item.url || "").trim(),
        altText: item.altText || "",
        sortOrder: index,
      }))
      .filter((item) => item.url);

  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) {
      toast({ title: text.required, variant: "destructive" });
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
      currency: String(form.currency || "BDT").toUpperCase(),
      days: normalizeDays(),
      inclusions: normalizeInclusions(),
      pricing: normalizePricing(),
      media: normalizeMedia(),
    };

    try {
      if (selectedId) {
        const updated = await travelPackageApi.update(selectedId, payload);
        setItems((prev) => prev.map((item) => (item.id === selectedId ? updated : item)));
        await loadDetails(selectedId);
        toast({ title: text.updated });
      } else {
        const created = await travelPackageApi.create(payload);
        setItems((prev) => [created, ...prev]);
        setSelectedId(created.id);
        toast({ title: text.created });
      }
    } catch (err: any) {
      toast({ title: text.saveFailed, description: err.message, variant: "destructive" });
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
      toast({ title: text.deleted });
    } catch (err: any) {
      toast({ title: text.deleteFailed, description: err.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Package2 className="h-6 w-6" /> {text.pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{text.pageSubtitle}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[210px]"><SelectValue placeholder={text.filterPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{text.allTypes}</SelectItem>
                {SERVICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{getServiceTypeLabel(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetForm}><Plus className="mr-2 h-4 w-4" />{text.newPackage}</Button>
            <Link to="/hajj-umrah">
              <Button variant="secondary"><Moon className="mr-2 h-4 w-4" />{text.legacyButton}</Button>
            </Link>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-medium">{text.migrationTitle}</p>
              <p className="text-sm text-muted-foreground">{text.migrationText}</p>
            </div>
            <Link to="/hajj-umrah">
              <Button variant="outline"><span>{text.legacyButton}</span><ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>{text.catalog}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isBn ? "কোড" : "Code"}</TableHead>
                      <TableHead>{isBn ? "শিরোনাম" : "Title"}</TableHead>
                      <TableHead>{isBn ? "টাইপ" : "Type"}</TableHead>
                      <TableHead>{text.status}</TableHead>
                      <TableHead className="text-right">{text.basePrice}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{text.noPackages}</TableCell></TableRow>
                    ) : visibleItems.map((item) => (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{item.title}</div>
                            {selectedId === item.id ? <Badge variant="secondary">{text.selected}</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{getServiceTypeLabel(item.serviceType)}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{item.status || text.draft}</Badge></TableCell>
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
              <CardTitle>{selectedId ? text.editService : text.createService}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailLoading ? (
                <div className="py-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <Tabs defaultValue="basic" className="space-y-4">
                  <TabsList className="flex flex-wrap h-auto gap-2">
                    <TabsTrigger value="basic">{text.basic}</TabsTrigger>
                    <TabsTrigger value="days">{text.itinerary} ({days.length})</TabsTrigger>
                    <TabsTrigger value="inclusions">{text.inclusions} ({inclusions.length})</TabsTrigger>
                    <TabsTrigger value="pricing">{text.pricing} ({pricing.length})</TabsTrigger>
                    <TabsTrigger value="media">{text.media} ({media.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{text.packageCode}</Label>
                        <Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="TH-6D-001" />
                      </div>
                      <div className="space-y-2">
                        <Label>{text.serviceType}</Label>
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
                      <Label>{text.packageTitle}</Label>
                      <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value, slug: prev.slug || slugify(e.target.value) }))} placeholder={isBn ? "থাইল্যান্ড ফ্যামিলি ট্যুর" : "Thailand Family Tour"} />
                    </div>

                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))} placeholder="thailand-family-tour" />
                    </div>

                    <div className="space-y-2">
                      <Label>{text.summary}</Label>
                      <Textarea rows={3} value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} placeholder={isBn ? "সেলস ও ওয়েবসাইটের জন্য ছোট সারাংশ" : "Short summary for sales and website use"} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{text.destination}</Label>
                        <Input value={form.destination} onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value }))} placeholder={isBn ? "ব্যাংকক ও পাতায়া" : "Bangkok & Pattaya"} />
                      </div>
                      <div className="space-y-2">
                        <Label>{text.country}</Label>
                        <Input value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} placeholder={isBn ? "থাইল্যান্ড" : "Thailand"} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{text.days}</Label>
                        <Input type="number" min={1} value={form.durationDays} onChange={(e) => setForm((prev) => ({ ...prev, durationDays: Number(e.target.value || 1) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{text.nights}</Label>
                        <Input type="number" min={0} value={form.durationNights} onChange={(e) => setForm((prev) => ({ ...prev, durationNights: Number(e.target.value || 0) }))} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2 col-span-2">
                        <Label>{text.basePrice}</Label>
                        <Input type="number" min={0} value={form.basePrice} onChange={(e) => setForm((prev) => ({ ...prev, basePrice: Number(e.target.value || 0) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{isBn ? "কারেন্সি" : "Currency"}</Label>
                        <Input value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{text.status}</Label>
                        <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">{isBn ? "ড্রাফট" : "Draft"}</SelectItem>
                            <SelectItem value="published">{isBn ? "পাবলিশড" : "Published"}</SelectItem>
                            <SelectItem value="archived">{isBn ? "আর্কাইভ" : "Archived"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{isBn ? "হিরো ইমেজ URL" : "Hero Image URL"}</Label>
                        <Input value={form.heroImage} onChange={(e) => setForm((prev) => ({ ...prev, heroImage: e.target.value }))} placeholder="https://..." />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="days" className="space-y-3">
                    {days.map((day, index) => (
                      <div key={day.id || `day-${index}`} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="outline">{isBn ? `দিন ${index + 1}` : `Day ${index + 1}`}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => setDays((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="mr-2 h-4 w-4" />{text.delete}</Button>
                        </div>
                        <Input value={day.title} onChange={(e) => setDays((prev) => prev.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} placeholder={isBn ? `দিন ${index + 1} শিরোনাম` : `Day ${index + 1} title`} />
                        <Textarea rows={3} value={day.description || ""} onChange={(e) => setDays((prev) => prev.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} placeholder={isBn ? "এই দিনের পরিকল্পনা লিখুন" : "Describe this day itinerary"} />
                        <Input value={day.overnightLocation || ""} onChange={(e) => setDays((prev) => prev.map((item, i) => i === index ? { ...item, overnightLocation: e.target.value } : item))} placeholder={isBn ? "রাত্রিযাপনের জায়গা / হোটেল" : "Overnight location / hotel"} />
                      </div>
                    ))}
                    <Button variant="outline" onClick={() => setDays((prev) => [...prev, blankDay(prev.length + 1)])}><Plus className="mr-2 h-4 w-4" />{text.addDay}</Button>
                  </TabsContent>

                  <TabsContent value="inclusions" className="space-y-3">
                    {inclusions.map((item, index) => (
                      <div key={item.id || `inc-${index}`} className="grid grid-cols-[140px_1fr_auto] gap-3 items-center rounded-md border p-3">
                        <Select value={item.type} onValueChange={(value: "included" | "excluded") => setInclusions((prev) => prev.map((row, i) => i === index ? { ...row, type: value } : row))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="included">{isBn ? "Included" : "Included"}</SelectItem>
                            <SelectItem value="excluded">{isBn ? "Excluded" : "Excluded"}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input value={item.label} onChange={(e) => setInclusions((prev) => prev.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} placeholder={isBn ? "যেমন: হোটেল, ভিসা, মিল" : "e.g. Hotel stay / Visa fee / Meals"} />
                        <Button variant="ghost" size="sm" onClick={() => setInclusions((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" onClick={() => setInclusions((prev) => [...prev, blankInclusion("included", prev.length)])}><Plus className="mr-2 h-4 w-4" />{text.addIncluded}</Button>
                      <Button variant="outline" onClick={() => setInclusions((prev) => [...prev, blankInclusion("excluded", prev.length)])}><Plus className="mr-2 h-4 w-4" />{text.addExcluded}</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="pricing" className="space-y-3">
                    {pricing.map((item, index) => (
                      <div key={item.id || `price-${index}`} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Input value={item.label} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} placeholder={isBn ? "প্রাইসিং লেবেল" : "Pricing label"} />
                          <Button variant="ghost" size="sm" onClick={() => setPricing((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="space-y-2">
                            <Label>{isBn ? "মিন ট্রাভেলার" : "Min Traveler"}</Label>
                            <Input type="number" min={1} value={item.travelerMin} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, travelerMin: Number(e.target.value || 1) } : row))} />
                          </div>
                          <div className="space-y-2">
                            <Label>{isBn ? "ম্যাক্স ট্রাভেলার" : "Max Traveler"}</Label>
                            <Input type="number" min={1} value={item.travelerMax ?? ""} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, travelerMax: e.target.value ? Number(e.target.value) : null } : row))} />
                          </div>
                          <div className="space-y-2">
                            <Label>{isBn ? "মূল্য" : "Price"}</Label>
                            <Input type="number" min={0} value={item.price} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, price: Number(e.target.value || 0) } : row))} />
                          </div>
                          <div className="space-y-2">
                            <Label>{isBn ? "কারেন্সি" : "Currency"}</Label>
                            <Input value={item.currency || form.currency} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, currency: e.target.value.toUpperCase() } : row))} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" onClick={() => setPricing((prev) => [...prev, blankPricing()])}><Plus className="mr-2 h-4 w-4" />{text.addPricing}</Button>
                  </TabsContent>

                  <TabsContent value="media" className="space-y-3">
                    {media.map((item, index) => (
                      <div key={item.id || `media-${index}`} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="outline">{isBn ? `মিডিয়া ${index + 1}` : `Media ${index + 1}`}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => setMedia((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <Input value={item.url} onChange={(e) => setMedia((prev) => prev.map((row, i) => i === index ? { ...row, url: e.target.value } : row))} placeholder={isBn ? "ইমেজ URL" : "Image URL"} />
                        <Input value={item.altText || ""} onChange={(e) => setMedia((prev) => prev.map((row, i) => i === index ? { ...row, altText: e.target.value } : row))} placeholder={isBn ? "ক্যাপশন / alt text" : "Alt text / caption"} />
                      </div>
                    ))}
                    <Button variant="outline" onClick={() => setMedia((prev) => [...prev, blankMedia(prev.length)])}><Plus className="mr-2 h-4 w-4" />{text.addMedia}</Button>
                  </TabsContent>
                </Tabs>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving || detailLoading} className="flex-1">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {selectedId ? text.update : text.create}
                </Button>
                {selectedId ? (
                  <Button variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />{text.delete}</Button>
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
