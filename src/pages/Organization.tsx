import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { tenantApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Phone, Globe, MapPin, Mail, Calendar, Settings2,
  CreditCard, Star, CheckCircle2, Loader2, Link as LinkIcon,
  Clock, DollarSign, Plane, Moon, Briefcase, Shield, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

const COUNTRIES = [
  "Bangladesh", "Afghanistan", "Bahrain", "Egypt", "India", "Indonesia",
  "Jordan", "Kuwait", "Malaysia", "Maldives", "Nepal", "Oman",
  "Pakistan", "Qatar", "Saudi Arabia", "Singapore", "Sri Lanka",
  "Thailand", "Turkey", "UAE", "United Kingdom", "United States", "Other",
];

const CURRENCIES = [
  { code: "BDT", label: "BDT — Bangladeshi Taka" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "SAR", label: "SAR — Saudi Riyal" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "MYR", label: "MYR — Malaysian Ringgit" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "THB", label: "THB — Thai Baht" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "PKR", label: "PKR — Pakistani Rupee" },
  { code: "NPR", label: "NPR — Nepalese Rupee" },
];

const TIMEZONES = [
  { value: "Asia/Dhaka", label: "Asia/Dhaka (GMT+6) — Bangladesh" },
  { value: "Asia/Karachi", label: "Asia/Karachi (GMT+5) — Pakistan" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (GMT+5:30) — India" },
  { value: "Asia/Kathmandu", label: "Asia/Kathmandu (GMT+5:45) — Nepal" },
  { value: "Asia/Colombo", label: "Asia/Colombo (GMT+5:30) — Sri Lanka" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GMT+4) — UAE" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh (GMT+3) — Saudi Arabia" },
  { value: "Asia/Kuwait", label: "Asia/Kuwait (GMT+3) — Kuwait" },
  { value: "Asia/Qatar", label: "Asia/Qatar (GMT+3) — Qatar" },
  { value: "Asia/Muscat", label: "Asia/Muscat (GMT+4) — Oman" },
  { value: "Asia/Bahrain", label: "Asia/Bahrain (GMT+3) — Bahrain" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (GMT+8) — Malaysia" },
  { value: "Asia/Singapore", label: "Asia/Singapore (GMT+8) — Singapore" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (GMT+7) — Thailand" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta (GMT+7) — Indonesia" },
  { value: "Europe/London", label: "Europe/London (GMT+0/+1) — UK" },
  { value: "America/New_York", label: "America/New_York (GMT-5/-4) — US East" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-8/-7) — US West" },
];

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "secondary" },
  basic: { label: "Basic", color: "secondary" },
  pro: { label: "Pro", color: "default" },
  business: { label: "Business", color: "default" },
  enterprise: { label: "Enterprise", color: "default" },
};

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="rounded-lg bg-primary/10 p-2 mt-0.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-base">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

const Organization = () => {
  const { t } = useTranslation();
  const { tenant, refreshTenant } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    website: "",
    address: "",
    city: "",
    country: "",
    currency: "BDT",
    timezone: "Asia/Dhaka",
  });

  const [modules, setModules] = useState({
    enableHajjUmrahModule: true,
    enableBdOperationsModule: false,
  });

  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (tenant && !loaded) {
      setForm({
        name: tenant.name || "",
        phone: tenant.phone || "",
        whatsapp: tenant.whatsapp || "",
        website: tenant.website || "",
        address: tenant.address || "",
        city: tenant.city || "",
        country: tenant.country || "",
        currency: tenant.currency || "BDT",
        timezone: tenant.timezone || "Asia/Dhaka",
      });
      setModules({
        enableHajjUmrahModule: tenant.enableHajjUmrahModule ?? true,
        enableBdOperationsModule: tenant.enableBdOperationsModule ?? false,
      });
      setLoaded(true);
    }
  }, [tenant, loaded]);

  async function save(section: string, data: Record<string, unknown>) {
    setSaving(section);
    try {
      await tenantApi.update(data as Parameters<typeof tenantApi.update>[0]);
      await refreshTenant();
      toast({ title: "Saved", description: "Changes saved successfully." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const plan = tenant?.subscriptionPlan || "free";
  const planMeta = PLAN_LABELS[plan] || PLAN_LABELS.free;
  const appUrl = `https://app.travelagencyweb.com/site/${tenant?.slug || ""}`;
  const siteUrl = window.location.hostname !== "app.travelagencyweb.com"
    ? `https://${window.location.hostname}`
    : appUrl;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("pages.organizationTitle", "Organization")}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t("pages.organizationSubtitle", "Manage your agency profile, branding, and settings")}</p>
          </div>
          <a href={siteUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              View Website
            </Button>
          </a>
        </div>

        {/* ── 1. Agency Identity ── */}
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Building2}
              title="Agency Identity"
              description="Your agency name and public-facing URL slug"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">Agency / Company Name <span className="text-red-500">*</span></Label>
                <Input id="org-name" value={form.name} onChange={set("name")} placeholder="Your Agency Name" />
              </div>
              <div className="space-y-2">
                <Label>Website Slug (URL)</Label>
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">
                    app.travelagencyweb.com/site/<strong>{tenant?.slug || "your-agency"}</strong>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Slug is set at registration. Contact support to change.</p>
              </div>
            </div>
            <Button
              onClick={() => save("identity", { name: form.name })}
              disabled={saving === "identity"}
              size="sm"
            >
              {saving === "identity" ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Agency Name"}
            </Button>
          </CardContent>
        </Card>

        {/* ── 2. Contact Information ── */}
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Phone}
              title="Contact Information"
              description="Phone, WhatsApp, email, and website — used for client communication and public profile"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-phone">
                  <Phone className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Primary Phone
                </Label>
                <Input id="org-phone" value={form.phone} onChange={set("phone")} placeholder="+880 1XXX-XXXXXX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-wa">
                  <Phone className="inline h-3.5 w-3.5 mr-1 text-green-600" />
                  WhatsApp Number
                </Label>
                <Input id="org-wa" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+880 1XXX-XXXXXX" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="org-web">
                  <Globe className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Agency Website
                </Label>
                <Input id="org-web" value={form.website} onChange={set("website")} placeholder="https://youragency.com" />
              </div>
            </div>
            <Button
              onClick={() => save("contact", { phone: form.phone, whatsapp: form.whatsapp, website: form.website })}
              disabled={saving === "contact"}
              size="sm"
            >
              {saving === "contact" ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Contact Info"}
            </Button>
          </CardContent>
        </Card>

        {/* ── 3. Address ── */}
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={MapPin}
              title="Office Address"
              description="Shown on your public website and invoices"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-addr">Street Address</Label>
              <Input id="org-addr" value={form.address} onChange={set("address")} placeholder="House, Road, Area" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-city">City / District</Label>
                <Input id="org-city" value={form.city} onChange={set("city")} placeholder="Dhaka" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={form.country || ""} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => save("address", { address: form.address, city: form.city, country: form.country })}
              disabled={saving === "address"}
              size="sm"
            >
              {saving === "address" ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Address"}
            </Button>
          </CardContent>
        </Card>

        {/* ── 4. Currency & Timezone ── */}
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={DollarSign}
              title="Currency & Timezone"
              description="Used across invoices, reports, and the entire ERP system"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  <Clock className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Timezone
                </Label>
                <Select value={form.timezone} onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => save("locale", { currency: form.currency, timezone: form.timezone })}
              disabled={saving === "locale"}
              size="sm"
            >
              {saving === "locale" ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Currency & Timezone"}
            </Button>
          </CardContent>
        </Card>

        {/* ── 5. Module Toggles ── */}
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Settings2}
              title="Business Modules"
              description="Enable or disable modules based on your agency's services"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2">
                    <Moon className="h-4 w-4 text-green-700" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Hajj & Umrah Module</p>
                    <p className="text-xs text-muted-foreground">Pilgrim management, groups, Mecca packages, ziyarat</p>
                  </div>
                </div>
                <Switch
                  checked={modules.enableHajjUmrahModule}
                  onCheckedChange={(v) => setModules((m) => ({ ...m, enableHajjUmrahModule: v }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <Briefcase className="h-4 w-4 text-blue-700" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Bangladesh Operations Module</p>
                    <p className="text-xs text-muted-foreground">Manpower, overseas recruitment, and BD domestic services</p>
                  </div>
                </div>
                <Switch
                  checked={modules.enableBdOperationsModule}
                  onCheckedChange={(v) => setModules((m) => ({ ...m, enableBdOperationsModule: v }))}
                />
              </div>
            </div>
            <Button
              onClick={() => save("modules", { enableHajjUmrahModule: modules.enableHajjUmrahModule, enableBdOperationsModule: modules.enableBdOperationsModule })}
              disabled={saving === "modules"}
              size="sm"
            >
              {saving === "modules" ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Module Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* ── 6. Quick Links ── */}
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={LinkIcon}
              title="Quick Links"
              description="Jump to related settings from here"
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { to: "/website", icon: Globe, label: "Website & CMS", desc: "Edit homepage, packages, theme" },
                { to: "/website/publish", icon: Shield, label: "Domain & Publish", desc: "Custom domain, SSL, publish guide" },
                { to: "/website/seo", icon: Star, label: "SEO Settings", desc: "Meta title, description, OG image" },
                { to: "/team", icon: Building2, label: "Team Members", desc: "Add or manage staff accounts" },
                { to: "/settings/billing", icon: CreditCard, label: "Subscription & Billing", desc: "Upgrade, invoices, plan info" },
                { to: "/settings", icon: Settings2, label: "System Settings", desc: "SMS, WhatsApp, email, integrations" },
              ].map(({ to, icon: Icon, label, desc }) => (
                <Link key={to} to={to}>
                  <div className="flex items-start gap-3 rounded-xl border p-3 hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer h-full">
                    <div className="rounded-lg bg-primary/10 p-1.5 mt-0.5 shrink-0">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── 7. Subscription ── */}
        <Card className={plan === "enterprise" ? "border-primary/40 bg-primary/[0.02]" : ""}>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={CreditCard}
              title="Subscription & Plan"
              description="Your current plan, usage limits, and billing"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Current plan:</span>
                  <Badge variant={planMeta.color as "default" | "secondary"} className="capitalize text-sm px-3 py-0.5">
                    {planMeta.label}
                  </Badge>
                  {tenant?.subscriptionStatus === "active" && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  )}
                  {tenant?.subscriptionStatus === "trial" && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" /> Trial
                    </span>
                  )}
                </div>
                {tenant?.subscriptionExpiry && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Valid until: <strong>{new Date(tenant.subscriptionExpiry).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}</strong>
                  </p>
                )}
              </div>
              {plan !== "enterprise" && (
                <Link to="/settings/billing">
                  <Button className="gap-2 shrink-0">
                    <Star className="h-4 w-4" />
                    Upgrade Plan
                  </Button>
                </Link>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Building2, label: "Plan", value: planMeta.label },
                { icon: Plane, label: "Modules", value: [modules.enableHajjUmrahModule && "Hajj/Umrah", modules.enableBdOperationsModule && "BD Ops"].filter(Boolean).join(", ") || "Core" },
                { icon: Globe, label: "Custom Domain", value: plan === "pro" || plan === "business" || plan === "enterprise" ? "Enabled" : "Pro+ only" },
                { icon: Mail, label: "Email Notify", value: "Enabled" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default Organization;
