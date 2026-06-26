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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useBdModuleEnabled } from "@/components/BdModuleGate";
import { useAuth } from "@/contexts/AuthContext";
import {
  filterServiceTypesForTenant,
  normalizeEnabledServiceTypes,
  presetAllowedForServiceTypes,
  resolveEffectiveServiceTypes,
  showsAllServiceTypes,
} from "@/lib/enabledServiceTypes";
import { Switch } from "@/components/ui/switch";
import PackageWebsiteSyncCard, { PackageWebsiteSyncBadge } from "@/components/PackageWebsiteSyncCard";
import MasterDataSelect from "@/components/MasterDataSelect";
import { getPackageQuickTemplates, type PackageQuickTemplate } from "@/lib/packageQuickTemplates";
import { DEFAULT_PACKAGE_HERO_IMAGE } from "@/lib/packageConstants";
import {
  ChevronDown,
  FileText,
  Globe,
  GraduationCap,
  Loader2,
  Moon,
  Package2,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";

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
  visaRequired: false,
  cancellationPolicy: "",
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

function autoCode(serviceType: string) {
  const prefix = String(serviceType || "SVC").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "SVC";
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

const Packages = () => {
  const { toast } = useToast();
  const { tenant } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { preset: presetParam } = useParams<{ preset?: string }>();
  const activePreset: PackagePresetId | null =
    presetParam && isPackagePreset(presetParam) ? presetParam : null;
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const enabledServiceTypes = useMemo(
    () => normalizeEnabledServiceTypes(tenant?.enabledServiceTypes),
    [tenant?.enabledServiceTypes],
  );
  const effectiveForPresets = useMemo(
    () => resolveEffectiveServiceTypes(enabledServiceTypes, tenant?.enabledSubcategories),
    [enabledServiceTypes, tenant?.enabledSubcategories],
  );
  const visibleServiceTypes = useMemo(
    () => (showsAllServiceTypes(enabledServiceTypes, tenant?.enabledSubcategories)
      ? [...SERVICE_TYPES]
      : filterServiceTypesForTenant(SERVICE_TYPES, enabledServiceTypes, tenant?.enabledSubcategories)),
    [enabledServiceTypes, tenant?.enabledSubcategories],
  );
  const [items, setItems] = useState<TravelPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [days, setDays] = useState<TravelPackageDay[]>([]);
  const [inclusions, setInclusions] = useState<TravelPackageInclusion[]>([]);
  const [pricing, setPricing] = useState<TravelPackagePricing[]>([]);
  const [media, setMedia] = useState<TravelPackageMedia[]>([]);

  const quickTemplates = useMemo(
    () => getPackageQuickTemplates(
      form.serviceType as ServiceType,
      visibleServiceTypes as ServiceType[],
    ),
    [form.serviceType, visibleServiceTypes],
  );

  const hajjModuleEnabled = useHajjModuleEnabled();
  const bdModuleEnabled = useBdModuleEnabled();
  const showHajjOpsButton = hajjModuleEnabled && (activePreset === "hajj" || activePreset === "umrah");
  const showBdOpsButton = bdModuleEnabled && (activePreset === "student" || activePreset === "manpower");

  const text = {
    loadFailed: isBn ? "প্যাকেজ লোড করা যায়নি" : "Failed to load packages",
    loadDetailsFailed: isBn ? "প্যাকেজ ডিটেইল লোড করা যায়নি" : "Failed to load package details",
    saveFailed: isBn ? "প্যাকেজ সেভ করা যায়নি" : "Failed to save package",
    deleteFailed: isBn ? "প্যাকেজ ডিলিট করা যায়নি" : "Failed to delete package",
    required: isBn ? "শিরোনাম আবশ্যক" : "Title is required",
    created: isBn ? "প্যাকেজ তৈরি হয়েছে" : "Package created",
    updated: isBn ? "প্যাকেজ আপডেট হয়েছে" : "Package updated",
    deleted: isBn ? "প্যাকেজ ডিলিট হয়েছে" : "Package deleted",
    pageTitle: t("packagesPage.pageTitle"),
    pageSubtitle: t("packagesPage.pageSubtitle"),
    hajjOpsButton: t("packagesPage.hajjOpsButton"),
    bdOpsButton: t("packagesPage.bdOpsButton"),
    publicButton: isBn ? "পাবলিক প্যাকেজ পেজ" : "Public Packages Page",
    builderButton: isBn ? "ওয়েবসাইট বিল্ডার" : "Website Builder",
    publishButton: isBn ? "পাবলিশ ও ডোমেইন" : "Publish & Domain",
    quotationButton: isBn ? "কোটেশন তৈরি করুন" : "Create Quotation",
    moreActions: isBn ? "আরও অপশন" : "More",
    newPackage: isBn ? "নতুন সার্ভিস" : "New Service",
    edit: isBn ? "এডিট" : "Edit",
    searchPlaceholder: isBn ? "কোড বা শিরোনাম খুঁজুন…" : "Search code or title…",
    filterPlaceholder: isBn ? "সার্ভিস টাইপ ফিল্টার" : "Filter by service type",
    allTypes: isBn ? "সব সার্ভিস টাইপ" : "All service types",
    catalog: isBn ? "সার্ভিস ক্যাটালগ" : "Service Catalog",
    noPackages: isBn ? "কোনো সার্ভিস পাওয়া যায়নি" : "No services found yet",
    noPackagesHint: isBn ? "‘নতুন সার্ভিস’ চেপে প্রথম সার্ভিস যোগ করুন।" : "Click “New Service” to add your first one.",
    draft: isBn ? "ড্রাফট" : "Draft",
    editService: isBn ? "সার্ভিস এডিট করুন" : "Edit Service",
    createService: isBn ? "নতুন সার্ভিস তৈরি করুন" : "Create Service",
    drawerHint: isBn
      ? "প্রয়োজনীয় তথ্য পূরণ করুন। বাকি ট্যাবে ইটিনেরারি, প্রাইসিং ও মিডিয়া যোগ করতে পারেন।"
      : "Fill the essentials. Use the other tabs to add itinerary, pricing, and media.",
    essentials: isBn ? "প্রয়োজনীয় তথ্য" : "Essentials",
    moreDetails: isBn ? "অতিরিক্ত তথ্য (ঐচ্ছিক)" : "More details (optional)",
    basic: isBn ? "মূল তথ্য" : "Details",
    itinerary: isBn ? "ইটিনেরারি" : "Itinerary",
    inclusions: isBn ? "ইনক্লুশন" : "Inclusions",
    pricing: isBn ? "প্রাইসিং" : "Pricing",
    media: isBn ? "মিডিয়া" : "Media",
    packageCode: isBn ? "সার্ভিস কোড" : "Service Code",
    codeHint: isBn ? "খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে" : "Leave blank to auto-generate",
    serviceType: isBn ? "সার্ভিস টাইপ" : "Service Type",
    packageTitle: isBn ? "সার্ভিস শিরোনাম" : "Service Title",
    summary: isBn ? "সারাংশ" : "Summary",
    destination: isBn ? "ডেস্টিনেশন" : "Destination",
    country: isBn ? "দেশ" : "Country",
    days: isBn ? "দিন" : "Days",
    nights: isBn ? "রাত" : "Nights",
    basePrice: isBn ? "বেস প্রাইস" : "Base Price",
    status: isBn ? "স্ট্যাটাস" : "Status",
    update: isBn ? "আপডেট" : "Update",
    create: isBn ? "তৈরি করুন" : "Create",
    addDay: isBn ? "দিন যোগ করুন" : "Add Day",
    addIncluded: isBn ? "Included যোগ করুন" : "Add Included",
    addExcluded: isBn ? "Excluded যোগ করুন" : "Add Excluded",
    addPricing: isBn ? "প্রাইসিং স্ল্যাব যোগ করুন" : "Add Pricing Slab",
    addMedia: isBn ? "মিডিয়া যোগ করুন" : "Add Media",
    delete: isBn ? "ডিলিট" : "Delete",
    visaRequired: isBn ? "ভিসা প্রয়োজন" : "Visa required",
    cancellationPolicy: isBn ? "বাতিল নীতি" : "Cancellation policy",
    featured: isBn ? "ওয়েবসাইটে ফিচার্ড" : "Featured on website",
    quickTemplate: isBn ? "দ্রুত টেমপ্লেট" : "Quick template",
    quickTemplatePlaceholder: isBn ? "টেমপ্লেট বেছে নিন…" : "Choose a starter template…",
    quickTemplateApplied: isBn ? "টেমপ্লেট লোড হয়েছে — প্রয়োজনে সম্পাদনা করুন" : "Template loaded — edit as needed",
    publishToWebsite: isBn ? "সেভ ও ওয়েবসাইটে প্রকাশ" : "Save & publish to website",
    publishedLive: isBn ? "প্যাকেজ ওয়েবসাইটে প্রকাশিত" : "Package published on website",
    // field placeholders
    phTitle: isBn ? "যেমন: ৫ দিনের কক্সবাজার ট্যুর" : "e.g. 5-Day Cox's Bazar Tour",
    phDayTitle: isBn ? "দিনের শিরোনাম" : "Day title",
    phDayDesc: isBn ? "এই দিনের কার্যক্রম" : "What happens on this day",
    phOvernight: isBn ? "রাত্রিযাপন স্থান" : "Overnight location",
    phLabel: isBn ? "লেবেল" : "Label",
    phMin: isBn ? "সর্বনিম্ন যাত্রী" : "Min travelers",
    phMax: isBn ? "সর্বোচ্চ যাত্রী" : "Max travelers",
    phPrice: isBn ? "মূল্য" : "Price",
    phAlt: isBn ? "ছবির বর্ণনা" : "Image description",
    noDays: isBn ? "এখনো কোনো itinerary day যোগ করা হয়নি" : "No itinerary days added yet",
    noInclusions: isBn ? "এখনো কোনো inclusion/exclusion যোগ করা হয়নি" : "No inclusions or exclusions added yet",
    noPricing: isBn ? "এখনো কোনো pricing slab যোগ করা হয়নি" : "No pricing slabs added yet",
    noMedia: isBn ? "এখনো কোনো media item যোগ করা হয়নি" : "No media items added yet",
  };

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  const pageTitle =
    activePreset && activePreset !== "all"
      ? t(`sidebar.packages.${activePreset}`)
      : t("packagesPage.pageTitle");

  const pageSubtitle =
    activePreset && activePreset !== "all"
      ? t("packagesPage.presetSubtitle", { category: pageTitle })
      : t("packagesPage.pageSubtitle");

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
        visaRequired: !!full.visaRequired,
        cancellationPolicy: full.cancellationPolicy || "",
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
    const base = activePreset
      ? items.filter((item) => packageMatchesPreset(item, activePreset))
      : items.filter((item) => filterType === "all" || item.serviceType === filterType);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        String(item.code || "").toLowerCase().includes(q) ||
        String(item.title || "").toLowerCase().includes(q),
    );
  }, [items, activePreset, filterType, search]);

  const categoryPresets = PACKAGE_PRESET_IDS.filter(
    (id) => id !== "all" && presetAllowedForServiceTypes(id, effectiveForPresets),
  );

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
    setShowAdvanced(false);
  };

  const openCreate = () => {
    const defaultType =
      activePreset && activePreset !== "all"
        ? PACKAGE_PRESET_CONFIG[activePreset].defaultServiceType
        : undefined;
    resetForm();
    if (defaultType) {
      setForm({ ...emptyForm, serviceType: defaultType });
    }
    setDrawerOpen(true);
  };

  const openEdit = (id: string) => {
    setSelectedId(id);
    setShowAdvanced(false);
    setDrawerOpen(true);
  };

  const applyQuickTemplate = (tpl: PackageQuickTemplate) => {
    setSelectedId(null);
    setForm({
      ...emptyForm,
      ...tpl.form,
      slug: slugify(tpl.form.title),
      status: "draft",
      isFeatured: false,
      heroImage: "",
    });
    setDays(tpl.days.map((d) => ({ ...d })));
    setInclusions(tpl.inclusions.map((inc) => ({ ...inc })));
    setPricing(tpl.pricing.map((p) => ({ ...p })));
    setMedia([]);
    toast({ title: text.quickTemplateApplied });
  };

  const normalizeDays = () => days.map((item, index) => ({ ...item, dayNumber: index + 1, title: String(item.title || `Day ${index + 1}`).trim(), description: item.description || "", overnightLocation: item.overnightLocation || "" })).filter((item) => item.title);
  const normalizeInclusions = () => inclusions.map((item, index) => ({ ...item, type: item.type === "excluded" ? "excluded" : "included", label: String(item.label || "").trim(), sortOrder: index })).filter((item) => item.label);
  const normalizePricing = () => pricing.map((item) => ({ ...item, label: String(item.label || "Standard").trim(), travelerMin: Math.max(1, Number(item.travelerMin || 1)), travelerMax: item.travelerMax ? Number(item.travelerMax) : null, price: Number(item.price || 0), currency: String(item.currency || form.currency || "BDT").toUpperCase() })).filter((item) => item.label);
  const normalizeMedia = () => media.map((item, index) => ({ ...item, url: String(item.url || "").trim(), altText: item.altText || "", sortOrder: index })).filter((item) => item.url);

  const handleSave = async (publish = false) => {
    if (!form.title.trim()) {
      toast({ title: text.required, variant: "destructive" });
      return;
    }
    setSaving(true);
    const heroImage = form.heroImage || (publish ? DEFAULT_PACKAGE_HERO_IMAGE : "");
    const finalCode = (form.code.trim() || autoCode(form.serviceType)).toUpperCase();
    const payload = {
      ...form,
      code: finalCode,
      slug: slugify(form.slug || form.title),
      status: publish ? "published" : form.status,
      heroImage,
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
        toast({ title: publish ? text.publishedLive : text.updated });
      } else {
        const created = await travelPackageApi.create(payload);
        setItems((prev) => [created, ...prev]);
        setSelectedId(created.id);
        toast({ title: publish ? text.publishedLive : text.created });
      }
      if (publish) {
        setForm((prev) => ({ ...prev, status: "published", heroImage }));
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
      setDrawerOpen(false);
      toast({ title: text.deleted });
    } catch (err: any) {
      toast({ title: text.deleteFailed, description: err.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header — title + primary action + compact "More" menu */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Package2 className="h-6 w-6" /> {pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{text.newPackage}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">{text.moreActions}<ChevronDown className="ml-2 h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/site/packages")}><Globe className="mr-2 h-4 w-4" />{text.publicButton}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/website")}><Wand2 className="mr-2 h-4 w-4" />{text.builderButton}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/website/publish")}><UploadCloud className="mr-2 h-4 w-4" />{text.publishButton}</DropdownMenuItem>
                {showHajjOpsButton ? (
                  <DropdownMenuItem onClick={() => navigate("/hajj-umrah")}><Moon className="mr-2 h-4 w-4" />{text.hajjOpsButton}</DropdownMenuItem>
                ) : null}
                {showBdOpsButton ? (
                  <DropdownMenuItem onClick={() => navigate(`/operations/bd?desk=${activePreset}`)}><GraduationCap className="mr-2 h-4 w-4" />{text.bdOpsButton}</DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Website sync status */}
        <PackageWebsiteSyncCard packages={items} />

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={resolvedPreset === "all" ? "default" : "outline"} size="sm" onClick={() => goToPackagePreset("all")}>
            {t("sidebar.packages.all", { defaultValue: isBn ? "সব" : "All" })} ({items.length})
          </Button>
          {categoryPresets.map((preset) => (
            <Button key={preset} type="button" variant={resolvedPreset === preset ? "default" : "outline"} size="sm" onClick={() => goToPackagePreset(preset)}>
              {t(`sidebar.packages.${preset}`)} ({categoryCounts[preset]})
            </Button>
          ))}
        </div>

        {/* Full-width catalog list */}
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>{text.catalog}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8 w-[220px]" placeholder={text.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={filterType} onValueChange={handleFilterTypeChange}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder={text.filterPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{text.allTypes}</SelectItem>
                    {visibleServiceTypes.map((type) => <SelectItem key={type} value={type}>{getLocalizedServiceTypeLabel(type, isBn)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isBn ? "কোড" : "Code"}</TableHead>
                    <TableHead>{isBn ? "শিরোনাম" : "Title"}</TableHead>
                    <TableHead>{isBn ? "টাইপ" : "Type"}</TableHead>
                    <TableHead>{text.destination}</TableHead>
                    <TableHead>{text.status}</TableHead>
                    <TableHead>{t("packageWebsiteSync.websiteColumn")}</TableHead>
                    <TableHead className="text-right">{text.basePrice}</TableHead>
                    <TableHead className="text-right">{text.edit}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <p className="font-medium">{text.noPackages}</p>
                        <p className="text-sm">{text.noPackagesHint}</p>
                      </TableCell>
                    </TableRow>
                  ) : visibleItems.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => openEdit(item.id)}>
                      <TableCell className="font-medium">{item.code}</TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell><Badge variant="outline">{getLocalizedServiceTypeLabel(item.serviceType, isBn)}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{item.destination || "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{item.status || text.draft}</Badge></TableCell>
                      <TableCell><PackageWebsiteSyncBadge pkg={item} /></TableCell>
                      <TableCell className="text-right">{item.currency || "BDT"} {Number(item.basePrice || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(item.id); }}>
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Slide-over drawer for create/edit */}
      <Sheet open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) resetForm(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>{selectedId ? text.editService : text.createService}</SheetTitle>
            <SheetDescription>{text.drawerHint}</SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="py-16 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="mt-4 space-y-4">
              <Tabs defaultValue="basic" className="space-y-4">
                <TabsList className="grid grid-cols-5">
                  <TabsTrigger value="basic">{text.basic}</TabsTrigger>
                  <TabsTrigger value="itinerary">{text.itinerary}</TabsTrigger>
                  <TabsTrigger value="inclusions">{text.inclusions}</TabsTrigger>
                  <TabsTrigger value="pricing">{text.pricing}</TabsTrigger>
                  <TabsTrigger value="media">{text.media}</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  {!selectedId && quickTemplates.length > 0 ? (
                    <div className="space-y-2 rounded-lg border border-dashed p-3 bg-muted/30">
                      <Label>{text.quickTemplate}</Label>
                      <Select onValueChange={(id) => {
                        const tpl = quickTemplates.find((q) => q.id === id);
                        if (tpl) applyQuickTemplate(tpl);
                      }}>
                        <SelectTrigger><SelectValue placeholder={text.quickTemplatePlaceholder} /></SelectTrigger>
                        <SelectContent>
                          {quickTemplates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id}>{isBn ? tpl.labelBn : tpl.labelEn}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {/* Essentials */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{text.essentials}</p>
                    <div className="space-y-2">
                      <Label>{text.packageTitle} <span className="text-destructive">*</span></Label>
                      <Input value={form.title} placeholder={text.phTitle} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value, slug: slugify(e.target.value) }))} />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{text.serviceType}</Label>
                        <Select value={form.serviceType} onValueChange={(value) => setForm((prev) => ({ ...prev, serviceType: value as ServiceType }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{visibleServiceTypes.map((type) => <SelectItem key={type} value={type}>{getLocalizedServiceTypeLabel(type, isBn)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>{text.destination}</Label><MasterDataSelect category="city" value={form.destination} onChange={(v) => setForm((prev) => ({ ...prev, destination: v }))} placeholder={text.destination} /></div>
                      <div className="space-y-2"><Label>{text.days}</Label><Input type="number" min={1} value={form.durationDays} onChange={(e) => setForm((prev) => ({ ...prev, durationDays: Number(e.target.value || 1) }))} /></div>
                      <div className="space-y-2"><Label>{text.nights}</Label><Input type="number" min={0} value={form.durationNights} onChange={(e) => setForm((prev) => ({ ...prev, durationNights: Number(e.target.value || 0) }))} /></div>
                      <div className="space-y-2"><Label>{text.basePrice}</Label><Input type="number" min={0} value={form.basePrice} onChange={(e) => setForm((prev) => ({ ...prev, basePrice: Number(e.target.value || 0) }))} /></div>
                      <div className="space-y-2"><Label>{text.status}</Label><Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
                    </div>
                  </div>

                  {/* Advanced / optional */}
                  <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="px-0 text-muted-foreground">
                        <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                        {text.moreDetails}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-2">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{text.packageCode}</Label>
                          <Input value={form.code} placeholder={text.codeHint} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
                          <p className="text-xs text-muted-foreground">{text.codeHint}</p>
                        </div>
                        <div className="space-y-2"><Label>{text.country}</Label><MasterDataSelect category="country" value={form.country} onChange={(v) => setForm((prev) => ({ ...prev, country: v }))} placeholder={text.country} /></div>
                        <div className="space-y-2 md:col-span-2"><Label>{text.summary}</Label><Textarea value={form.summary} rows={3} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} /></div>
                        <div className="flex items-center justify-between rounded-lg border p-3"><Label>{text.visaRequired}</Label><Switch checked={form.visaRequired} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, visaRequired: checked }))} /></div>
                        <div className="flex items-center justify-between rounded-lg border p-3"><Label>{text.featured}</Label><Switch checked={form.isFeatured} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isFeatured: checked }))} /></div>
                        <div className="space-y-2 md:col-span-2"><Label>{text.cancellationPolicy}</Label><Textarea value={form.cancellationPolicy} rows={2} onChange={(e) => setForm((prev) => ({ ...prev, cancellationPolicy: e.target.value }))} placeholder={isBn ? "বাতিল ও রিফান্ড শর্ত..." : "Cancellation and refund terms..."} /></div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </TabsContent>

                <TabsContent value="itinerary" className="space-y-3">
                  <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setDays((prev) => [...prev, blankDay(prev.length + 1)])}><Plus className="mr-1 h-3 w-3" />{text.addDay}</Button></div>
                  {days.length === 0 ? <p className="text-sm text-muted-foreground">{text.noDays}</p> : null}
                  {days.map((day, index) => (
                    <div key={`${day.dayNumber}-${index}`} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between"><p className="font-medium">{text.days} {index + 1}</p><Button variant="ghost" size="icon" onClick={() => setDays((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>
                      <Input placeholder={text.phDayTitle} value={day.title} onChange={(e) => setDays((prev) => prev.map((it, i) => i === index ? { ...it, title: e.target.value } : it))} />
                      <Textarea placeholder={text.phDayDesc} rows={2} value={day.description || ""} onChange={(e) => setDays((prev) => prev.map((it, i) => i === index ? { ...it, description: e.target.value } : it))} />
                      <Input placeholder={text.phOvernight} value={day.overnightLocation || ""} onChange={(e) => setDays((prev) => prev.map((it, i) => i === index ? { ...it, overnightLocation: e.target.value } : it))} />
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="inclusions" className="space-y-3">
                  <div className="flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={() => setInclusions((prev) => [...prev, blankInclusion("included", prev.length)])}><Plus className="mr-1 h-3 w-3" />{text.addIncluded}</Button><Button variant="outline" size="sm" onClick={() => setInclusions((prev) => [...prev, blankInclusion("excluded", prev.length)])}><Plus className="mr-1 h-3 w-3" />{text.addExcluded}</Button></div>
                  {inclusions.length === 0 ? <p className="text-sm text-muted-foreground">{text.noInclusions}</p> : null}
                  {inclusions.map((item, index) => (
                    <div key={`${item.type}-${index}`} className="rounded-lg border p-3 flex items-center gap-3">
                      <Badge variant={item.type === "included" ? "default" : "secondary"}>{item.type}</Badge>
                      <Input value={item.label} placeholder={text.phLabel} onChange={(e) => setInclusions((prev) => prev.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} />
                      <Button variant="ghost" size="icon" onClick={() => setInclusions((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="pricing" className="space-y-3">
                  <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setPricing((prev) => [...prev, blankPricing()])}><Plus className="mr-1 h-3 w-3" />{text.addPricing}</Button></div>
                  {pricing.length === 0 ? <p className="text-sm text-muted-foreground">{text.noPricing}</p> : null}
                  {pricing.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-lg border p-3 grid gap-3 md:grid-cols-4">
                      <Input placeholder={text.phLabel} value={item.label} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} />
                      <Input type="number" min={1} placeholder={text.phMin} value={item.travelerMin} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, travelerMin: Number(e.target.value || 1) } : row))} />
                      <Input type="number" min={0} placeholder={text.phMax} value={item.travelerMax ?? ""} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, travelerMax: e.target.value ? Number(e.target.value) : null } : row))} />
                      <div className="flex gap-2"><Input type="number" min={0} placeholder={text.phPrice} value={item.price} onChange={(e) => setPricing((prev) => prev.map((row, i) => i === index ? { ...row, price: Number(e.target.value || 0) } : row))} /><Button variant="ghost" size="icon" onClick={() => setPricing((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="media" className="space-y-3">
                  <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => setMedia((prev) => [...prev, blankMedia(prev.length)])}><Plus className="mr-1 h-3 w-3" />{text.addMedia}</Button></div>
                  {media.length === 0 ? <p className="text-sm text-muted-foreground">{text.noMedia}</p> : null}
                  {media.map((item, index) => (
                    <div key={`${item.url}-${index}`} className="rounded-lg border p-3 grid gap-3 md:grid-cols-[1fr_180px_auto]">
                      <Input placeholder="https://..." value={item.url} onChange={(e) => setMedia((prev) => prev.map((row, i) => i === index ? { ...row, url: e.target.value } : row))} />
                      <Input placeholder={text.phAlt} value={item.altText || ""} onChange={(e) => setMedia((prev) => prev.map((row, i) => i === index ? { ...row, altText: e.target.value } : row))} />
                      <Button variant="ghost" size="icon" onClick={() => setMedia((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>

              {/* Sticky footer actions */}
              <div className="flex items-center justify-between gap-2 border-t pt-4 sticky bottom-0 bg-background">
                <div className="flex gap-2">
                  {selectedId ? <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 className="mr-1 h-4 w-4" />{text.delete}</Button> : null}
                  {selected ? <Link to={`/quotations/new?packageId=${selected.id}&source=packages`}><Button variant="outline" size="sm"><FileText className="mr-1 h-4 w-4" />{text.quotationButton}</Button></Link> : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {selectedId ? text.update : text.create}
                  </Button>
                  <Button onClick={() => handleSave(true)} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                    {text.publishToWebsite}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default Packages;
