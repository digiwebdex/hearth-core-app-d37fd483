import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { SERVICE_TYPES, getLocalizedServiceTypeLabel, type ServiceType } from "@/lib/serviceTypes";
import {
  isPackagePreset,
  packageMatchesPreset,
  packagePresetPath,
  PACKAGE_PRESET_CONFIG,
  PACKAGE_PRESET_IDS,
  serviceTypeToPackagePreset,
  type PackagePresetId,
} from "@/lib/packageRoutePresets";
import { useHajjModuleEnabled } from "@/components/HajjModuleGate";
import { ArrowRight, FileText, Globe, Loader2, Moon, Package2, Plus, Save, Trash2, UploadCloud, Wand2 } from "lucide-react";

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

function PresetTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

const Packages = () => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { preset: presetParam } = useParams<{ preset?: string }>();
  const activePreset: PackagePresetId | null =
    presetParam && isPackagePreset(presetParam) ? presetParam : null;
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

  const hajjModuleEnabled = useHajjModuleEnabled();
  const showHajjOpsButton = hajjModuleEnabled && (activePreset === "hajj" || activePreset === "umrah");

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
    pageSubtitle: isBn ? "ট্যুর, হজ্জ-উমরাহ, ভিসা, টিকেট, হোটেল ও অন্যান্য ট্রাভেল সার্ভিসের reusable template এখানে ম্যানেজ করুন।" : "Manage reusable templates for tours, Hajj/Umrah, visa, tickets, hotels, and other travel services here.",
    migrationTitle: isBn ? "ইউনিফায়েড সার্ভিস সেন্টার" : "Unified service center",
    migrationText: isBn
      ? "সার্ভিস ক্যাটালগ = ওয়েবসাইট ও কোটেশনের জন্য reusable টেমপ্লেট। বুকিং = গ্রাহকের বিক্রয়। হজ্জ অপারেশনস = শুধু পিলগ্রিম সিজন ম্যানেজমেন্ট।"
      : "Service catalog = reusable templates for website & quotations. Bookings = customer sales. Hajj Operations = pilgrimage season desk only.",
    operationsHint: isBn
      ? "হজ্জ/উমরাহ প্যাকেজ পেজে পিলগ্রিম, গ্রুপ, রুমিং ও পেমেন্ট অপারেশনস বাটন পাওয়া যাবে।"
      : "The pilgrim operations button appears on Hajj and Umrah package pages only.",
    hajjOpsButton: t("packagesPage.hajjOpsButton"),
    publicButton: isBn ? "পাবলিক প্যাকেজ পেজ" : "Public Packages Page",
    builderButton: isBn ? "ওয়েবসাইট বিল্ডার" : "Website Builder",
    publishButton: isBn ? "পাবলিশ ও ডোমেইন" : "Publish & Domain",
    quotationButton: isBn ? "কোটেশন তৈরি করুন" : "Create Quotation",
    quotationHint: isBn ? "নির্বাচিত template থেকে quotation builder prefill হবে।" : "Quotation builder will be prefilled from the selected template.",
    publicText: isBn ? "যে প্যাকেজ Published করবেন, সেগুলো website package page-এ দেখা যাবে।" : "Published packages will appear automatically on the website packages page.",
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

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  const pageTitle =
    activePreset && activePreset !== "all"
      ? t(`sidebar.packages.${activePreset}`)
      : text.pageTitle;

  const pageSubtitle =
    activePreset && activePreset !== "all"
      ? t("packagesPage.presetSubtitle", { category: pageTitle })
      : text.pageSubtitle;

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
      setDays((full.days || []).map((item, index) => ({ ...item, dayNumber: Number(item.dayNumber || index + 1) })));
      setInclusions((full.inclusions || []).map((item, index) => ({ ...item, sortOrder: Number(item.sortOrder ?? index) })));
      setPricing((full.pricing || []).map((item) => ({
        ...item,
        travelerMin: Number(item.travelerMin || 1),
        travelerMax: item.travelerMax ?? null,
        price: Number(item.price || 0),
        currency: item.currency || full.currency || "BDT",
      })));
      setMedia((full.media || []).map((item, index) => ({ ...item, sortOrder: Number(item.sortOrder ?? index) })));
    } catch (err: any) {
      toast({ title: text.loadDetailsFailed, description: err.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedId) loadDetails(selectedId); }, [selectedId]);

  useEffect(() => {
    if (!activePreset) return;
    const config = PACKAGE_PRESET_CONFIG[activePreset];
    if (config.filterMode === "single" && config.serviceType) {
      setFilterType(config.serviceType);
    } else if (activePreset === "all") {
      setFilterType("all");
    } else if (config.defaultServiceType) {
      setFilterType(config.defaultServiceType);
    }
  }, [activePreset]);

  const visibleItems = useMemo(() => {
    if (activePreset) {
      return items.filter((item) => packageMatchesPreset(item, activePreset));
    }
    return items.filter((item) => filterType === "all" || item.serviceType === filterType);
  }, [items, activePreset, filterType]);

  const categoryPresets = PACKAGE_PRESET_IDS.filter((id) => id !== "all");

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(categoryPresets.map((id) => [id, 0])) as Record<PackagePresetId, number>;
    for (const item of items) {
      for (const preset of categoryPresets) {
        if (packageMatchesPreset(item, preset)) counts[preset] += 1;
      }
    }
    return counts;
  }, [items, categoryPresets]);

  const goToPackagePreset = (preset: PackagePresetId) => {
    navigate(packagePresetPath(preset));
    const config = PACKAGE_PRESET_CONFIG[preset];
    if (config.filterMode === "single" && config.serviceType) {
      setFilterType(config.serviceType);
    } else if (preset === "all") {
      setFilterType("all");
    } else if (config.defaultServiceType) {
      setFilterType(config.defaultServiceType);
    }
  };

  const resolvedPreset: PackagePresetId = activePreset ?? "all";

  const handleFilterTypeChange = (value: string) => {
    setFilterType(value);
    if (value === "all") {
      navigate(packagePresetPath("all"));
      return;
    }
    navigate(packagePresetPath(serviceTypeToPackagePreset(value)));
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setDays([]);
    setInclusions([]);
    setPricing([]);
    setMedia([]);
  };

  const handleResetForm = () => {
    const defaultType =
      activePreset && activePreset !== "all"
        ? PACKAGE_PRESET_CONFIG[activePreset].defaultServiceType
        : undefined;
    resetForm();
    if (defaultType) {
      setForm({ ...emptyForm, serviceType: defaultType });
    }
  };

  const normalizeDays = () => days.map((item, index) => ({ ...item, dayNumber: index + 1, title: String(item.title || `Day ${index + 1}`).trim(), description: item.description || "", overnightLocation: item.overnightLocation || "" })).filter((item) => item.title);
  const normalizeInclusions = () => inclusions.map((item, index) => ({ ...item, type: item.type === "excluded" ? "excluded" : "included", label: String(item.label || "").trim(), sortOrder: index })).filter((item) => item.label);
  const normalizePricing = () => pricing.map((item) => ({ ...item, label: String(item.label || "Standard").trim(), travelerMin: Math.max(1, Number(item.travelerMin || 1)), travelerMax: item.travelerMax ? Number(item.travelerMax) : null, price: Number(item.price || 0), currency: String(item.currency || form.currency || "BDT").toUpperCase() })).filter((item) => item.label);
  const normalizeMedia = () => media.map((item, index) => ({ ...item, url: String(item.url || "").trim(), altText: item.altText || "", sortOrder: index })).filter((item) => item.url);

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
            <h1 className="text-2xl font-bold flex items-center gap-2"><Package2 className="h-6 w-6" /> {pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterType} onValueChange={handleFilterTypeChange}>
              <SelectTrigger className="w-[210px]"><SelectValue placeholder={text.filterPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{text.allTypes}</SelectItem>
                {SERVICE_TYPES.map((type) => <SelectItem key={type} value={type}>{getLocalizedServiceTypeLabel(type, isBn)}</SelectItem>)}
              </SelectContent>
            </Select>
            {selected ? <Link to={`/quotations/new?packageId=${selected.id}&source=packages`}><Button><FileText className="mr-2 h-4 w-4" />{text.quotationButton}</Button></Link> : null}
            <Link to="/website"><Button variant="outline"><Wand2 className="mr-2 h-4 w-4" />{text.builderButton}</Button></Link>
            <Link to="/website/publish"><Button variant="outline"><UploadCloud className="mr-2 h-4 w-4" />{text.publishButton}</Button></Link>
            <Link to="/site/packages"><Button variant="outline"><Globe className="mr-2 h-4 w-4" />{text.publicButton}</Button></Link>
            <Button variant="outline" onClick={handleResetForm}><Plus className="mr-2 h-4 w-4" />{text.newPackage}</Button>
            {showHajjOpsButton ? (
              <Link to="/hajj-umrah"><Button variant="secondary"><Moon className="mr-2 h-4 w-4" />{text.hajjOpsButton}</Button></Link>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <PresetTab active={resolvedPreset === "all"} onClick={() => goToPackagePreset("all")}>
            {t("sidebar.packages.all", { defaultValue: isBn ? "সব" : "All" })}
          </PresetTab>
          {categoryPresets.map((preset) => (
            <PresetTab key={preset} active={resolvedPreset === preset} onClick={() => goToPackagePreset(preset)}>
              {t(`sidebar.packages.${preset}`)} ({categoryCounts[preset]})
            </PresetTab>
          ))}
        </div>

        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-medium">{text.migrationTitle}</p>
              <p className="text-sm text-muted-foreground">{text.migrationText}</p>
              <p className="text-sm text-muted-foreground mt-1">{text.publicText}</p>
              {showHajjOpsButton ? <p className="text-sm text-muted-foreground mt-1">{text.operationsHint}</p> : null}
              {selected ? <p className="text-sm text-muted-foreground mt-1">{text.quotationHint}</p> : null}
            </div>
            <div className="flex gap-2 flex-wrap">
              {selected ? <Link to={`/quotations/new?packageId=${selected.id}&source=packages`}><Button><span>{text.quotationButton}</span><ArrowRight className="ml-2 h-4 w-4" /></Button></Link> : null}
              <Link to="/website"><Button variant="outline"><span>{text.builderButton}</span><ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link to="/website/publish"><Button variant="outline"><span>{text.publishButton}</span><ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link to="/site/packages"><Button variant="outline"><span>{text.publicButton}</span><ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              {showHajjOpsButton ? (
                <Link to="/hajj-umrah"><Button variant="secondary"><Moon className="mr-2 h-4 w-4" />{text.hajjOpsButton}</Button></Link>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.15fr]">
          <Card>
            <CardHeader><CardTitle>{text.catalog}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="py-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
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
                    {visibleItems.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{text.noPackages}</TableCell></TableRow> : visibleItems.map((item) => (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell><div className="space-y-1"><div>{item.title}</div>{selectedId === item.id ? <Badge variant="secondary">{text.selected}</Badge> : null}</div></TableCell>
                        <TableCell><Badge variant="outline">{getLocalizedServiceTypeLabel(item.serviceType, isBn)}</Badge></TableCell>
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
            <CardHeader><CardTitle>{selected ? text.editService : text.createService}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {detailLoading ? <div className="py-10 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
                <>
                  <Tabs defaultValue="basic" className="space-y-4">
                    <TabsList className="grid grid-cols-4 md:grid-cols-5">
                      <TabsTrigger value="basic">{text.basic}</TabsTrigger>
                      <TabsTrigger value="itinerary">{text.itinerary}</TabsTrigger>
                      <TabsTrigger value="inclusions">{text.inclusions}</TabsTrigger>
                      <TabsTrigger value="pricing">{text.pricing}</TabsTrigger>
                      <TabsTrigger value="media">{text.media}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2"><Label>{text.packageCode}</Label><Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>{text.serviceType}</Label><Select value={form.serviceType} onValueChange={(value) => setForm((prev) => ({ ...prev, serviceType: value as ServiceType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SERVICE_TYPES.map((type) => <SelectItem key={type} value={type}>{getLocalizedServiceTypeLabel(type, isBn)}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2 md:col-span-2"><Label>{text.packageTitle}</Label><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value, slug: slugify(e.target.value) }))} /></div>
                        <div className="space-y-2 md:col-span-2"><Label>{text.summary}</Label><Textarea value={form.summary} rows={4} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>{text.destination}</Label><Input value={form.destination} onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>{text.country}</Label><Input value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>{text.days}</Label><Input type="number" min={1} value={form.durationDays} onChange={(e) => setForm((prev) => ({ ...prev, durationDays: Number(e.target.value || 1) }))} /></div>
                        <div className="space-y-2"><Label>{text.nights}</Label><Input type="number" min={0} value={form.durationNights} onChange={(e) => setForm((prev) => ({ ...prev, durationNights: Number(e.target.value || 0) }))} /></div>
                        <div className="space-y-2"><Label>{text.basePrice}</Label><Input type="number" min={0} value={form.basePrice} onChange={(e) => setForm((prev) => ({ ...prev, basePrice: Number(e.target.value || 0) }))} /></div>
                        <div className="space-y-2"><Label>{text.status}</Label><Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
                      </div>
                    </TabsContent>

                    <TabsContent value="itinerary" className="space-y-3">
                      <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setDays((prev) => [...prev, blankDay(prev.length + 1)])}>{text.addDay}</Button></div>
                      <div className="space-y-3">
                        {days.length === 0 ? <p className="text-sm text-muted-foreground">{isBn ? "এখনো কোনো itinerary day যোগ করা হয়নি" : "No itinerary days added yet"}</p> : null}
                        {days.map((day, index) => (
                          <div key={`${day.dayNumber}-${index}`} className="rounded-lg border p-3 space-y-3">
                            <div className="flex items-center justify-between"><p className="font-medium">Day {index + 1}</p><Button variant="ghost" size="icon" onClick={() => setDays((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>
                            <Input placeholder="Title" value={day.title} onChange={(e) => setDays((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, title: e.target.value } : item))} />
                            <Textarea placeholder="Description" rows={3} value={day.description || ""} onChange={(e) => setDays((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} />
                            <Input placeholder="Overnight location" value={day.overnightLocation || ""} onChange={(e) => setDays((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, overnightLocation: e.target.value } : item))} />
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="inclusions" className="space-y-3">
                      <div className="flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={() => setInclusions((prev) => [...prev, blankInclusion("included", prev.length)])}>{text.addIncluded}</Button><Button variant="outline" size="sm" onClick={() => setInclusions((prev) => [...prev, blankInclusion("excluded", prev.length)])}>{text.addExcluded}</Button></div>
                      <div className="space-y-3">
                        {inclusions.length === 0 ? <p className="text-sm text-muted-foreground">{isBn ? "এখনো কোনো inclusion/exclusion যোগ করা হয়নি" : "No inclusions or exclusions added yet"}</p> : null}
                        {inclusions.map((item, index) => (
                          <div key={`${item.type}-${index}`} className="rounded-lg border p-3 flex items-center gap-3">
                            <Badge variant={item.type === "included" ? "default" : "secondary"}>{item.type}</Badge>
                            <Input value={item.label} placeholder="Label" onChange={(e) => setInclusions((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, label: e.target.value } : row))} />
                            <Button variant="ghost" size="icon" onClick={() => setInclusions((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="pricing" className="space-y-3">
                      <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setPricing((prev) => [...prev, blankPricing()])}>{text.addPricing}</Button></div>
                      <div className="space-y-3">
                        {pricing.length === 0 ? <p className="text-sm text-muted-foreground">{isBn ? "এখনো কোনো pricing slab যোগ করা হয়নি" : "No pricing slabs added yet"}</p> : null}
                        {pricing.map((item, index) => (
                          <div key={`${item.label}-${index}`} className="rounded-lg border p-3 grid gap-3 md:grid-cols-4">
                            <Input placeholder="Label" value={item.label} onChange={(e) => setPricing((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, label: e.target.value } : row))} />
                            <Input type="number" min={1} placeholder="Min" value={item.travelerMin} onChange={(e) => setPricing((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, travelerMin: Number(e.target.value || 1) } : row))} />
                            <Input type="number" min={0} placeholder="Max" value={item.travelerMax ?? ""} onChange={(e) => setPricing((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, travelerMax: e.target.value ? Number(e.target.value) : null } : row))} />
                            <div className="flex gap-2"><Input type="number" min={0} placeholder="Price" value={item.price} onChange={(e) => setPricing((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, price: Number(e.target.value || 0) } : row))} /><Button variant="ghost" size="icon" onClick={() => setPricing((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="media" className="space-y-3">
                      <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setMedia((prev) => [...prev, blankMedia(prev.length)])}>{text.addMedia}</Button></div>
                      <div className="space-y-3">
                        {media.length === 0 ? <p className="text-sm text-muted-foreground">{isBn ? "এখনো কোনো media item যোগ করা হয়নি" : "No media items added yet"}</p> : null}
                        {media.map((item, index) => (
                          <div key={`${item.url}-${index}`} className="rounded-lg border p-3 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                            <Input placeholder="https://..." value={item.url} onChange={(e) => setMedia((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, url: e.target.value } : row))} />
                            <Input placeholder="Alt text" value={item.altText || ""} onChange={(e) => setMedia((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, altText: e.target.value } : row))} />
                            <Button variant="ghost" size="icon" onClick={() => setMedia((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex items-center justify-between pt-2">
                    <div>{selectedId ? <Button variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" />{text.delete}</Button> : null}</div>
                    <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{selectedId ? text.update : text.create}</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Packages;
