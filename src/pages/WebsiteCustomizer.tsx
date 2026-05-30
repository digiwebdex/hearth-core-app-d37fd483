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
import { themePresets, templateDefaults, websiteApi, type ThemePreset, type WebsiteConfig } from "@/lib/websiteApi";
import { tenantDomainApi, type TenantDomainRecord, type TenantDomainSummary } from "@/lib/tenantDomainApi";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Check, Copy, ExternalLink, Globe, Image as ImageIcon, LayoutTemplate, Loader2, Palette, Plus, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, Type, Upload, Wand2 } from "lucide-react";

const templates = [
  { id: "travel-agency" as const, name: "Travel Agency", description: "Classic agency layout for flight, visa, hotel and outbound businesses." },
  { id: "hajj-umrah" as const, name: "Hajj & Umrah", description: "Sacred journey layout with calm spiritual branding and pilgrim-focused sections." },
  { id: "tour-packages" as const, name: "Tour Packages", description: "Interactive leisure and adventure design for package sellers and tour operators." },
];

const defaultServicesByTemplate: Record<WebsiteConfig["template"], { icon: string; title: string; desc: string }[]> = {
  "travel-agency": [
    { icon: "Plane", title: "Air Ticketing", desc: "Domestic and international flight support" },
    { icon: "Shield", title: "Visa Processing", desc: "Fast and guided document handling" },
    { icon: "Hotel", title: "Hotel Booking", desc: "Comfortable stays at trusted rates" },
  ],
  "hajj-umrah": [
    { icon: "Moon", title: "Umrah Packages", desc: "Flexible and guided Umrah packages" },
    { icon: "Star", title: "Hajj Packages", desc: "Premium pilgrim support and logistics" },
    { icon: "MapPin", title: "Ziyarat Tours", desc: "Guided holy site visits and transport" },
  ],
  "tour-packages": [
    { icon: "Mountain", title: "Adventure Tours", desc: "Exciting domestic and international adventures" },
    { icon: "Palmtree", title: "Holiday Packages", desc: "Relaxing beach and family experiences" },
    { icon: "Building", title: "City Breaks", desc: "Curated short city escapes and seasonal offers" },
  ],
};

const defaultStatsByTemplate: Record<WebsiteConfig["template"], { value: string; label: string }[]> = {
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

const createEmptyConfig = (template: WebsiteConfig["template"]): WebsiteConfig => JSON.parse(JSON.stringify(templateDefaults[template]));

const WebsiteCustomizer = () => {
  const { toast } = useToast();
  const { tenant, user } = useAuth();
  const [config, setConfig] = useState<WebsiteConfig>(createEmptyConfig("travel-agency"));
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
        const normalized = { ...createEmptyConfig(websiteConfig.template || "travel-agency"), ...websiteConfig } as WebsiteConfig;
        normalized.content = { ...createEmptyConfig(normalized.template).content, ...normalized.content };
        normalized.contactInfo = { ...createEmptyConfig(normalized.template).contactInfo, ...normalized.contactInfo };
        normalized.socialLinks = { ...createEmptyConfig(normalized.template).socialLinks, ...normalized.socialLinks };
        if (!normalized.contactInfo?.email && user?.email) normalized.contactInfo = { ...normalized.contactInfo, email: user.email };
        setConfig(normalized);
      })
      .catch((err: any) => {
        toast({ title: "Failed to load website settings", description: err.message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  const activePreset = useMemo(() => themePresets.find((preset) => preset.template === config.template), [config.template]);
  const primaryDomain = domains.find((item) => item.isPrimary) || null;
  const primaryLiveUrl = primaryDomain ? `https://${primaryDomain.wwwRedirect === "root-to-www" ? `www.${primaryDomain.domain}` : primaryDomain.domain}` : domainSummary?.defaultWebsiteUrl;

  const updateColors = (updates: Partial<WebsiteConfig["colors"]>) => {
    setConfig((prev) => ({ ...prev, colors: { ...prev.colors, ...updates } }));
  };

  const updateContent = (field: keyof WebsiteConfig["content"], value: any) => {
    setConfig((prev) => ({ ...prev, content: { ...prev.content, [field]: value } }));
  };

  const updateContact = (field: keyof NonNullable<WebsiteConfig["contactInfo"]>, value: string) => {
    setConfig((prev) => ({ ...prev, contactInfo: { ...prev.contactInfo, [field]: value } }));
  };

  const updateSocial = (field: keyof NonNullable<WebsiteConfig["socialLinks"]>, value: string) => {
    setConfig((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [field]: value } }));
  };

  const updateService = (index: number, field: "title" | "desc", value: string) => {
    setConfig((prev) => {
      const services = [...prev.content.services];
      services[index] = { ...services[index], [field]: value };
      return { ...prev, content: { ...prev.content, services } };
    });
  };

  const addService = () => {
    setConfig((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        services: [...prev.content.services, { icon: "Star", title: "New Service", desc: "Describe the service in one short sentence." }],
      },
    }));
  };

  const removeService = (index: number) => {
    setConfig((prev) => ({ ...prev, content: { ...prev.content, services: prev.content.services.filter((_, i) => i !== index) } }));
  };

  const updateStat = (index: number, field: "value" | "label", value: string) => {
    setConfig((prev) => {
      const stats = [...(prev.content.stats || [])];
      stats[index] = { ...stats[index], [field]: value };
      return { ...prev, content: { ...prev.content, stats } };
    });
  };

  const addStat = () => {
    setConfig((prev) => ({
      ...prev,
      content: { ...prev.content, stats: [...(prev.content.stats || []), { value: "100+", label: "Add stat" }] },
    }));
  };

  const removeStat = (index: number) => {
    setConfig((prev) => ({ ...prev, content: { ...prev.content, stats: (prev.content.stats || []).filter((_, i) => i !== index) } }));
  };

  const applyTemplate = (templateId: WebsiteConfig["template"]) => {
    const defaults = createEmptyConfig(templateId);
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
        mapEmbed: prev.contactInfo?.mapEmbed || defaults.contactInfo?.mapEmbed,
      },
      socialLinks: { ...defaults.socialLinks, ...prev.socialLinks },
    }));
    toast({ title: "Template applied", description: templates.find((item) => item.id === templateId)?.name });
  };

  const applyPreset = (preset: ThemePreset) => {
    const defaults = createEmptyConfig(preset.template);
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
        services: prev.content.services?.length ? prev.content.services : defaults.content.services,
        stats: prev.content.stats?.length ? prev.content.stats : defaults.content.stats,
      },
      contactInfo: {
        ...defaults.contactInfo,
        phone: prev.contactInfo?.phone || defaults.contactInfo?.phone,
        email: prev.contactInfo?.email || defaults.contactInfo?.email,
        address: prev.contactInfo?.address || defaults.contactInfo?.address,
        mapEmbed: prev.contactInfo?.mapEmbed || defaults.contactInfo?.mapEmbed,
      },
      socialLinks: { ...defaults.socialLinks, ...prev.socialLinks },
    }));
    toast({ title: "Interactive theme applied", description: `${preset.name} is now active.` });
  };

  const resetSectionsForTemplate = () => {
    setConfig((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        services: defaultServicesByTemplate[prev.template].map((item) => ({ ...item })),
        stats: defaultStatsByTemplate[prev.template].map((item) => ({ ...item })),
      },
    }));
    toast({ title: "Sections reset", description: "Service and stat cards were rebuilt for this template." });
  };

  const uploadAsset = async (file: File | null, assetType: "logo" | "hero" | "about") => {
    if (!file) return;
    setUploadingAsset(assetType);
    try {
      const uploaded = await websiteApi.uploadAsset(file, assetType);
      if (assetType === "logo") {
        setConfig((prev) => ({ ...prev, logo: uploaded.assetUrl }));
      } else if (assetType === "hero") {
        updateContent("heroImage", uploaded.assetUrl);
      } else {
        updateContent("aboutImage", uploaded.assetUrl);
      }
      toast({ title: "Image uploaded", description: `${assetType} image updated successfully.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAsset(null);
    }
  };

  const removeAsset = (assetType: "logo" | "hero" | "about") => {
    if (assetType === "logo") setConfig((prev) => ({ ...prev, logo: "" }));
    if (assetType === "hero") updateContent("heroImage", "");
    if (assetType === "about") updateContent("aboutImage", "");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await websiteApi.saveConfig(config);
      toast({ title: "Website saved", description: "Your theme, content, and media updates are now live." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message || "Could not save website settings.", variant: "destructive" });
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
      toast({ title: "Domain added", description: "Add the DNS record, then verify it from here." });
    } catch (err: any) {
      toast({ title: "Failed to add domain", description: err.message, variant: "destructive" });
    } finally {
      setDomainSubmitting(false);
    }
  };

  const verifyDomain = async (id: string) => {
    setDomainActionId(id);
    try {
      const result = await tenantDomainApi.verify(id);
      await loadDomains();
      toast({ title: result.verified ? "Domain verified" : "TXT record not found", description: result.verified ? "Super admin can now enable SSL and activate the domain." : "Recheck DNS and try again in a few minutes." });
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

  const verificationBadge = (record: TenantDomainRecord) => {
    if (record.verificationStatus === "verified") return <Badge className="bg-green-100 text-green-800"><ShieldCheck className="mr-1 h-3 w-3" />Verified</Badge>;
    if (record.verificationStatus === "verifying") return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Checking</Badge>;
    return <Badge variant="outline" className="text-amber-700 border-amber-300"><AlertCircle className="mr-1 h-3 w-3" />Unverified</Badge>;
  };

  const statusBadge = (record: TenantDomainRecord) => {
    if (record.status === "active") return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    if (record.status === "error") return <Badge variant="destructive">Error</Badge>;
    return <Badge variant="secondary">Pending admin activation</Badge>;
  };

  const sslBadge = (record: TenantDomainRecord) => {
    if (record.sslStatus === "active") return <Badge className="bg-emerald-100 text-emerald-800">SSL ready</Badge>;
    if (record.sslStatus === "pending") return <Badge variant="secondary">SSL pending</Badge>;
    return <Badge variant="outline">No SSL yet</Badge>;
  };

  const renderImageUploader = ({
    title,
    description,
    value,
    assetType,
    inputRef,
  }: {
    title: string;
    description: string;
    value?: string;
    assetType: "logo" | "hero" | "about";
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={(e) => uploadAsset(e.target.files?.[0] || null, assetType)} />
        <div className="flex h-52 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
          {value ? <img src={value} alt={title} className="h-full w-full object-cover" /> : <div className="text-center text-sm text-muted-foreground"><ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-60" />Upload image</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploadingAsset === assetType}>
            {uploadingAsset === assetType ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload {title}
          </Button>
          {value && <Button type="button" variant="ghost" onClick={() => removeAsset(assetType)}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}
        </div>
        <p className="text-xs text-muted-foreground">No more logo URL or hero image URL. Upload directly from your device.</p>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Theme Builder</h1>
            <p className="text-muted-foreground">Build a modern agency website with presets, direct image uploads, and simple content controls.</p>
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
              <div className="space-y-2">
                <Label>Agency name</Label>
                <Input value={tenant?.name || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Selected template</Label>
                <Input value={templates.find((item) => item.id === config.template)?.name || config.template} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Hero title</Label>
                <Input value={config.content.heroTitle} onChange={(e) => updateContent("heroTitle", e.target.value)} placeholder="Main headline for your agency website" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Hero subtitle</Label>
                <Textarea value={config.content.heroSubtitle} onChange={(e) => updateContent("heroSubtitle", e.target.value)} rows={3} placeholder="Short summary that explains what your agency sells" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={config.contactInfo?.phone || ""} onChange={(e) => updateContact("phone", e.target.value)} placeholder="017xxxxxxxx" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={config.contactInfo?.email || ""} onChange={(e) => updateContact("email", e.target.value)} placeholder="info@agency.com" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand status</CardTitle>
              <CardDescription>See how complete your public website is.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Theme preset</span><Badge variant="secondary">{activePreset?.name || templates.find((item) => item.id === config.template)?.name}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Logo</span>{config.logo ? <Badge className="bg-green-100 text-green-800">Ready</Badge> : <Badge variant="outline">Missing</Badge>}</div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Hero image</span>{config.content.heroImage ? <Badge className="bg-green-100 text-green-800">Ready</Badge> : <Badge variant="outline">Missing</Badge>}</div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Primary domain</span><Badge variant="secondary">{primaryDomain ? "Connected" : "Default URL"}</Badge></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live URL</CardTitle>
              <CardDescription>Share this link with your customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="break-all rounded-lg border bg-muted/30 p-3 text-sm">{primaryLiveUrl || domainSummary?.defaultWebsiteUrl || "No live URL yet"}</p>
              <div className="flex gap-2">
                {primaryLiveUrl && <Button variant="outline" onClick={() => copyText(primaryLiveUrl, "Live URL")}><Copy className="mr-2 h-4 w-4" />Copy</Button>}
                {domainSummary?.defaultWebsiteUrl && <Button variant="ghost" onClick={() => copyText(domainSummary.defaultWebsiteUrl, "Default URL")}>Default URL</Button>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="themes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="themes"><LayoutTemplate className="mr-1 h-4 w-4" />Themes</TabsTrigger>
            <TabsTrigger value="branding"><ImageIcon className="mr-1 h-4 w-4" />Branding</TabsTrigger>
            <TabsTrigger value="content"><Type className="mr-1 h-4 w-4" />Agency Info</TabsTrigger>
            <TabsTrigger value="sections"><Palette className="mr-1 h-4 w-4" />Sections</TabsTrigger>
            <TabsTrigger value="publish"><Globe className="mr-1 h-4 w-4" />Domain & Publish</TabsTrigger>
          </TabsList>

          <TabsContent value="themes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" />Interactive theme presets</CardTitle>
                <CardDescription>Select a ready-made visual style. It updates the template, colors, and key hero text instantly.</CardDescription>
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
                    <div className="mb-4 flex gap-2">
                      {preset.palettePreview.map((color) => (
                        <span key={color} className="h-10 w-10 rounded-full border" style={{ backgroundColor: `hsl(${color})` }} />
                      ))}
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                      <p className="font-medium">{preset.sampleContent.heroBadge}</p>
                      <p className="mt-2 text-lg font-semibold">{preset.sampleContent.heroTitle}</p>
                      <p className="mt-2 text-muted-foreground">{preset.sampleContent.heroSubtitle}</p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button className="flex-1" onClick={() => applyPreset(preset)}>Apply theme</Button>
                      <Button variant="outline" onClick={() => applyTemplate(preset.template)}>Template only</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Template base layouts</CardTitle>
                <CardDescription>Switch the whole website structure by business type.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-3">
                {templates.map((template) => (
                  <div key={template.id} className={`rounded-2xl border p-4 ${config.template === template.id ? "border-primary shadow-sm" : ""}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      {config.template === template.id && <Badge>Selected</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                    <Button className="mt-4 w-full" variant={config.template === template.id ? "outline" : "default"} onClick={() => applyTemplate(template.id)}>
                      {config.template === template.id ? "Current template" : `Use ${template.name}`}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-3">
              {renderImageUploader({ title: "Logo", description: "Your agency logo appears in the header and branding areas.", value: config.logo, assetType: "logo", inputRef: logoInputRef })}
              {renderImageUploader({ title: "Hero image", description: "This main banner image creates the first visual impression.", value: config.content.heroImage, assetType: "hero", inputRef: heroInputRef })}
              {renderImageUploader({ title: "About image", description: "Add a supporting photo for the about or intro section.", value: config.content.aboutImage, assetType: "about", inputRef: aboutInputRef })}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Color controls</CardTitle>
                <CardDescription>Fine-tune your theme colors after choosing a preset.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {(Object.keys(config.colors) as (keyof WebsiteConfig["colors"])[]).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">{key}</Label>
                    <Input value={config.colors[key]} onChange={(e) => updateColors({ [key]: e.target.value } as Partial<WebsiteConfig["colors"]>)} placeholder="H S% L%" />
                    <div className="h-10 rounded-xl border" style={{ backgroundColor: `hsl(${config.colors[key]})` }} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agency information</CardTitle>
                <CardDescription>Update the main texts, contact details, and links your visitors see.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Hero badge</Label>
                  <Input value={config.content.heroBadge || ""} onChange={(e) => updateContent("heroBadge", e.target.value)} placeholder="Trusted Travel Partner" />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Hero title</Label>
                  <Input value={config.content.heroTitle} onChange={(e) => updateContent("heroTitle", e.target.value)} placeholder="Main headline" />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Hero subtitle</Label>
                  <Textarea value={config.content.heroSubtitle} onChange={(e) => updateContent("heroSubtitle", e.target.value)} rows={3} placeholder="Short explanation of your service" />
                </div>
                <div className="space-y-2">
                  <Label>Contact phone</Label>
                  <Input value={config.contactInfo?.phone || ""} onChange={(e) => updateContact("phone", e.target.value)} placeholder="017xxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <Label>Contact email</Label>
                  <Input value={config.contactInfo?.email || ""} onChange={(e) => updateContact("email", e.target.value)} placeholder="info@agency.com" />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label>Office address</Label>
                  <Textarea value={config.contactInfo?.address || ""} onChange={(e) => updateContact("address", e.target.value)} rows={2} placeholder="Office address" />
                </div>
                <div className="space-y-2"><Label>Facebook</Label><Input value={config.socialLinks?.facebook || ""} onChange={(e) => updateSocial("facebook", e.target.value)} placeholder="https://facebook.com/..." /></div>
                <div className="space-y-2"><Label>Instagram</Label><Input value={config.socialLinks?.instagram || ""} onChange={(e) => updateSocial("instagram", e.target.value)} placeholder="https://instagram.com/..." /></div>
                <div className="space-y-2"><Label>YouTube</Label><Input value={config.socialLinks?.youtube || ""} onChange={(e) => updateSocial("youtube", e.target.value)} placeholder="https://youtube.com/..." /></div>
                <div className="space-y-2"><Label>WhatsApp</Label><Input value={config.socialLinks?.whatsapp || ""} onChange={(e) => updateSocial("whatsapp", e.target.value)} placeholder="https://wa.me/..." /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About section</CardTitle>
                <CardDescription>Edit your story and value proposition.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>About title</Label><Input value={config.content.aboutTitle} onChange={(e) => updateContent("aboutTitle", e.target.value)} /></div>
                <div className="space-y-2"><Label>About text</Label><Textarea value={config.content.aboutText} onChange={(e) => updateContent("aboutText", e.target.value)} rows={4} /></div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2"><Label>CTA title</Label><Input value={config.content.ctaTitle || ""} onChange={(e) => updateContent("ctaTitle", e.target.value)} /></div>
                  <div className="space-y-2"><Label>CTA subtitle</Label><Input value={config.content.ctaSubtitle || ""} onChange={(e) => updateContent("ctaSubtitle", e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Footer text</Label><Input value={config.content.footerText} onChange={(e) => updateContent("footerText", e.target.value)} /></div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Service cards</CardTitle>
                    <CardDescription>Simple editable cards for the homepage service section.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={resetSectionsForTemplate}>Reset by theme</Button>
                    <Button onClick={addService}><Plus className="mr-2 h-4 w-4" />Add service</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {config.content.services.map((service, index) => (
                    <div key={`${service.title}-${index}`} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">Card {index + 1}</Badge>
                        {config.content.services.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeService(index)}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}
                      </div>
                      <div className="space-y-2"><Label>Title</Label><Input value={service.title} onChange={(e) => updateService(index, "title", e.target.value)} /></div>
                      <div className="space-y-2"><Label>Description</Label><Textarea value={service.desc} onChange={(e) => updateService(index, "desc", e.target.value)} rows={2} /></div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Stats / counters</CardTitle>
                    <CardDescription>Numbers that build trust on the homepage.</CardDescription>
                  </div>
                  <Button onClick={addStat}><Plus className="mr-2 h-4 w-4" />Add stat</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(config.content.stats || []).map((stat, index) => (
                    <div key={`${stat.label}-${index}`} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">Stat {index + 1}</Badge>
                        {(config.content.stats || []).length > 1 && <Button variant="ghost" size="sm" onClick={() => removeStat(index)}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}
                      </div>
                      <div className="space-y-2"><Label>Value</Label><Input value={stat.value} onChange={(e) => updateStat(index, "value", e.target.value)} placeholder="5000+" /></div>
                      <div className="space-y-2"><Label>Label</Label><Input value={stat.label} onChange={(e) => updateStat(index, "label", e.target.value)} placeholder="Happy Travelers" /></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="publish" className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-4">
              <Card>
                <CardHeader><CardTitle>Publishing summary</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium capitalize">{domainSummary?.subscriptionPlan || "free"}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Allowance</span><span className="font-medium">{domainSummary?.domainLimit === -1 ? "Unlimited" : `${domainSummary?.usedDomains || 0}/${domainSummary?.domainLimit || 0}`}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Current live URL</span><span className="font-medium">{primaryDomain ? "Custom" : "Default"}</span></div>
                </CardContent>
              </Card>
              <Card className="xl:col-span-3">
                <CardHeader>
                  <CardTitle>Connect a custom domain</CardTitle>
                  <CardDescription>Add a domain from the agency account. After DNS verification, super admin can complete SSL and final activation.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_220px_220px]">
                  <div className="space-y-2">
                    <Label>Domain name</Label>
                    <Input placeholder="tourandtravels.cloud" value={domainForm.domain} onChange={(e) => setDomainForm((prev) => ({ ...prev, domain: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Redirect mode</Label>
                    <Select value={domainForm.wwwRedirect} onValueChange={(value: "www-to-root" | "root-to-www") => setDomainForm((prev) => ({ ...prev, wwwRedirect: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="www-to-root">www → root</SelectItem>
                        <SelectItem value="root-to-www">root → www</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={addDomain} disabled={domainSubmitting || !domainSummary?.canAddDomain}>{domainSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add domain</Button>
                  </div>
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
                  <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No custom domains added yet. Use the form above to connect one.</div>
                ) : domains.map((domain) => {
                  const preferredLiveHost = domain.wwwRedirect === "root-to-www" ? `www.${domain.domain}` : domain.domain;
                  return (
                    <div key={domain.id} className="rounded-2xl border p-4 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{domain.domain}</h3>
                            {domain.isPrimary && <Badge>Primary</Badge>}
                            {verificationBadge(domain)}
                            {statusBadge(domain)}
                            {sslBadge(domain)}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">Live target: <span className="font-medium text-foreground">{preferredLiveHost}</span></p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => copyText(domain.verificationToken, "Verification token")}><Copy className="mr-2 h-4 w-4" />Token</Button>
                          <Button variant="outline" size="sm" onClick={() => verifyDomain(domain.id)} disabled={domainActionId === domain.id}>{domainActionId === domain.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Verify</Button>
                          <Button variant="outline" size="sm" onClick={() => setPrimaryDomain(domain.id)} disabled={domain.isPrimary || domainActionId === domain.id}>Set primary</Button>
                          <Button variant="ghost" size="sm" onClick={() => window.open(`https://${preferredLiveHost}`, "_blank")}><ExternalLink className="mr-2 h-4 w-4" />Open</Button>
                          <Button variant="destructive" size="sm" onClick={() => removeDomain(domain.id)} disabled={domainActionId === domain.id}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl bg-muted/30 p-4 text-sm">
                          <p className="font-medium">TXT verification</p>
                          <p className="mt-2 text-muted-foreground">Host: <span className="text-foreground">_verify</span></p>
                          <p className="break-all text-muted-foreground">Value: <span className="text-foreground">{domain.verificationToken}</span></p>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-4 text-sm">
                          <p className="font-medium">Root DNS</p>
                          <p className="mt-2 text-muted-foreground">Type: A</p>
                          <p className="text-muted-foreground">Host: @</p>
                          <p className="text-muted-foreground">Value: your server IP</p>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-4 text-sm">
                          <p className="font-medium">www DNS</p>
                          <p className="mt-2 text-muted-foreground">Type: CNAME</p>
                          <p className="text-muted-foreground">Host: www</p>
                          <p className="text-muted-foreground">Value: {domain.domain}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default WebsiteCustomizer;