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
  { id: "travel-agency" as const, name: "Travel Agency", description: "Classic agency layout for flight, visa, hotel and outbound businesses." },
  { id: "hajj-umrah" as const, name: "Hajj & Umrah", description: "Spiritual service layout for Hajj, Umrah, visa, and ziyarat agencies." },
  { id: "tour-packages" as const, name: "Tour Packages", description: "Visual package-selling layout for holiday, honeymoon, and adventure brands." },
];

type ContentType = WebsiteConfig["content"];
type ServiceItem = ContentType["services"][number];
type StatItem = NonNullable<ContentType["stats"]>[number];
type WhyItem = NonNullable<ContentType["whyChooseUs"]>[number];
type FaqItem = NonNullable<ContentType["faq"]>[number];
type TestimonialItem = NonNullable<ContentType["testimonials"]>[number];
type TeamItem = NonNullable<ContentType["team"]>[number];

type FileInputRef = { current: HTMLInputElement | null };

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

  const renderImageUploader = (title: string, description: string, value: string | undefined, assetType: "logo" | "hero" | "about", inputRef: FileInputRef) => (
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
        <div className="flex h-52 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
          {value ? <img src={value} alt={title} className="h-full w-full object-cover" /> : <div className="text-center text-sm text-muted-foreground"><ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-60" />Upload image</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploadingAsset === assetType}>
            {uploadingAsset === assetType ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload {title}
          </Button>
          {value && <Button type="button" variant="ghost" onClick={() => removeAsset(assetType)}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}
        </div>
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
            <div className="space-y-2"><Label>Title</Label><Input value={item.title} onChange={(e) => setContent("services", config.content.services.map((service, i) => i === index ? { ...service, title: e.target.value } : service))} /></div>
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
        <Button onClick={() => setContent("testimonials", [...(config.content.testimonials || []), { name: "Customer name", text: "Customer review", date: "2026" }])}><Plus className="mr-2 h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(config.content.testimonials || []).map((item, index) => (
          <div key={`testimonial-${index}`} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between"><Badge variant="outline">Review {index + 1}</Badge>{(config.content.testimonials || []).length > 1 && <Button variant="ghost" size="sm" onClick={() => setContent("testimonials", (config.content.testimonials || []).filter((_, i) => i !== index))}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2"><Label>Name</Label><Input value={item.name} onChange={(e) => setContent("testimonials", (config.content.testimonials || []).map((current, i) => i === index ? { ...current, name: e.target.value } : current))} /></div>
              <div className="space-y-2"><Label>Date</Label><Input value={item.date || ""} onChange={(e) => setContent("testimonials", (config.content.testimonials || []).map((current, i) => i === index ? { ...current, date: e.target.value } : current))} /></div>
            </div>
            <div className="space-y-2"><Label>Review</Label><Textarea value={item.text} onChange={(e) => setContent("testimonials", (config.content.testimonials || []).map((current, i) => i === index ? { ...current, text: e.target.value } : current))} rows={3} /></div>
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
              <div className="space-y-2"><Label>Name</Label><Input value={item.name} onChange={(e) => setContent("team", (config.content.team || []).map((current, i) => i === index ? { ...current, name: e.target.value } : current))} /></div>
              <div className="space-y-2"><Label>Role</Label><Input value={item.role} onChange={(e) => setContent("team", (config.content.team || []).map((current, i) => i === index ? { ...current, role: e.target.value } : current))} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={item.desc || ""} onChange={(e) => setContent("team", (config.content.team || []).map((current, i) => i === index ? { ...current, desc: e.target.value } : current))} rows={2} /></div>
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
              <div className="space-y-2 md:col-span-2"><Label>Hero title</Label><Input value={config.content.heroTitle} onChange={(e) => setContent("heroTitle", e.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Hero subtitle</Label><Textarea value={config.content.heroSubtitle} onChange={(e) => setContent("heroSubtitle", e.target.value)} rows={3} /></div>
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="themes"><LayoutTemplate className="mr-1 h-4 w-4" />Themes</TabsTrigger>
            <TabsTrigger value="branding"><ImageIcon className="mr-1 h-4 w-4" />Branding</TabsTrigger>
            <TabsTrigger value="content"><Type className="mr-1 h-4 w-4" />Agency Info</TabsTrigger>
            <TabsTrigger value="packages"><Palette className="mr-1 h-4 w-4" />Packages</TabsTrigger>
            <TabsTrigger value="sections"><Sparkles className="mr-1 h-4 w-4" />Sections</TabsTrigger>
            <TabsTrigger value="publish"><Globe className="mr-1 h-4 w-4" />Publish</TabsTrigger>
          </TabsList>

          <TabsContent value="themes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" />Interactive theme presets</CardTitle>
                <CardDescription>One click updates your layout, palette, and core marketing copy.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-3">
                {themePresets.map((preset) => (
                  <div key={preset.id} className={`rounded-2xl border p-4 transition-all ${config.template === preset.template ? "border-primary shadow-sm" : ""}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{preset.name}</h3>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                      {activePreset?.id === preset.id && <Badge><Check className="mr-1 h-3 w-3" />Active</Badge>}
                    </div>
                    <div className="mb-4 flex gap-2">{preset.palettePreview.map((color) => <span key={color} className="h-10 w-10 rounded-full border" style={{ backgroundColor: `${color}` }} />)}</div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Template:</strong> {templates.find((item) => item.id === preset.template)?.name}</p>
                      <p><strong>Hero:</strong> {preset.sampleContent.heroTitle}</p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button className="flex-1" onClick={() => applyPreset(preset)}>Apply preset</Button>
                      <Button variant="outline" onClick={() => applyTemplate(preset.template)}>Use layout</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-3">
              {renderImageUploader("Logo", "Header logo and brand mark used on the public website.", config.logo, "logo", logoInputRef)}
              {renderImageUploader("Hero image", "Main banner image for the homepage.", config.content.heroImage, "hero", heroInputRef)}
              {renderImageUploader("About image", "Supporting image for the about section.", config.content.aboutImage, "about", aboutInputRef)}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Color controls</CardTitle>
                <CardDescription>Adjust the main brand colors for the website.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                {([
                  ["primary", "Primary"],
                  ["secondary", "Secondary"],
                  ["accent", "Accent"],
                  ["background", "Background"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-2 rounded-lg border p-2">
                      <input type="color" value={config.colors[key]} onChange={(e) => setColor(key, e.target.value)} className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent p-0" />
                      <Input value={config.colors[key]} onChange={(e) => setColor(key, e.target.value)} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Agency information</CardTitle><CardDescription>These details appear throughout the public website.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>About title</Label><Input value={config.content.aboutTitle} onChange={(e) => setContent("aboutTitle", e.target.value)} /></div>
                <div className="space-y-2"><Label>CTA title</Label><Input value={config.content.ctaTitle} onChange={(e) => setContent("ctaTitle", e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>About description</Label><Textarea value={config.content.aboutText} onChange={(e) => setContent("aboutText", e.target.value)} rows={4} /></div>
                <div className="space-y-2 md:col-span-2"><Label>CTA subtitle</Label><Textarea value={config.content.ctaSubtitle} onChange={(e) => setContent("ctaSubtitle", e.target.value)} rows={2} /></div>
                <div className="space-y-2"><Label>Address</Label><Textarea value={config.contactInfo?.address || ""} onChange={(e) => setContact("address", e.target.value)} rows={3} /></div>
                <div className="space-y-2"><Label>Google map embed URL</Label><Input value={config.contactInfo?.mapEmbed || ""} onChange={(e) => setContact("mapEmbed", e.target.value)} /></div>
                <div className="space-y-2"><Label>Facebook URL</Label><Input value={config.socialLinks?.facebook || ""} onChange={(e) => setSocial("facebook", e.target.value)} /></div>
                <div className="space-y-2"><Label>Instagram URL</Label><Input value={config.socialLinks?.instagram || ""} onChange={(e) => setSocial("instagram", e.target.value)} /></div>
                <div className="space-y-2"><Label>Twitter / X URL</Label><Input value={config.socialLinks?.twitter || ""} onChange={(e) => setSocial("twitter", e.target.value)} /></div>
                <div className="space-y-2"><Label>WhatsApp link</Label><Input value={config.socialLinks?.whatsapp || ""} onChange={(e) => setSocial("whatsapp", e.target.value)} /></div>
                <div className="space-y-2"><Label>YouTube URL</Label><Input value={config.socialLinks?.youtube || ""} onChange={(e) => setSocial("youtube", e.target.value)} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Package section controls</CardTitle>
                <CardDescription>Manage package section labels and the public packages page messaging.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Homepage badge</Label><Input value={config.content.packagesBadge || ""} onChange={(e) => setContent("packagesBadge", e.target.value)} /></div>
                <div className="space-y-2"><Label>Homepage title</Label><Input value={config.content.packagesTitle || ""} onChange={(e) => setContent("packagesTitle", e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Homepage subtitle</Label><Textarea value={config.content.packagesSubtitle || ""} onChange={(e) => setContent("packagesSubtitle", e.target.value)} rows={2} /></div>
                <div className="space-y-2"><Label>Packages page title</Label><Input value={config.content.packagePageTitle || ""} onChange={(e) => setContent("packagePageTitle", e.target.value)} /></div>
                <div className="space-y-2"><Label>Packages page subtitle</Label><Input value={config.content.packagePageSubtitle || ""} onChange={(e) => setContent("packagePageSubtitle", e.target.value)} /></div>
                <div className="space-y-2"><Label>Primary button text</Label><Input value={config.content.packagePrimaryButtonText || ""} onChange={(e) => setContent("packagePrimaryButtonText", e.target.value)} /></div>
                <div className="space-y-2"><Label>Secondary button text</Label><Input value={config.content.packageSecondaryButtonText || ""} onChange={(e) => setContent("packageSecondaryButtonText", e.target.value)} /></div>
              </CardContent>
            </Card>
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
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardHeader><CardTitle>Publishing summary</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Website account</span><span className="font-medium">{tenant?.name || "Unknown"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium capitalize">{domainSummary?.subscriptionPlan || tenant?.subscriptionPlan || "free"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Allowance</span><span className="font-medium">{domainSummary?.domainLimit === -1 ? "Unlimited" : `${domainSummary?.usedDomains || 0}/${domainSummary?.domainLimit || 0}`}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Live mode</span><span className="font-medium">{preferredLiveDomain ? preferredLiveDomain.domain : "Default URL"}</span></div>
                  {user?.role === "super_admin" && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      Super admin note: this builder always edits the currently logged-in tenant website. If <strong>tourandtravels.cloud</strong> belongs to another agency, open that agency account to manage its website and live URL here.
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
                              <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                                <p><span className="text-muted-foreground">TXT name:</span> <code className="font-mono">_verify</code></p>
                                <p><span className="text-muted-foreground">TXT value:</span> <code className="font-mono break-all">{record.verificationToken}</code></p>
                                <p><span className="text-muted-foreground">Live URL:</span> <span className="break-all">{liveUrl}</span></p>
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
    </DashboardLayout>
  );
};

export default WebsiteCustomizer;