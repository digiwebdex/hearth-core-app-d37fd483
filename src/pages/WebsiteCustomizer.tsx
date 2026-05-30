import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { websiteApi, templateDefaults, type WebsiteConfig } from "@/lib/websiteApi";
import { tenantDomainApi, type TenantDomainRecord, type TenantDomainSummary } from "@/lib/tenantDomainApi";
import { Plane, Moon, Mountain, Check, Palette, Type, Image, Eye, Plus, Trash2, Save, Users, Phone, Globe, Copy, RefreshCw, ShieldCheck, AlertCircle, ExternalLink, Link2 } from "lucide-react";

const templates = [
  { id: "travel-agency" as const, name: "Travel Agency", desc: "Classic travel agency with flights, hotels, visa", icon: Plane, color: "bg-blue-500" },
  { id: "hajj-umrah" as const, name: "Hajj & Umrah", desc: "Specialized for Hajj/Umrah service providers", icon: Moon, color: "bg-emerald-500" },
  { id: "tour-packages" as const, name: "Tour Packages", desc: "Adventure & leisure tour operator", icon: Mountain, color: "bg-purple-500" },
];

const WebsiteCustomizer = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<WebsiteConfig>(templateDefaults["travel-agency"]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [domainSummary, setDomainSummary] = useState<TenantDomainSummary | null>(null);
  const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
  const [domainForm, setDomainForm] = useState({ domain: "", wwwRedirect: "www-to-root" as "www-to-root" | "root-to-www" });
  const [domainSubmitting, setDomainSubmitting] = useState(false);
  const [domainActionId, setDomainActionId] = useState<string | null>(null);

  const loadDomains = async () => {
    const [summary, records] = await Promise.all([
      tenantDomainApi.getSummary(),
      tenantDomainApi.list(),
    ]);
    setDomainSummary(summary);
    setDomains(records);
  };

  useEffect(() => {
    Promise.all([websiteApi.getConfig(), loadDomains()])
      .then(([websiteConfig]) => {
        setConfig(websiteConfig);
      })
      .catch((err: any) => {
        toast({ title: "Failed to load website settings", description: err.message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  const selectTemplate = (id: WebsiteConfig["template"]) => {
    const defaults = templateDefaults[id];
    setConfig((prev) => ({
      ...prev,
      template: id,
      colors: { ...defaults.colors },
      content: { ...defaults.content },
      socialLinks: { ...defaults.socialLinks },
      contactInfo: { ...defaults.contactInfo },
    }));
  };

  const updateColor = (key: keyof WebsiteConfig["colors"], value: string) => {
    setConfig((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  };

  const updateContent = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, content: { ...prev.content, [key]: value } }));
  };

  const updateService = (index: number, field: string, value: string) => {
    setConfig((prev) => {
      const services = [...prev.content.services];
      services[index] = { ...services[index], [field]: value };
      return { ...prev, content: { ...prev.content, services } };
    });
  };
  const addService = () => setConfig((prev) => ({ ...prev, content: { ...prev.content, services: [...prev.content.services, { icon: "Star", title: "", desc: "" }] } }));
  const removeService = (index: number) => setConfig((prev) => ({ ...prev, content: { ...prev.content, services: prev.content.services.filter((_, i) => i !== index) } }));

  const updateStat = (index: number, field: string, value: string) => {
    setConfig((prev) => {
      const stats = [...(prev.content.stats || [])];
      stats[index] = { ...stats[index], [field]: value };
      return { ...prev, content: { ...prev.content, stats } };
    });
  };
  const addStat = () => setConfig((prev) => ({ ...prev, content: { ...prev.content, stats: [...(prev.content.stats || []), { value: "", label: "" }] } }));
  const removeStat = (i: number) => setConfig((prev) => ({ ...prev, content: { ...prev.content, stats: (prev.content.stats || []).filter((_, idx) => idx !== i) } }));

  const updateTestimonial = (index: number, field: string, value: string) => {
    setConfig((prev) => {
      const testimonials = [...(prev.content.testimonials || [])];
      testimonials[index] = { ...testimonials[index], [field]: value };
      return { ...prev, content: { ...prev.content, testimonials } };
    });
  };
  const addTestimonial = () => setConfig((prev) => ({ ...prev, content: { ...prev.content, testimonials: [...(prev.content.testimonials || []), { name: "", text: "", date: "" }] } }));
  const removeTestimonial = (i: number) => setConfig((prev) => ({ ...prev, content: { ...prev.content, testimonials: (prev.content.testimonials || []).filter((_, idx) => idx !== i) } }));

  const updateFaq = (index: number, field: string, value: string) => {
    setConfig((prev) => {
      const faq = [...(prev.content.faq || [])];
      faq[index] = { ...faq[index], [field]: value };
      return { ...prev, content: { ...prev.content, faq } };
    });
  };
  const addFaq = () => setConfig((prev) => ({ ...prev, content: { ...prev.content, faq: [...(prev.content.faq || []), { question: "", answer: "" }] } }));
  const removeFaq = (i: number) => setConfig((prev) => ({ ...prev, content: { ...prev.content, faq: (prev.content.faq || []).filter((_, idx) => idx !== i) } }));

  const updateTeam = (index: number, field: string, value: string) => {
    setConfig((prev) => {
      const team = [...(prev.content.team || [])];
      team[index] = { ...team[index], [field]: value };
      return { ...prev, content: { ...prev.content, team } };
    });
  };
  const addTeam = () => setConfig((prev) => ({ ...prev, content: { ...prev.content, team: [...(prev.content.team || []), { name: "", role: "", desc: "" }] } }));
  const removeTeam = (i: number) => setConfig((prev) => ({ ...prev, content: { ...prev.content, team: (prev.content.team || []).filter((_, idx) => idx !== i) } }));

  const updateWhy = (index: number, field: string, value: string) => {
    setConfig((prev) => {
      const whyChooseUs = [...(prev.content.whyChooseUs || [])];
      whyChooseUs[index] = { ...whyChooseUs[index], [field]: value };
      return { ...prev, content: { ...prev.content, whyChooseUs } };
    });
  };
  const addWhy = () => setConfig((prev) => ({ ...prev, content: { ...prev.content, whyChooseUs: [...(prev.content.whyChooseUs || []), { title: "", desc: "" }] } }));
  const removeWhy = (i: number) => setConfig((prev) => ({ ...prev, content: { ...prev.content, whyChooseUs: (prev.content.whyChooseUs || []).filter((_, idx) => idx !== i) } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await websiteApi.saveConfig(config);
      toast({ title: "সেভ হয়েছে!", description: "ওয়েবসাইট কাস্টমাইজেশন সফলভাবে সেভ হয়েছে।" });
    } catch {
      toast({ title: "ত্রুটি", description: "সেভ করতে সমস্যা হয়েছে।", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hslToHex = (hsl: string): string => {
    const parts = hsl.split(" ").map(Number);
    if (parts.length < 3) return "#3b82f6";
    const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
    const a2 = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
        case g: h = ((b - r) / d + 2) * 60; break;
        case b: h = ((r - g) / d + 4) * 60; break;
      }
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
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
      toast({ title: "Domain added", description: "Now add the DNS TXT record and verify the domain." });
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
      toast({ title: result.verified ? "Domain verified" : "Verification pending", description: result.verified ? "Ask super admin to activate SSL and connect the live domain." : "TXT record not found yet. Recheck DNS and try again." });
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

  const primaryDomain = domains.find((item) => item.isPrimary) || null;
  const primaryLiveUrl = primaryDomain ? `https://${primaryDomain.wwwRedirect === "root-to-www" ? `www.${primaryDomain.domain}` : primaryDomain.domain}` : domainSummary?.defaultWebsiteUrl;

  const getVerificationBadge = (record: TenantDomainRecord) => {
    if (record.verificationStatus === "verified") {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><ShieldCheck className="mr-1 h-3 w-3" />Verified</Badge>;
    }
    if (record.verificationStatus === "verifying") {
      return <Badge variant="secondary"><RefreshCw className="mr-1 h-3 w-3 animate-spin" />Checking</Badge>;
    }
    return <Badge variant="outline" className="text-amber-700 border-amber-300"><AlertCircle className="mr-1 h-3 w-3" />Unverified</Badge>;
  };

  const getStatusBadge = (record: TenantDomainRecord) => {
    if (record.status === "active") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
    if (record.status === "error") return <Badge variant="destructive">Error</Badge>;
    return <Badge variant="secondary">Pending admin activation</Badge>;
  };

  const getSslBadge = (record: TenantDomainRecord) => {
    if (record.sslStatus === "active") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">SSL ready</Badge>;
    if (record.sslStatus === "pending") return <Badge variant="secondary">SSL pending</Badge>;
    return <Badge variant="outline">No SSL yet</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Website Customizer</h1>
            <p className="text-muted-foreground">আপনার ওয়েবসাইটের ডিজাইন ও কন্টেন্ট পরিবর্তন করুন</p>
          </div>
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Custom domain connection</CardTitle>
              <CardDescription>Connect your own domain from the agency account, then super admin can verify SSL and activate it for the live website.</CardDescription>
            </div>
            <Button variant="outline" onClick={loadDomains}><RefreshCw className="mr-2 h-4 w-4" />Refresh domains</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-semibold capitalize">{domainSummary?.subscriptionPlan || "free"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Status: <span className="capitalize">{domainSummary?.subscriptionStatus || "inactive"}</span></p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Domain allowance</p>
                <p className="font-semibold">{domainSummary?.domainLimit === -1 ? "Unlimited" : `${domainSummary?.usedDomains || 0} / ${domainSummary?.domainLimit || 0}`}</p>
                <p className="mt-1 text-sm text-muted-foreground">Primary live URL</p>
                <p className="truncate text-sm font-medium">{primaryLiveUrl || "—"}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Default website URL</p>
                <div className="mt-1 flex items-center gap-2">
                  <a href={domainSummary?.defaultWebsiteUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-primary underline">{domainSummary?.defaultWebsiteUrl || "—"}</a>
                  {domainSummary?.defaultWebsiteUrl && <Button type="button" size="icon" variant="ghost" onClick={() => copyText(domainSummary.defaultWebsiteUrl, "Default URL")}><Copy className="h-4 w-4" /></Button>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Use this until the custom domain becomes fully active.</p>
              </div>
            </div>

            {domainSummary?.domainLimit === 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Your current plan does not include custom domains. Upgrade to Pro or higher, then connect a custom website URL.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Add or connect a custom domain</CardTitle>
                    <CardDescription>Enter the root domain only. Example: yourcompany.com. The system will handle www automatically.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Domain name</Label>
                      <Input placeholder="tourandtravels.cloud" value={domainForm.domain} onChange={(e) => setDomainForm((prev) => ({ ...prev, domain: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred redirect</Label>
                      <Select value={domainForm.wwwRedirect} onValueChange={(value: "www-to-root" | "root-to-www") => setDomainForm((prev) => ({ ...prev, wwwRedirect: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="www-to-root">www → root domain</SelectItem>
                          <SelectItem value="root-to-www">root → www domain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addDomain} disabled={domainSubmitting || !domainSummary?.canAddDomain}>
                      {domainSubmitting ? "Adding..." : "Add domain"}
                    </Button>
                    {!domainSummary?.canAddDomain && (
                      <p className="text-xs text-muted-foreground">You have reached the domain limit for your current subscription or your subscription is inactive.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>How domain connection works</CardTitle>
                    <CardDescription>Agency and super admin work together.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>1. Add your domain here from the agency account.</p>
                    <p>2. Add the TXT verification record and point the A/CNAME records to your server.</p>
                    <p>3. Click Verify from the agency account.</p>
                    <p>4. Super admin checks DNS, configures Nginx + SSL, and activates the domain.</p>
                    <p>5. Once active, your live website opens from the connected domain.</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Connected domains</CardTitle>
                <CardDescription>Manage your agency website domains and share the verification details with your hosting provider.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {domains.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No custom domains added yet.</div>
                ) : domains.map((domain) => {
                  const preferredLiveHost = domain.wwwRedirect === "root-to-www" ? `www.${domain.domain}` : domain.domain;
                  const redirectHost = domain.wwwRedirect === "root-to-www" ? domain.domain : `www.${domain.domain}`;
                  return (
                    <div key={domain.id} className="rounded-lg border p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{domain.domain}</h3>
                            {domain.isPrimary && <Badge>Primary</Badge>}
                            {getVerificationBadge(domain)}
                            {getStatusBadge(domain)}
                            {getSslBadge(domain)}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">Live domain target: <span className="font-medium text-foreground">{preferredLiveHost}</span> • Redirect helper: {redirectHost}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyText(domain.verificationToken, "Verification token")}><Copy className="mr-2 h-4 w-4" />Copy token</Button>
                          <Button size="sm" variant="outline" onClick={() => verifyDomain(domain.id)} disabled={domainActionId === domain.id}><ShieldCheck className="mr-2 h-4 w-4" />{domainActionId === domain.id ? "Checking..." : "Verify"}</Button>
                          <Button size="sm" variant="outline" onClick={() => setPrimaryDomain(domain.id)} disabled={domainActionId === domain.id || domain.isPrimary}>Set primary</Button>
                          <Button size="sm" variant="ghost" onClick={() => window.open(`https://${preferredLiveHost}`, "_blank")}>Open<ExternalLink className="ml-2 h-4 w-4" /></Button>
                          <Button size="sm" variant="destructive" onClick={() => removeDomain(domain.id)} disabled={domainActionId === domain.id}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-md bg-muted/40 p-3 text-sm">
                          <p className="font-medium">DNS TXT verification</p>
                          <p className="mt-2"><span className="text-muted-foreground">Type:</span> TXT</p>
                          <p><span className="text-muted-foreground">Name:</span> _verify</p>
                          <p className="break-all"><span className="text-muted-foreground">Value:</span> {domain.verificationToken}</p>
                        </div>
                        <div className="rounded-md bg-muted/40 p-3 text-sm">
                          <p className="font-medium">Root domain DNS</p>
                          <p className="mt-2"><span className="text-muted-foreground">Type:</span> A</p>
                          <p><span className="text-muted-foreground">Host:</span> @</p>
                          <p><span className="text-muted-foreground">Value:</span> Point to your server IP</p>
                        </div>
                        <div className="rounded-md bg-muted/40 p-3 text-sm">
                          <p className="font-medium">www DNS</p>
                          <p className="mt-2"><span className="text-muted-foreground">Type:</span> CNAME</p>
                          <p><span className="text-muted-foreground">Host:</span> www</p>
                          <p><span className="text-muted-foreground">Value:</span> {domain.domain}</p>
                        </div>
                      </div>

                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        Super admin action needed after verification: configure Nginx, issue SSL, and activate the domain from Admin → Domains.
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <Tabs defaultValue="template" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="template"><Image className="mr-1 h-4 w-4" />Template</TabsTrigger>
            <TabsTrigger value="colors"><Palette className="mr-1 h-4 w-4" />Colors</TabsTrigger>
            <TabsTrigger value="content"><Type className="mr-1 h-4 w-4" />Content</TabsTrigger>
            <TabsTrigger value="sections"><Users className="mr-1 h-4 w-4" />Sections</TabsTrigger>
            <TabsTrigger value="contact"><Phone className="mr-1 h-4 w-4" />Contact</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="mr-1 h-4 w-4" />Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="template">
            <div className="grid gap-4 md:grid-cols-3">
              {templates.map((t) => (
                <Card key={t.id} className={`cursor-pointer transition-all hover:shadow-lg ${config.template === t.id ? "ring-2 ring-primary" : ""}`} onClick={() => selectTemplate(t.id)}>
                  <CardContent className="pt-6 text-center">
                    <div className={`${t.color} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                      <t.icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-1">{t.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{t.desc}</p>
                    {config.template === t.id && <Badge className="gap-1"><Check className="h-3 w-3" />Selected</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="mt-6">
              <CardHeader><CardTitle>Logo</CardTitle><CardDescription>আপনার কোম্পানির লোগো আপলোড করুন (URL)</CardDescription></CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Logo URL</Label>
                    <Input placeholder="https://example.com/logo.png" value={config.logo || ""} onChange={(e) => setConfig((prev) => ({ ...prev, logo: e.target.value }))} />
                  </div>
                  {config.logo && (
                    <div className="h-16 w-16 border rounded-lg overflow-hidden flex items-center justify-center bg-muted">
                      <img src={config.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="colors">
            <Card>
              <CardHeader><CardTitle>Color Scheme</CardTitle><CardDescription>ওয়েবসাইটের রং পরিবর্তন করুন</CardDescription></CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(Object.keys(config.colors) as (keyof WebsiteConfig["colors"])[]).map((key) => (
                    <div key={key} className="space-y-2">
                      <Label className="capitalize">{key}</Label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={hslToHex(config.colors[key])} onChange={(e) => updateColor(key, hexToHsl(e.target.value))} className="w-12 h-10 rounded cursor-pointer border-0" />
                        <Input value={config.colors[key]} onChange={(e) => updateColor(key, e.target.value)} className="flex-1" placeholder="H S% L%" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 p-6 rounded-xl border">
                  <h4 className="font-semibold mb-4">Color Preview</h4>
                  <div className="flex gap-3 flex-wrap">
                    {Object.entries(config.colors).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="w-16 h-16 rounded-lg border shadow-sm" style={{ backgroundColor: `hsl(${val})` }} />
                        <span className="text-xs text-muted-foreground mt-1 block capitalize">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Hero Section</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Hero Badge</Label><Input value={config.content.heroBadge || ""} onChange={(e) => updateContent("heroBadge", e.target.value)} placeholder="e.g. Trusted Travel Partner" /></div>
                <div className="space-y-2"><Label>Hero Title</Label><Input value={config.content.heroTitle} onChange={(e) => updateContent("heroTitle", e.target.value)} /></div>
                <div className="space-y-2"><Label>Hero Subtitle</Label><Textarea value={config.content.heroSubtitle} onChange={(e) => updateContent("heroSubtitle", e.target.value)} /></div>
                <div className="space-y-2"><Label>Hero Image URL</Label><Input value={config.content.heroImage || ""} onChange={(e) => updateContent("heroImage", e.target.value)} placeholder="https://example.com/hero.jpg" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>About Section</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>About Title</Label><Input value={config.content.aboutTitle} onChange={(e) => updateContent("aboutTitle", e.target.value)} /></div>
                <div className="space-y-2"><Label>About Text</Label><Textarea value={config.content.aboutText} onChange={(e) => updateContent("aboutText", e.target.value)} rows={4} /></div>
                <div className="space-y-2"><Label>About Image URL</Label><Input value={config.content.aboutImage || ""} onChange={(e) => updateContent("aboutImage", e.target.value)} placeholder="https://example.com/about.jpg" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle>Services</CardTitle><CardDescription>আপনার সেবাসমূহ যুক্ত/সম্পাদনা করুন</CardDescription></div>
                <Button onClick={addService} size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Add</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {config.content.services.map((service, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">Icon</Label><Input value={service.icon} onChange={(e) => updateService(i, "icon", e.target.value)} placeholder="Plane, Hotel..." /></div>
                      <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={service.title} onChange={(e) => updateService(i, "title", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={service.desc} onChange={(e) => updateService(i, "desc", e.target.value)} /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeService(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle>Stats / Counter</CardTitle><CardDescription>পরিসংখ্যান যুক্ত করুন (যেমন: 5000+ Happy Travelers)</CardDescription></div>
                <Button onClick={addStat} size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Add</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {(config.content.stats || []).map((stat, i) => (
                  <div key={i} className="flex gap-3 items-center p-3 border rounded-lg">
                    <div className="flex-1 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label className="text-xs">Value</Label><Input value={stat.value} onChange={(e) => updateStat(i, "value", e.target.value)} placeholder="5000+" /></div>
                      <div className="space-y-1"><Label className="text-xs">Label</Label><Input value={stat.label} onChange={(e) => updateStat(i, "label", e.target.value)} placeholder="Happy Travelers" /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeStat(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>CTA (Call to Action)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>CTA Title</Label><Input value={config.content.ctaTitle || ""} onChange={(e) => updateContent("ctaTitle", e.target.value)} placeholder="Ready to Start?" /></div>
                <div className="space-y-2"><Label>CTA Subtitle</Label><Input value={config.content.ctaSubtitle || ""} onChange={(e) => updateContent("ctaSubtitle", e.target.value)} placeholder="Contact us today..." /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Footer</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2"><Label>Footer Text</Label><Input value={config.content.footerText} onChange={(e) => updateContent("footerText", e.target.value)} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="space-y-6">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle>Why Choose Us</CardTitle><CardDescription>কেন আপনাকে বেছে নেবে তা লিখুন</CardDescription></div>
                <Button onClick={addWhy} size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Add</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {(config.content.whyChooseUs || []).map((item, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                    <div className="flex-1 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={item.title} onChange={(e) => updateWhy(i, "title", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={item.desc} onChange={(e) => updateWhy(i, "desc", e.target.value)} /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeWhy(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle>Testimonials</CardTitle><CardDescription>গ্রাহকদের মতামত যুক্ত করুন</CardDescription></div>
                <Button onClick={addTestimonial} size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Add</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {(config.content.testimonials || []).map((testimonial, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={testimonial.name} onChange={(e) => updateTestimonial(i, "name", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Review</Label><Input value={testimonial.text} onChange={(e) => updateTestimonial(i, "text", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Date</Label><Input value={testimonial.date || ""} onChange={(e) => updateTestimonial(i, "date", e.target.value)} placeholder="2024" /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeTestimonial(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle>FAQ</CardTitle><CardDescription>সচরাচর জিজ্ঞাসিত প্রশ্ন ও উত্তর</CardDescription></div>
                <Button onClick={addFaq} size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Add</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {(config.content.faq || []).map((item, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1"><Label className="text-xs">Question</Label><Input value={item.question} onChange={(e) => updateFaq(i, "question", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Answer</Label><Textarea value={item.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} rows={2} /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeFaq(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle>Team Members</CardTitle><CardDescription>টিম মেম্বার যুক্ত করুন</CardDescription></div>
                <Button onClick={addTeam} size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Add</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {(config.content.team || []).map((member, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={member.name} onChange={(e) => updateTeam(i, "name", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Role</Label><Input value={member.role} onChange={(e) => updateTeam(i, "role", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={member.desc || ""} onChange={(e) => updateTeam(i, "desc", e.target.value)} /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeTeam(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Contact Information</CardTitle><CardDescription>যোগাযোগের তথ্য যুক্ত করুন</CardDescription></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Phone</Label><Input value={config.contactInfo?.phone || ""} onChange={(e) => setConfig((p) => ({ ...p, contactInfo: { ...p.contactInfo, phone: e.target.value } }))} placeholder="+880 1234-567890" /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={config.contactInfo?.email || ""} onChange={(e) => setConfig((p) => ({ ...p, contactInfo: { ...p.contactInfo, email: e.target.value } }))} placeholder="info@company.com" /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input value={config.contactInfo?.address || ""} onChange={(e) => setConfig((p) => ({ ...p, contactInfo: { ...p.contactInfo, address: e.target.value } }))} placeholder="Dhaka, Bangladesh" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Social Links</CardTitle><CardDescription>সোশ্যাল মিডিয়া লিংক যুক্ত করুন</CardDescription></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Facebook</Label><Input value={config.socialLinks?.facebook || ""} onChange={(e) => setConfig((p) => ({ ...p, socialLinks: { ...p.socialLinks, facebook: e.target.value } }))} placeholder="https://facebook.com/..." /></div>
                <div className="space-y-2"><Label>Instagram</Label><Input value={config.socialLinks?.instagram || ""} onChange={(e) => setConfig((p) => ({ ...p, socialLinks: { ...p.socialLinks, instagram: e.target.value } }))} placeholder="https://instagram.com/..." /></div>
                <div className="space-y-2"><Label>YouTube</Label><Input value={config.socialLinks?.youtube || ""} onChange={(e) => setConfig((p) => ({ ...p, socialLinks: { ...p.socialLinks, youtube: e.target.value } }))} placeholder="https://youtube.com/..." /></div>
                <div className="space-y-2"><Label>WhatsApp</Label><Input value={config.socialLinks?.whatsapp || ""} onChange={(e) => setConfig((p) => ({ ...p, socialLinks: { ...p.socialLinks, whatsapp: e.target.value } }))} placeholder="https://wa.me/..." /></div>
                <div className="space-y-2"><Label>Twitter/X</Label><Input value={config.socialLinks?.twitter || ""} onChange={(e) => setConfig((p) => ({ ...p, socialLinks: { ...p.socialLinks, twitter: e.target.value } }))} placeholder="https://x.com/..." /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <div className="p-12" style={{ backgroundColor: `hsl(${config.colors.primary} / 0.1)` }}>
                  <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div>
                      {config.content.heroBadge && <span className="inline-block text-xs px-3 py-1 rounded-full mb-3" style={{ backgroundColor: `hsl(${config.colors.primary} / 0.1)`, color: `hsl(${config.colors.primary})` }}>{config.content.heroBadge}</span>}
                      {config.logo && <img src={config.logo} alt="Logo" className="h-10 mb-4 object-contain" />}
                      <h2 className="text-2xl font-extrabold mb-2" style={{ color: `hsl(${config.colors.text})` }}>{config.content.heroTitle}</h2>
                      <p className="text-sm" style={{ color: `hsl(${config.colors.text} / 0.7)` }}>{config.content.heroSubtitle}</p>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" style={{ backgroundColor: `hsl(${config.colors.primary})`, color: "white" }}>View Packages</Button>
                        <Button size="sm" variant="outline" style={{ borderColor: `hsl(${config.colors.primary})`, color: `hsl(${config.colors.primary})` }}>Contact</Button>
                      </div>
                    </div>
                    <div>
                      {config.content.heroImage ? (
                        <img src={config.content.heroImage} alt="Hero" className="rounded-lg shadow-lg max-h-48 w-full object-cover" />
                      ) : (
                        <div className="h-48 rounded-lg flex items-center justify-center" style={{ backgroundColor: `hsl(${config.colors.primary} / 0.05)` }}>
                          <span className="text-sm opacity-40">Hero Image</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {config.content.stats && config.content.stats.length > 0 && (
                  <div className="p-6 grid grid-cols-4 gap-4 text-center border-b" style={{ backgroundColor: `hsl(${config.colors.background})` }}>
                    {config.content.stats.slice(0, 4).map((stat, i) => (
                      <div key={i}>
                        <div className="text-lg font-bold" style={{ color: `hsl(${config.colors.primary})` }}>{stat.value}</div>
                        <div className="text-xs opacity-60">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-8" style={{ backgroundColor: `hsl(${config.colors.background})` }}>
                  <h3 className="text-lg font-bold text-center mb-4" style={{ color: `hsl(${config.colors.text})` }}>Our Services</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {config.content.services.slice(0, 4).map((service, i) => (
                      <div key={i} className="p-3 rounded-lg border text-center" style={{ borderColor: `hsl(${config.colors.primary} / 0.2)` }}>
                        <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: `hsl(${config.colors.primary})` }}>{service.icon.charAt(0)}</div>
                        <h4 className="font-semibold text-xs">{service.title}</h4>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 text-center text-xs" style={{ backgroundColor: `hsl(${config.colors.text})`, color: `hsl(${config.colors.background})` }}>
                  {config.content.footerText}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default WebsiteCustomizer;