import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { templateDefaults, themePresets, websiteApi, type ThemePreset, type WebsiteConfig } from "@/lib/websiteApi";
import { tenantDomainApi, type TenantDomainRecord, type TenantDomainSummary } from "@/lib/tenantDomainApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Palette,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Wand2,
} from "lucide-react";

const templates = [
  { id: "travel-agency" as const, name: "Travel Agency", description: "Classic agency layout for flight, visa, hotel and outbound businesses.", emoji: "✈️" },
  { id: "hajj-umrah" as const, name: "Hajj & Umrah", description: "Spiritual service layout for Hajj, Umrah, visa, and ziyarat agencies.", emoji: "🕌" },
  { id: "tour-packages" as const, name: "Tour Packages", description: "Visual package-selling layout for holiday, honeymoon, and adventure brands.", emoji: "🌴" },
];

function hsl(v: string) {
  const parts = v.trim().split(/\s+/);
  return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}

function hslToHex(hslStr: string): string {
  try {
    const [h, s, l] = hslStr.trim().split(/\s+/).map((v, i) => i === 0 ? parseFloat(v) : parseFloat(v) / 100);
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return "#000000"; }
}

function hexToHsl(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return `0 0% ${Math.round(l * 100)}%`;
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
            : max === g ? ((b - r) / d + 2) / 6
            : ((r - g) / d + 4) / 6;
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch { return "0 0% 0%"; }
}

function ThemeMiniPreview({ colors, isActive }: { colors: WebsiteConfig["colors"]; isActive: boolean }) {
  const isDark = parseInt(colors.background.split(" ")[2]) < 30;
  const cardBg = isDark ? `hsl(${colors.secondary.replace(/\s+/g, ",")} / 0.5)` : hsl(colors.secondary);
  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 transition-all ${isActive ? "border-primary ring-2 ring-primary/30" : "border-transparent"}`}
      style={{ background: hsl(colors.background) }}
    >
      {/* Navbar */}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: hsl(colors.primary) }}>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-white/80" />
          <div className="h-1.5 w-10 rounded bg-white/60" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-1 w-5 rounded bg-white/40" />
          <div className="h-1 w-5 rounded bg-white/40" />
          <div className="h-1 w-5 rounded bg-white/40" />
        </div>
        <div className="h-4 w-10 rounded-full flex items-center justify-center" style={{ background: hsl(colors.accent) }}>
          <span style={{ fontSize: 5, color: "#fff", fontWeight: 700 }}>Book</span>
        </div>
      </div>

      {/* Hero */}
      <div className="px-3 pt-3 pb-2" style={{ background: `linear-gradient(135deg, ${hsl(colors.primary)}, ${hsl(colors.primary)}CC)` }}>
        <div className="mb-1.5 h-1.5 w-14 rounded-full" style={{ background: hsl(colors.accent) }} />
        <div className="mb-0.5 h-2.5 w-28 rounded bg-white/85" />
        <div className="mb-0.5 h-1.5 w-20 rounded bg-white/60" />
        <div className="mb-2.5 h-1.5 w-24 rounded bg-white/50" />
        <div className="flex gap-1.5">
          <div className="h-5 w-14 rounded-full flex items-center justify-center" style={{ background: hsl(colors.accent) }}>
            <span style={{ fontSize: 5.5, color: "#fff", fontWeight: 700 }}>Book Now</span>
          </div>
          <div className="h-5 w-14 rounded-full border border-white/50 flex items-center justify-center">
            <span style={{ fontSize: 5.5, color: "rgba(255,255,255,0.9)" }}>View Tours</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-px" style={{ background: hsl(colors.primary) }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 py-1 text-center" style={{ background: `${hsl(colors.primary)}CC` }}>
            <div className="h-2 w-4 rounded mx-auto mb-0.5 bg-white/80" />
            <div className="h-1 w-5 rounded mx-auto bg-white/40" />
          </div>
        ))}
      </div>

      {/* Services */}
      <div className="grid grid-cols-3 gap-1 p-2" style={{ background: hsl(colors.background) }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg p-2 space-y-1" style={{ background: cardBg, border: `1px solid ${hsl(colors.primary)}18` }}>
            <div className="h-3 w-3 rounded-md" style={{ background: hsl(colors.primary) }} />
            <div className="h-1 w-full rounded" style={{ background: `${hsl(colors.text)}40` }} />
            <div className="h-0.5 w-3/4 rounded" style={{ background: `${hsl(colors.text)}25` }} />
          </div>
        ))}
      </div>

      {/* Packages row */}
      <div className="flex gap-1 px-2 pb-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex-1 rounded-lg overflow-hidden" style={{ border: `1px solid ${hsl(colors.primary)}20` }}>
            <div className="h-5" style={{ background: `${hsl(colors.primary)}30` }} />
            <div className="p-1 space-y-0.5">
              <div className="h-1 w-full rounded" style={{ background: `${hsl(colors.text)}35` }} />
              <div className="h-0.5 w-2/3 rounded" style={{ background: `${hsl(colors.text)}20` }} />
              <div className="h-2.5 w-10 rounded-full mt-1" style={{ background: hsl(colors.accent) }} />
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-3 py-2" style={{ background: hsl(colors.primary) }}>
        <div className="h-2 w-20 rounded bg-white/75 mb-1" />
        <div className="h-1.5 w-28 rounded bg-white/40" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: `${hsl(colors.primary)}EE` }}>
        <div className="h-1 w-12 rounded bg-white/40" />
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => <div key={i} className="h-2 w-2 rounded-full bg-white/30" />)}
        </div>
      </div>

      {isActive && (
        <div className="absolute top-2 right-2 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5 flex items-center gap-1 shadow-md" style={{ fontSize: 9 }}>
          ✓ Active
        </div>
      )}
    </div>
  );
}

type ContentType = WebsiteConfig["content"];
type ServiceItem = ContentType["services"][number];
type StatItem = NonNullable<ContentType["stats"]>[number];
type WhyItem = NonNullable<ContentType["whyChooseUs"]>[number];
type FaqItem = NonNullable<ContentType["faq"]>[number];
type TestimonialItem = NonNullable<ContentType["testimonials"]>[number];
type TeamItem = NonNullable<ContentType["team"]>[number];

type FileInputRef = { current: HTMLInputElement | null };

const SERVICE_ICONS = [
  "Plane", "MapPin", "Shield", "Star", "Hotel", "Map", "Phone", "Mail",
  "Clock", "Users", "Globe", "Award", "Heart", "CheckCircle2", "CreditCard",
  "Moon", "Sun", "Mountain", "Palmtree", "Building", "Compass", "Briefcase",
  "Camera", "Gift", "Zap",
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const defaultServicesByTemplate: Record<WebsiteConfig["template"], ServiceItem[]> = {
  "travel-agency": [
    { icon: "Plane", title: "Air Ticketing", desc: "Domestic and international flight support." },
    { icon: "Shield", title: "Visa Processing", desc: "Fast and guided visa document support." },
    { icon: "Hotel", title: "Hotel Booking", desc: "Hotel reservations at trusted partner rates." },
  ],
  "hajj-umrah": [
    { icon: "Moon", title: "Umrah Packages", desc: "Flexible Umrah planning with complete support." },
    { icon: "Star", title: "Hajj Packages", desc: "Structured pilgrim service from start to return." },
    { icon: "MapPin", title: "Ziyarat Tours", desc: "Holy site transport and guided ziyarat arrangements." },
  ],
  "tour-packages": [
    { icon: "Mountain", title: "Adventure Tours", desc: "Adventure-focused domestic and international tours." },
    { icon: "Palmtree", title: "Holiday Packages", desc: "Beach, honeymoon, and family holiday deals." },
    { icon: "Building", title: "City Breaks", desc: "Popular short trips and seasonal city packages." },
  ],
};

const defaultStatsByTemplate: Record<WebsiteConfig["template"], StatItem[]> = {
  "travel-agency": [
    { value: "5000+", label: "Happy Travelers" },
    { value: "200+", label: "Destinations" },
    { value: "50+", label: "Tour Packages" },
  ],
  "hajj-umrah": [
    { value: "1000+", label: "Pilgrims Served" },
    { value: "10+", label: "Guides" },
    { value: "24/7", label: "Support" },
  ],
  "tour-packages": [
    { value: "3000+", label: "Happy Travelers" },
    { value: "100+", label: "Packages" },
    { value: "50+", label: "Destinations" },
  ],
};

const ensureConfig = (incoming: WebsiteConfig): WebsiteConfig => {
  const base = clone(templateDefaults[incoming.template || "travel-agency"]);
  const merged: WebsiteConfig = {
    ...base,
    ...incoming,
    colors: { ...base.colors, ...(incoming.colors || {}) },
    content: { ...base.content, ...(incoming.content || {}) },
    socialLinks: { ...base.socialLinks, ...(incoming.socialLinks || {}) },
    contactInfo: { ...base.contactInfo, ...(incoming.contactInfo || {}) },
  };

  merged.content.services = merged.content.services?.length ? merged.content.services : clone(base.content.services);
  merged.content.stats = merged.content.stats?.length ? merged.content.stats : clone(base.content.stats || []);
  merged.content.whyChooseUs = merged.content.whyChooseUs?.length ? merged.content.whyChooseUs : clone(base.content.whyChooseUs || []);
  merged.content.testimonials = merged.content.testimonials?.length ? merged.content.testimonials : clone(base.content.testimonials || []);
  merged.content.faq = merged.content.faq?.length ? merged.content.faq : clone(base.content.faq || []);
  merged.content.team = merged.content.team?.length ? merged.content.team : clone(base.content.team || []);
  return merged;
};

const WebsiteCustomizer = () => {
  const { toast } = useToast();
  const { tenant, user } = useAuth();
  const [config, setConfig] = useState<WebsiteConfig>(ensureConfig(templateDefaults["travel-agency"]));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAsset, setUploadingAsset] = useState<null | "logo" | "hero" | "about">(null);
  const [domainSummary, setDomainSummary] = useState<TenantDomainSummary | null>(null);
  const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
  const [domainForm, setDomainForm] = useState({ domain: "", wwwRedirect: "www-to-root" as "www-to-root" | "root-to-www" });
  const [domainSubmitting, setDomainSubmitting] = useState(false);
  const [domainActionId, setDomainActionId] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const aboutInputRef = useRef<HTMLInputElement | null>(null);

  const loadDomains = async () => {
    const [summary, records] = await Promise.all([tenantDomainApi.getSummary(), tenantDomainApi.list()]);
    setDomainSummary(summary);
    setDomains(records);
  };

  useEffect(() => {
    Promise.all([websiteApi.getConfig(), loadDomains()])
      .then(([websiteConfig]) => {
        const normalized = ensureConfig(websiteConfig);
        if (!normalized.contactInfo?.email && user?.email) {
          normalized.contactInfo = { ...normalized.contactInfo, email: user.email };
        }
        setConfig(normalized);
      })
      .catch((err: any) => {
        toast({ title: "Failed to load website settings", description: err.message || "Could not load website configuration.", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [user?.email]);

  const activePreset = useMemo(() => themePresets.find((preset) => preset.template === config.template), [config.template]);
  const preferredLiveDomain = useMemo(() => {
    return domains.find((item) => item.isPrimary && item.status === "active")
      || domains.find((item) => item.status === "active")
      || domains.find((item) => item.isPrimary)
      || null;
  }, [domains]);
  const primaryLiveUrl = preferredLiveDomain
    ? `https://${preferredLiveDomain.wwwRedirect === "root-to-www" ? `www.${preferredLiveDomain.domain}` : preferredLiveDomain.domain}`
    : domainSummary?.defaultWebsiteUrl;

  const setContent = <K extends keyof ContentType>(key: K, value: ContentType[K]) => {
    setConfig((prev) => ({ ...prev, content: { ...prev.content, [key]: value } }));
  };

  const setColor = (key: keyof WebsiteConfig["colors"], value: string) => {
    setConfig((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  };

  const setContact = (key: keyof NonNullable<WebsiteConfig["contactInfo"]>, value: string) => {
    setConfig((prev) => ({ ...prev, contactInfo: { ...prev.contactInfo, [key]: value } }));
  };

  const setSocial = (key: keyof NonNullable<WebsiteConfig["socialLinks"]>, value: string) => {
    setConfig((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: value } }));
  };

  const applyTemplate = (templateId: WebsiteConfig["template"]) => {
    const defaults = ensureConfig(templateDefaults[templateId]);
    setConfig((prev) => ({
      ...defaults,
      logo: prev.logo,
      content: {
        ...defaults.content,
        heroImage: prev.content.heroImage,
        aboutImage: prev.content.aboutImage,
      },
      contactInfo: {
        ...defaults.contactInfo,
        phone: prev.contactInfo?.phone || defaults.contactInfo?.phone,
        email: prev.contactInfo?.email || defaults.contactInfo?.email,
        address: prev.contactInfo?.address || defaults.contactInfo?.address,
      },
      socialLinks: { ...defaults.socialLinks, ...prev.socialLinks },
    }));
    toast({ title: "Template updated", description: templates.find((item) => item.id === templateId)?.name || templateId });
  };

  const applyPreset = (preset: ThemePreset) => {
    const defaults = ensureConfig(templateDefaults[preset.template]);
    setConfig((prev) => ({
      ...defaults,
      template: preset.template,
      logo: prev.logo,
      colors: { ...defaults.colors, ...preset.colors },
      content: {
        ...defaults.content,
        ...preset.sampleContent,
        heroImage: prev.content.heroImage,
        aboutImage: prev.content.aboutImage,
      },
      contactInfo: {
        ...defaults.contactInfo,
        phone: prev.contactInfo?.phone || defaults.contactInfo?.phone,
        email: prev.contactInfo?.email || defaults.contactInfo?.email,
        address: prev.contactInfo?.address || defaults.contactInfo?.address,
      },
      socialLinks: { ...defaults.socialLinks, ...prev.socialLinks },
    }));
    toast({ title: "Theme applied", description: `${preset.name} theme is ready to edit.` });
  };

  const resetPackagesAndServices = () => {
    setConfig((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        services: clone(defaultServicesByTemplate[prev.template]),
        stats: clone(defaultStatsByTemplate[prev.template]),
        packagesBadge: templateDefaults[prev.template].content.packagesBadge,
        packagesTitle: templateDefaults[prev.template].content.packagesTitle,
        packagesSubtitle: templateDefaults[prev.template].content.packagesSubtitle,
        packagePageTitle: templateDefaults[prev.template].content.packagePageTitle,
        packagePageSubtitle: templateDefaults[prev.template].content.packagePageSubtitle,
        packagePrimaryButtonText: templateDefaults[prev.template].content.packagePrimaryButtonText,
        packageSecondaryButtonText: templateDefaults[prev.template].content.packageSecondaryButtonText,
      },
    }));
    toast({ title: "Package section reset", description: "Package section labels and key homepage blocks were reset for this template." });
  };

  const uploadAsset = async (file: File | null, assetType: "logo" | "hero" | "about") => {
    if (!file) return;
    setUploadingAsset(assetType);
    try {
      const uploaded = await websiteApi.uploadAsset(file, assetType);
      if (assetType === "logo") {
        setConfig((prev) => ({ ...prev, logo: uploaded.assetUrl }));
      } else if (assetType === "hero") {
        setContent("heroImage", uploaded.assetUrl);
      } else {
        setContent("aboutImage", uploaded.assetUrl);
      }
      toast({ title: "Image uploaded", description: `${assetType} image updated successfully.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Could not upload image.", variant: "destructive" });
    } finally {
      setUploadingAsset(null);
    }
  };

  const removeAsset = (assetType: "logo" | "hero" | "about") => {
    if (assetType === "logo") setConfig((prev) => ({ ...prev, logo: "" }));
    if (assetType === "hero") setContent("heroImage", "");
    if (assetType === "about") setContent("aboutImage", "");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await websiteApi.saveConfig(config);
      toast({ title: "Website saved", description: "Theme Builder changes are now live." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message || "Could not save theme builder data.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  const addDomain = async () => {
    if (!domainForm.domain.trim()) {
      toast({ title: "Enter a domain name", variant: "destructive" });
      return;
    }
    setDomainSubmitting(true);
    try {
      await tenantDomainApi.add(domainForm);
      setDomainForm({ domain: "", wwwRedirect: "www-to-root" });
      await loadDomains();
      toast({ title: "Domain added", description: "Add the TXT record and verify it from this page." });
    } catch (err: any) {
      await loadDomains().catch(() => undefined);
      if (err?.sameTenant) {
        toast({ title: "Domain already added", description: "This domain is already connected to the current website account. Scroll down to manage it.", variant: "destructive" });
      } else if (err?.existingTenantName) {
        toast({ title: "Domain belongs to another account", description: `${err.domain?.domain || domainForm.domain} is already connected to ${err.existingTenantName}. Switch to that agency account to manage it.`, variant: "destructive" });
      } else {
        toast({ title: "Failed to add domain", description: err.message, variant: "destructive" });
      }
    } finally {
      setDomainSubmitting(false);
    }
  };

  const verifyDomain = async (id: string) => {
    setDomainActionId(id);
    try {
      const result = await tenantDomainApi.verify(id);
      await loadDomains();
      toast({
        title: result.verified ? "Domain verified" : "TXT record not found",
        description: result.verified ? "Super admin can now complete SSL and activation." : "Recheck DNS and try again after propagation.",
      });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setDomainActionId(null);
    }
  };

  const setPrimaryDomain = async (id: string) => {
    setDomainActionId(id);
    try {
      await tenantDomainApi.setPrimary(id);
      await loadDomains();
      toast({ title: "Primary domain updated" });
    } catch (err: any) {
      toast({ title: "Failed to set primary", description: err.message, variant: "destructive" });
    } finally {
      setDomainActionId(null);
    }
  };

  const removeDomain = async (id: string) => {
    setDomainActionId(id);
    try {
      await tenantDomainApi.remove(id);
      await loadDomains();
      toast({ title: "Domain removed" });
    } catch (err: any) {
      toast({ title: "Failed to remove domain", description: err.message, variant: "destructive" });
    } finally {
      setDomainActionId(null);
    }
  };

  const statusBadge = (record: TenantDomainRecord) => (
    <div className="flex flex-wrap gap-2">
      {record.verificationStatus === "verified" ? (
        <Badge className="bg-green-100 text-green-800"><ShieldCheck className="mr-1 h-3 w-3" />Verified</Badge>
      ) : (
        <Badge variant="outline" className="text-amber-700 border-amber-300"><AlertCircle className="mr-1 h-3 w-3" />Needs verify</Badge>
      )}
      {record.status === "active" ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Pending activation</Badge>}
      {record.sslStatus === "active" ? <Badge className="bg-emerald-100 text-emerald-800">SSL ready</Badge> : <Badge variant="outline">SSL pending</Badge>}
    </div>
  );

  const renderImageUploader = (title: string, description: string, value: string | undefined, assetType: "logo" | "hero" | "about", inputRef: FileInputRef, onUrlChange?: (url: string) => void) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => uploadAsset(e.target.files?.[0] || null, assetType)}
        />
        <div className="flex h-44 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
          {value ? <img src={value} alt={title} className="h-full w-full object-cover" /> : <div className="text-center text-sm text-muted-foreground"><ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-60" />No image set</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploadingAsset === assetType}>
            {uploadingAsset === assetType ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload
          </Button>
          {value && <Button type="button" variant="ghost" onClick={() => removeAsset(assetType)}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}
        </div>
        {onUrlChange !== undefined && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Or paste image URL</Label>
            <Input
              placeholder="https://images.unsplash.com/..."
              value={value || ""}
              onChange={(e) => onUrlChange(e.target.value)}
              className="text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderServicesEditor = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Service cards</CardTitle>
          <CardDescription>Homepage service cards shown under the about section.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetPackagesAndServices}>Reset by template</Button>
          <Button onClick={() => setContent("services", [...config.content.services, { icon: "Star", title: "New Service", desc: "Describe this service." }])}><Plus className="mr-2 h-4 w-4" />Add</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {config.content.services.map((item, index) => (
          <div key={`service-${index}`} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Badge variant="outline">Card {index + 1}</Badge>{config.content.services.length > 1 && <Button variant="ghost" size="sm" onClick={() => setContent("services", config.content.services.filter((_, i) => i !== index))}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={item.icon} onValueChange={(v) => setContent("services", config.content.services.map((service, i) => i === index ? { ...service, icon: v } : service))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-52">
                    {SERVICE_ICONS.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Title</Label><Input value={item.title} onChange={(e) => setContent("services", config.content.services.map((service, i) => i === index ? { ...service, title: e.target.value } : service))} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={item.desc} onChange={(e) => setContent("services", config.content.services.map((service, i) => i === index ? { ...service, desc: e.target.value } : service))} rows={2} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderStatsEditor = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Stats / counters</CardTitle>
          <CardDescription>These counters show in the hero and about areas.</CardDescription>
        </div>
        <Button onClick={() => setContent("stats", [...(config.content.stats || []), { value: "100+", label: "New stat" }])}><Plus className="mr-2 h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(config.content.stats || []).map((item, index) => (
          <div key={`stat-${index}`} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Badge variant="outline">Stat {index + 1}</Badge>{(config.content.stats || []).length > 1 && <Button variant="ghost" size="sm" onClick={() => setContent("stats", (config.content.stats || []).filter((_, i) => i !== index))}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}</div>
            <div className="space-y-2"><Label>Value</Label><Input value={item.value} onChange={(e) => setContent("stats", (config.content.stats || []).map((stat, i) => i === index ? { ...stat, value: e.target.value } : stat))} /></div>
            <div className="space-y-2"><Label>Label</Label><Input value={item.label} onChange={(e) => setContent("stats", (config.content.stats || []).map((stat, i) => i === index ? { ...stat, label: e.target.value } : stat))} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderWhyEditor = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Why choose us</CardTitle>
          <CardDescription>Short trust points shown on the homepage.</CardDescription>
        </div>
        <Button onClick={() => setContent("whyChooseUs", [...(config.content.whyChooseUs || []), { title: "Reason title", desc: "Reason description" }])}><Plus className="mr-2 h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(config.content.whyChooseUs || []).map((item, index) => (
          <div key={`why-${index}`} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Badge variant="outline">Point {index + 1}</Badge>{(config.content.whyChooseUs || []).length > 1 && <Button variant="ghost" size="sm" onClick={() => setContent("whyChooseUs", (config.content.whyChooseUs || []).filter((_, i) => i !== index))}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}</div>
            <div className="space-y-2"><Label>Title</Label><Input value={item.title} onChange={(e) => setContent("whyChooseUs", (config.content.whyChooseUs || []).map((current, i) => i === index ? { ...current, title: e.target.value } : current))} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={item.desc} onChange={(e) => setContent("whyChooseUs", (config.content.whyChooseUs || []).map((current, i) => i === index ? { ...current, desc: e.target.value } : current))} rows={2} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderTestimonialsEditor = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Testimonials</CardTitle>
          <CardDescription>Customer reviews shown on the public site.</CardDescription>
        </div>
        <Button onClick={() => setContent("testimonials", [...(config.content.testimonials || []), { name: "Customer name", text: "Customer review", date: "2026", rating: 5 }])}><Plus className="mr-2 h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(config.content.testimonials || []).map((item, index) => (
          <div key={`testimonial-${index}`} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Badge variant="outline">Review {index + 1}</Badge>{(config.content.testimonials || []).length > 1 && <Button variant="ghost" size="sm" onClick={() => setContent("testimonials", (config.content.testimonials || []).filter((_, i) => i !== index))}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2"><Label>Customer name</Label><Input value={item.name} onChange={(e) => setContent("testimonials", (config.content.testimonials || []).map((current, i) => i === index ? { ...current, name: e.target.value } : current))} /></div>
              <div className="space-y-2"><Label>Date</Label><Input value={item.date || ""} onChange={(e) => setContent("testimonials", (config.content.testimonials || []).map((current, i) => i === index ? { ...current, date: e.target.value } : current))} placeholder="Jan 2025" /></div>
              <div className="space-y-2">
                <Label>Star rating</Label>
                <Select value={String((item as any).rating ?? 5)} onValueChange={(v) => setContent("testimonials", (config.content.testimonials || []).map((current, i) => i === index ? { ...current, rating: parseInt(v) } : current))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5,4,3,2,1].map((r) => <SelectItem key={r} value={String(r)}>{"★".repeat(r)}{"☆".repeat(5-r)} ({r}/5)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Review text</Label><Textarea value={item.text} onChange={(e) => setContent("testimonials", (config.content.testimonials || []).map((current, i) => i === index ? { ...current, text: e.target.value } : current))} rows={3} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderFaqEditor = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>FAQ</CardTitle>
          <CardDescription>Questions and answers shown on the public website.</CardDescription>
        </div>
        <Button onClick={() => setContent("faq", [...(config.content.faq || []), { question: "Question", answer: "Answer" }])}><Plus className="mr-2 h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(config.content.faq || []).map((item, index) => (
          <div key={`faq-${index}`} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Badge variant="outline">FAQ {index + 1}</Badge>{(config.content.faq || []).length > 1 && <Button variant="ghost" size="sm" onClick={() => setContent("faq", (config.content.faq || []).filter((_, i) => i !== index))}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}</div>
            <div className="space-y-2"><Label>Question</Label><Input value={item.question} onChange={(e) => setContent("faq", (config.content.faq || []).map((current, i) => i === index ? { ...current, question: e.target.value } : current))} /></div>
            <div className="space-y-2"><Label>Answer</Label><Textarea value={item.answer} onChange={(e) => setContent("faq", (config.content.faq || []).map((current, i) => i === index ? { ...current, answer: e.target.value } : current))} rows={3} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderTeamEditor = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Team members</CardTitle>
          <CardDescription>Public team section for the website.</CardDescription>
        </div>
        <Button onClick={() => setContent("team", [...(config.content.team || []), { name: "Team member", role: "Role", desc: "Short intro" }])}><Plus className="mr-2 h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(config.content.team || []).map((item, index) => (
          <div key={`team-${index}`} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Badge variant="outline">Member {index + 1}</Badge>{(config.content.team || []).length > 1 && <Button variant="ghost" size="sm" onClick={() => setContent("team", (config.content.team || []).filter((_, i) => i !== index))}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2"><Label>Full name</Label><Input value={item.name} onChange={(e) => setContent("team", (config.content.team || []).map((current, i) => i === index ? { ...current, name: e.target.value } : current))} /></div>
              <div className="space-y-2"><Label>Role / position</Label><Input value={item.role} onChange={(e) => setContent("team", (config.content.team || []).map((current, i) => i === index ? { ...current, role: e.target.value } : current))} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Photo URL</Label><Input value={(item as any).photo || ""} onChange={(e) => setContent("team", (config.content.team || []).map((current, i) => i === index ? { ...current, photo: e.target.value } : current))} placeholder="https://..." /></div>
            </div>
            <div className="space-y-2"><Label>Short bio</Label><Textarea value={item.desc || ""} onChange={(e) => setContent("team", (config.content.team || []).map((current, i) => i === index ? { ...current, desc: e.target.value } : current))} rows={2} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (loading) {
    return <DashboardLayout><div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Theme Builder</h1>
            <p className="text-muted-foreground">A complete website builder for theme, content, package sections, image uploads, and publishing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {primaryLiveUrl && <Button variant="outline" onClick={() => window.open(primaryLiveUrl, "_blank")}><ExternalLink className="mr-2 h-4 w-4" />Open live site</Button>}
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save website</Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Quick setup</CardTitle>
              <CardDescription>Update the most important website details from one place.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Agency name</Label><Input value={tenant?.name || ""} disabled /></div>
              <div className="space-y-2"><Label>Selected template</Label><Input value={templates.find((item) => item.id === config.template)?.name || config.template} disabled /></div>
              <div className="space-y-2"><Label>Hero badge text</Label><Input value={config.content.heroBadge || ""} onChange={(e) => setContent("heroBadge", e.target.value)} placeholder="e.g. #1 Trusted Travel Agency" /></div>
              <div className="space-y-2"><Label>Hero title</Label><Input value={config.content.heroTitle} onChange={(e) => setContent("heroTitle", e.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Hero subtitle</Label><Textarea value={config.content.heroSubtitle} onChange={(e) => setContent("heroSubtitle", e.target.value)} rows={2} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={config.contactInfo?.phone || ""} onChange={(e) => setContact("phone", e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={config.contactInfo?.email || ""} onChange={(e) => setContact("email", e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Builder status</CardTitle><CardDescription>See if your key website pieces are ready.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Theme preset</span><Badge variant="secondary">{activePreset?.name || templates.find((item) => item.id === config.template)?.name}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Logo</span>{config.logo ? <Badge className="bg-green-100 text-green-800">Ready</Badge> : <Badge variant="outline">Missing</Badge>}</div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Hero image</span>{config.content.heroImage ? <Badge className="bg-green-100 text-green-800">Ready</Badge> : <Badge variant="outline">Missing</Badge>}</div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Packages section</span>{config.content.packagesTitle ? <Badge className="bg-green-100 text-green-800">Configured</Badge> : <Badge variant="outline">Missing</Badge>}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Live URL</CardTitle><CardDescription>Share this URL with customers.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <p className="break-all rounded-lg border bg-muted/30 p-3 text-sm">{primaryLiveUrl || domainSummary?.defaultWebsiteUrl || "No live URL yet"}</p>
              <div className="flex gap-2">
                {primaryLiveUrl && <Button variant="outline" onClick={() => copyText(primaryLiveUrl, "Live URL")}><Copy className="mr-2 h-4 w-4" />Copy</Button>}
                {domainSummary?.defaultWebsiteUrl && <Button variant="ghost" onClick={() => copyText(domainSummary.defaultWebsiteUrl, "Default URL")}>Default URL</Button>}
              </div>
              {user?.role === "super_admin" && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  You are editing the website for the current logged-in tenant account: <strong>{tenant?.name || "Unknown tenant"}</strong>. If a custom domain belongs to another agency account, it will not appear here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="themes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="themes"><LayoutTemplate className="mr-1 h-4 w-4" />Themes</TabsTrigger>
            <TabsTrigger value="branding"><ImageIcon className="mr-1 h-4 w-4" />Branding</TabsTrigger>
            <TabsTrigger value="content"><Type className="mr-1 h-4 w-4" />Agency</TabsTrigger>
            <TabsTrigger value="packages"><Palette className="mr-1 h-4 w-4" />Packages</TabsTrigger>
            <TabsTrigger value="sections"><Sparkles className="mr-1 h-4 w-4" />Sections</TabsTrigger>
            <TabsTrigger value="publish"><Globe className="mr-1 h-4 w-4" />Publish</TabsTrigger>
          </TabsList>

          <TabsContent value="themes" className="space-y-8">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />Theme Presets</h2>
              <p className="text-sm text-muted-foreground mt-1">Click any theme to apply its colors, layout, and sample content instantly. You can fine-tune after applying.</p>
            </div>

            {/* One section per template type */}
            {templates.map((tpl) => {
              const group = themePresets.filter((p) => p.template === tpl.id);
              return (
                <div key={tpl.id}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">{tpl.emoji}</span>
                    <div>
                      <h3 className="font-semibold text-base">{tpl.name}</h3>
                      <p className="text-xs text-muted-foreground">{tpl.description}</p>
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {group.map((preset) => {
                      const isActive = config.colors.primary === preset.colors.primary && config.template === preset.template;
                      return (
                        <div
                          key={preset.id}
                          className={`group rounded-2xl border-2 overflow-hidden transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${isActive ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}
                          onClick={() => applyPreset(preset)}
                        >
                          {/* Mini website preview */}
                          <div className="aspect-[4/3] overflow-hidden">
                            <div className="w-full h-full" style={{ transform: "scale(1)", transformOrigin: "top left" }}>
                              <ThemeMiniPreview colors={preset.colors} isActive={isActive} />
                            </div>
                          </div>

                          {/* Card info */}
                          <div className="p-3 space-y-2 bg-card">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-sm leading-tight">{preset.name}</p>
                                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{preset.description}</p>
                              </div>
                              {isActive && <Badge className="shrink-0 text-xs h-5"><Check className="mr-1 h-2.5 w-2.5" />Active</Badge>}
                            </div>

                            {/* Color swatches */}
                            <div className="flex gap-1.5 items-center">
                              {preset.palettePreview.map((c, i) => (
                                <span
                                  key={i}
                                  className="h-5 w-5 rounded-full border border-black/10 shadow-sm shrink-0"
                                  style={{ background: hsl(c) }}
                                  title={`Color ${i + 1}: hsl(${c})`}
                                />
                              ))}
                              <span className="ml-auto text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Click to apply</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <p className="text-xs text-muted-foreground text-center pb-2">
              Applying a theme updates your color palette, page template, and sample copy. Your uploaded images and custom content are preserved.
            </p>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-3">
              {renderImageUploader("Logo", "Header logo and brand mark.", config.logo, "logo", logoInputRef,
                (url) => setConfig((prev) => ({ ...prev, logo: url }))
              )}
              {renderImageUploader("Hero image", "Main banner image for the homepage.", config.content.heroImage, "hero", heroInputRef,
                (url) => setContent("heroImage", url)
              )}
              {renderImageUploader("About image", "Supporting image for the about section.", config.content.aboutImage, "about", aboutInputRef,
                (url) => setContent("aboutImage", url)
              )}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Color controls</CardTitle>
                <CardDescription>Click a swatch to open the color picker, or type HSL values manually.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2 md:grid-cols-5">
                {([
                  ["primary", "Primary", "Main buttons, nav, hero background"],
                  ["secondary", "Secondary", "Card backgrounds, light sections"],
                  ["accent", "Accent", "CTAs, badges, highlights"],
                  ["background", "Background", "Page background color"],
                  ["text", "Text", "Body text color"],
                ] as const).map(([key, label, hint]) => (
                  <div key={key} className="space-y-2">
                    <Label className="font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground -mt-1">{hint}</p>
                    <div className="flex items-center gap-2">
                      <label className="relative cursor-pointer shrink-0">
                        <div
                          className="h-10 w-10 rounded-lg border-2 border-border shadow-sm transition-transform hover:scale-105"
                          style={{ background: hsl(config.colors[key]) }}
                          title={`Pick ${label} color`}
                        />
                        <input
                          type="color"
                          value={hslToHex(config.colors[key])}
                          onChange={(e) => setColor(key, hexToHsl(e.target.value))}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                      <Input
                        value={config.colors[key]}
                        onChange={(e) => setColor(key, e.target.value)}
                        placeholder="221 83% 53%"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            {/* Hero section */}
            <Card>
              <CardHeader><CardTitle>Hero section</CardTitle><CardDescription>Main banner text shown at the top of your website homepage.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Hero badge</Label><Input value={config.content.heroBadge || ""} onChange={(e) => setContent("heroBadge", e.target.value)} placeholder="#1 Trusted Travel Agency" /></div>
                <div className="space-y-2"><Label>Hero title</Label><Input value={config.content.heroTitle} onChange={(e) => setContent("heroTitle", e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Hero subtitle</Label><Textarea value={config.content.heroSubtitle} onChange={(e) => setContent("heroSubtitle", e.target.value)} rows={2} /></div>
              </CardContent>
            </Card>

            {/* About & CTA */}
            <Card>
              <CardHeader><CardTitle>About &amp; CTA section</CardTitle><CardDescription>About us section and the call-to-action block on the homepage.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>About title</Label><Input value={config.content.aboutTitle} onChange={(e) => setContent("aboutTitle", e.target.value)} /></div>
                <div className="space-y-2"><Label>CTA title</Label><Input value={config.content.ctaTitle} onChange={(e) => setContent("ctaTitle", e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>About description</Label><Textarea value={config.content.aboutText} onChange={(e) => setContent("aboutText", e.target.value)} rows={4} /></div>
                <div className="space-y-2 md:col-span-2"><Label>CTA subtitle</Label><Textarea value={config.content.ctaSubtitle} onChange={(e) => setContent("ctaSubtitle", e.target.value)} rows={2} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Footer text</Label><Input value={config.content.footerText || ""} onChange={(e) => setContent("footerText", e.target.value)} placeholder="© 2025 Your Agency. All rights reserved." /></div>
              </CardContent>
            </Card>

            {/* Contact info */}
            <Card>
              <CardHeader><CardTitle>Contact information</CardTitle><CardDescription>Shown on the contact section, footer, and booking forms.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Phone number</Label><Input value={config.contactInfo?.phone || ""} onChange={(e) => setContact("phone", e.target.value)} placeholder="+880 1XXX XXXXXX" /></div>
                <div className="space-y-2"><Label>Email address</Label><Input value={config.contactInfo?.email || ""} onChange={(e) => setContact("email", e.target.value)} placeholder="info@youragency.com" /></div>
                <div className="space-y-2"><Label>Office address</Label><Textarea value={config.contactInfo?.address || ""} onChange={(e) => setContact("address", e.target.value)} rows={3} /></div>
                <div className="space-y-2"><Label>Google Map embed URL</Label><Textarea value={config.contactInfo?.mapEmbed || ""} onChange={(e) => setContact("mapEmbed", e.target.value)} rows={3} placeholder="https://maps.google.com/maps?..." /></div>
              </CardContent>
            </Card>

            {/* Social links */}
            <Card>
              <CardHeader><CardTitle>Social media links</CardTitle><CardDescription>Links shown in the footer and contact section.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Facebook</Label><Input value={config.socialLinks?.facebook || ""} onChange={(e) => setSocial("facebook", e.target.value)} placeholder="https://facebook.com/youragency" /></div>
                <div className="space-y-2"><Label>Instagram</Label><Input value={config.socialLinks?.instagram || ""} onChange={(e) => setSocial("instagram", e.target.value)} placeholder="https://instagram.com/youragency" /></div>
                <div className="space-y-2"><Label>Twitter / X</Label><Input value={config.socialLinks?.twitter || ""} onChange={(e) => setSocial("twitter", e.target.value)} placeholder="https://x.com/youragency" /></div>
                <div className="space-y-2"><Label>WhatsApp (link)</Label><Input value={config.socialLinks?.whatsapp || ""} onChange={(e) => setSocial("whatsapp", e.target.value)} placeholder="https://wa.me/8801XXXXXXXXX" /></div>
                <div className="space-y-2"><Label>YouTube</Label><Input value={config.socialLinks?.youtube || ""} onChange={(e) => setSocial("youtube", e.target.value)} placeholder="https://youtube.com/@youragency" /></div>
                <div className="space-y-2"><Label>LinkedIn</Label><Input value={(config.socialLinks as any)?.linkedin || ""} onChange={(e) => setSocial("linkedin" as any, e.target.value)} placeholder="https://linkedin.com/company/youragency" /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packages" className="space-y-6">
            {/* Homepage packages section */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Homepage packages section</CardTitle>
                  <CardDescription>Labels shown in the packages block on your homepage.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={resetPackagesAndServices}>Reset to template</Button>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Section badge</Label><Input value={config.content.packagesBadge || ""} onChange={(e) => setContent("packagesBadge", e.target.value)} placeholder="Our Top Packages" /></div>
                <div className="space-y-2"><Label>Section title</Label><Input value={config.content.packagesTitle || ""} onChange={(e) => setContent("packagesTitle", e.target.value)} placeholder="Featured Travel Packages" /></div>
                <div className="space-y-2 md:col-span-2"><Label>Section subtitle</Label><Textarea value={config.content.packagesSubtitle || ""} onChange={(e) => setContent("packagesSubtitle", e.target.value)} rows={2} placeholder="Explore our best-selling packages for every budget." /></div>
              </CardContent>
            </Card>

            {/* Packages page */}
            <Card>
              <CardHeader>
                <CardTitle>All packages page</CardTitle>
                <CardDescription>Headings and button labels for the dedicated /packages listing page.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Page title</Label><Input value={config.content.packagePageTitle || ""} onChange={(e) => setContent("packagePageTitle", e.target.value)} placeholder="All Travel Packages" /></div>
                <div className="space-y-2"><Label>Page subtitle</Label><Input value={config.content.packagePageSubtitle || ""} onChange={(e) => setContent("packagePageSubtitle", e.target.value)} placeholder="Browse our complete package collection." /></div>
                <div className="space-y-2"><Label>Primary button text</Label><Input value={config.content.packagePrimaryButtonText || ""} onChange={(e) => setContent("packagePrimaryButtonText", e.target.value)} placeholder="Book Now" /></div>
                <div className="space-y-2"><Label>Secondary button text</Label><Input value={config.content.packageSecondaryButtonText || ""} onChange={(e) => setContent("packageSecondaryButtonText", e.target.value)} placeholder="View Details" /></div>
              </CardContent>
            </Card>

            {/* Packages are managed in the ERP */}
            <div className="rounded-xl border border-dashed p-6 text-center space-y-2">
              <p className="text-sm font-medium">Packages are managed from the ERP</p>
              <p className="text-xs text-muted-foreground">Go to <strong>Packages</strong> in the sidebar to create, edit, and publish tour packages. Published packages appear automatically on the website.</p>
              <Button variant="outline" size="sm" asChild>
                <a href="/packages">Go to Packages →</a>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="sections" className="space-y-6">
            {renderServicesEditor()}
            {renderStatsEditor()}
            {renderWhyEditor()}
            {renderTestimonialsEditor()}
            {renderFaqEditor()}
            {renderTeamEditor()}
          </TabsContent>

          <TabsContent value="publish" className="space-y-6">
            {/* Live URL Banner */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6 pb-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Your live website URL</p>
                    <p className="font-mono text-sm font-medium break-all">{primaryLiveUrl || "No URL available — save first"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Share this with your customers or connect a custom domain below.</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {primaryLiveUrl && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => copyText(primaryLiveUrl, "Live URL")}><Copy className="mr-2 h-3.5 w-3.5" />Copy URL</Button>
                        <Button size="sm" onClick={() => window.open(primaryLiveUrl, "_blank")}><ExternalLink className="mr-2 h-3.5 w-3.5" />Open site</Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardHeader><CardTitle>Publishing summary</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Website account</span><span className="font-medium">{tenant?.name || "Unknown"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium capitalize">{domainSummary?.subscriptionPlan || tenant?.subscriptionPlan || "free"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Domain allowance</span><span className="font-medium">{domainSummary?.domainLimit === -1 ? "Unlimited" : `${domainSummary?.usedDomains || 0} of ${domainSummary?.domainLimit || 0} used`}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Active domain</span><span className="font-medium">{preferredLiveDomain ? preferredLiveDomain.domain : "Default URL"}</span></div>
                  {user?.role === "super_admin" && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      Super admin: this builder edits the currently logged-in tenant. To manage another agency's website, switch to that account first.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Connect a custom domain</CardTitle>
                  <CardDescription>Add a domain from the agency account, then verify DNS so super admin can finish SSL and activation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[2fr_220px_auto]">
                    <div className="space-y-2"><Label>Domain name</Label><Input value={domainForm.domain} onChange={(e) => setDomainForm((prev) => ({ ...prev, domain: e.target.value }))} placeholder="example.com" /></div>
                    <div className="space-y-2"><Label>Redirect mode</Label><Select value={domainForm.wwwRedirect} onValueChange={(value: "www-to-root" | "root-to-www") => setDomainForm((prev) => ({ ...prev, wwwRedirect: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="www-to-root">www → root</SelectItem><SelectItem value="root-to-www">root → www</SelectItem></SelectContent></Select></div>
                    <div className="flex items-end"><Button onClick={addDomain} disabled={domainSubmitting || !domainSummary?.canAddDomain}>{domainSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add domain</Button></div>
                  </div>
                  {!domainSummary?.canAddDomain && <p className="text-sm text-amber-700 dark:text-amber-300">Your current plan or subscription status does not allow additional custom domains right now.</p>}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Connected domains</CardTitle>
                <CardDescription>Verify and manage agency-level custom domains from this screen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {domains.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No custom domains added yet. Use the form above to connect one.</div>
                ) : (
                  <div className="space-y-4">
                    {domains.map((record) => {
                      const liveUrl = `https://${record.wwwRedirect === "root-to-www" ? `www.${record.domain}` : record.domain}`;
                      return (
                        <div key={record.id} className="rounded-2xl border p-4 space-y-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">{record.domain}</h3>
                                {record.isPrimary && <Badge>Primary</Badge>}
                              </div>
                              {statusBadge(record)}
                              <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">DNS setup instructions</p>
                                <div className="grid gap-1 text-xs">
                                  <p>1. Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)</p>
                                  <p>2. Go to <strong>DNS Records</strong> and add a <strong>TXT record</strong>:</p>
                                </div>
                                <div className="rounded border bg-background p-2 space-y-1 font-mono text-xs">
                                  <p><span className="text-muted-foreground">Name/Host:</span> <strong>_verify</strong></p>
                                  <p><span className="text-muted-foreground">Value:</span> <span className="break-all text-primary">{record.verificationToken}</span></p>
                                  <p><span className="text-muted-foreground">TTL:</span> 300</p>
                                </div>
                                <p className="text-xs text-muted-foreground">3. Also add an <strong>A record</strong> pointing <code>{record.domain}</code> to this server's IP address, then click <strong>Verify DNS</strong>.</p>
                                <p className="text-xs text-muted-foreground"><span className="font-medium">Live URL:</span> <span className="break-all">{liveUrl}</span></p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                              <Button variant="outline" onClick={() => copyText(record.verificationToken, "Verification token")}><Copy className="mr-2 h-4 w-4" />Copy TXT</Button>
                              <Button variant="outline" onClick={() => verifyDomain(record.id)} disabled={domainActionId === record.id}>{domainActionId === record.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Verify DNS</Button>
                              {!record.isPrimary && record.verificationStatus === "verified" && <Button variant="outline" onClick={() => setPrimaryDomain(record.id)} disabled={domainActionId === record.id}>Set primary</Button>}
                              <Button variant="ghost" onClick={() => removeDomain(record.id)} disabled={domainActionId === record.id}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating save bar */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save website
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default WebsiteCustomizer;