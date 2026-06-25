import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings, Globe, Mail, CreditCard, Upload, Save, Loader2, CheckCircle2,
  Send, Eye, EyeOff, Shield, MessageSquare, Smartphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GatewayStatusPanel } from "@/components/admin/GatewayStatusPanel";
import { smsApi, type SmsConfig } from "@/lib/smsApi";

// ── Types ──
interface GeneralSettings {
  appName: string;
  logoUrl: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  maintenanceMode: boolean;
  supportEmail: string;
  metaDescription: string;
}

interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  enabled: boolean;
}

interface PaymentSettings {
  sslcommerzStoreId: string;
  sslcommerzStorePass: string;
  sslcommerzSandbox: boolean;
  sslcommerzEnabled: boolean;
  bkashAppKey: string;
  bkashAppSecret: string;
  bkashUsername: string;
  bkashPassword: string;
  bkashSandbox: boolean;
  bkashEnabled: boolean;
  manualPaymentEnabled: boolean;
  manualPaymentInstructions: string;
}

interface DomainSettings {
  mainDomain: string;
  subdomainPrefix: string;
  sslEnabled: boolean;
  customDomainEnabled: boolean;
  defaultSubdomain: string;
}

interface SmsSettings {
  provider: "sslwireless" | "bulksms";
  apiKey: string;
  senderId: string;
  baseUrl: string;
  enabled: boolean;
  apiKeyConfigured?: boolean;
  envManagedMessage?: string;
}

// ── Defaults ──
const defaultGeneral: GeneralSettings = {
  appName: "Travel Agency Website & Software Solution",
  logoUrl: "",
  currency: "BDT",
  currencySymbol: "৳",
  timezone: "Asia/Dhaka",
  maintenanceMode: false,
  supportEmail: "support@travelagencyweb.com",
  metaDescription: "Complete Travel Agency Website & Software Solution",
};

const defaultEmail: EmailSettings = {
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  fromName: "TAWSS",
  fromEmail: "noreply@travelagencyweb.com",
  enabled: false,
};

const defaultPayment: PaymentSettings = {
  sslcommerzStoreId: "",
  sslcommerzStorePass: "",
  sslcommerzSandbox: true,
  sslcommerzEnabled: false,
  bkashAppKey: "",
  bkashAppSecret: "",
  bkashUsername: "",
  bkashPassword: "",
  bkashSandbox: true,
  bkashEnabled: false,
  manualPaymentEnabled: true,
  manualPaymentInstructions: "Send payment to bKash: 01XXXXXXXXX\nOr transfer to bank: [Account Details]",
};

const defaultDomain: DomainSettings = {
  mainDomain: "travelagencyweb.com",
  subdomainPrefix: "app",
  sslEnabled: true,
  customDomainEnabled: true,
  defaultSubdomain: "{company}.travelagencyweb.com",
};

const defaultSms: SmsSettings = {
  provider: "sslwireless",
  apiKey: "",
  senderId: "",
  baseUrl: "",
  enabled: false,
};

const AdminSettings = () => {
  const { t } = useTranslation();
  const [general, setGeneral] = useState<GeneralSettings>(defaultGeneral);
  const [email, setEmail] = useState<EmailSettings>(defaultEmail);
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [domain, setDomain] = useState<DomainSettings>(defaultDomain);
  const [sms, setSms] = useState<SmsSettings>(defaultSms);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const togglePass = (key: string) => setShowPasswords((p) => ({ ...p, [key]: !p[key] }));

  useEffect(() => {
    smsApi.getConfig()
      .then((config) => setSms((prev) => ({
        ...prev,
        provider: config.provider,
        senderId: config.senderId,
        baseUrl: config.baseUrl,
        enabled: config.enabled,
        apiKeyConfigured: config.apiKeyConfigured,
        apiKey: "",
        envManagedMessage: config.message,
      })))
      .catch(() => {});
  }, []);

  const handleSave = async (section: string) => {
    setSaving(true);
    try {
      if (section === t("adminSettings.tabs.sms")) {
        const updated = await smsApi.updateConfig({
          provider: sms.provider,
          senderId: sms.senderId,
          baseUrl: sms.baseUrl,
          enabled: sms.enabled,
        });
        setSms((prev) => ({
          ...prev,
          provider: updated.provider,
          senderId: updated.senderId,
          baseUrl: updated.baseUrl,
          enabled: updated.enabled,
          apiKeyConfigured: updated.apiKeyConfigured,
          envManagedMessage: updated.message,
        }));
        toast({
          title: t("adminSettings.toast.saved", { section }),
          description: updated.message || t("adminSettings.toast.savedDesc"),
        });
      } else {
        await new Promise((r) => setTimeout(r, 800));
        toast({ title: t("adminSettings.toast.saved", { section }), description: t("adminSettings.toast.savedDesc") });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast({ title: t("adminSettings.toast.saveFailed", { defaultValue: "Save failed" }), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    toast({ title: t("adminSettings.toast.testEmailSent"), description: t("adminSettings.toast.testEmailDesc", { email: testEmail }) });
    setTestEmail("");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8" /> {t("adminSettings.title")}
          </h1>
          <p className="text-muted-foreground">{t("adminSettings.subtitle")}</p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general" className="gap-1.5"><Settings className="h-4 w-4" /> {t("adminSettings.tabs.general")}</TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5"><Mail className="h-4 w-4" /> {t("adminSettings.tabs.email")}</TabsTrigger>
            <TabsTrigger value="sms" className="gap-1.5"><Smartphone className="h-4 w-4" /> {t("adminSettings.tabs.sms")}</TabsTrigger>
            <TabsTrigger value="payment" className="gap-1.5"><CreditCard className="h-4 w-4" /> {t("adminSettings.tabs.payment")}</TabsTrigger>
            <TabsTrigger value="domain" className="gap-1.5"><Globe className="h-4 w-4" /> {t("adminSettings.tabs.domain")}</TabsTrigger>
          </TabsList>

          {/* ════════ GENERAL ════════ */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>{t("adminSettings.general.title")}</CardTitle>
                <CardDescription>{t("adminSettings.general.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("adminSettings.general.appName")}</Label>
                    <Input value={general.appName} onChange={(e) => setGeneral({ ...general, appName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.general.supportEmail")}</Label>
                    <Input type="email" value={general.supportEmail} onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("adminSettings.general.logo")}</Label>
                  <div className="flex items-center gap-4">
                    {general.logoUrl ? (
                      <img src={general.logoUrl} alt="Logo" className="h-12 w-12 rounded-md object-cover border" />
                    ) : (
                      <div className="h-12 w-12 rounded-md border border-dashed flex items-center justify-center">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <Input
                      type="url"
                      placeholder={t("adminSettings.general.logoPlaceholder")}
                      value={general.logoUrl}
                      onChange={(e) => setGeneral({ ...general, logoUrl: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{t("adminSettings.general.currency")}</Label>
                    <Select value={general.currency} onValueChange={(v) => setGeneral({ ...general, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BDT">BDT - Bangladeshi Taka</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.general.currencySymbol")}</Label>
                    <Input value={general.currencySymbol} onChange={(e) => setGeneral({ ...general, currencySymbol: e.target.value })} maxLength={5} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.general.timezone")}</Label>
                    <Select value={general.timezone} onValueChange={(v) => setGeneral({ ...general, timezone: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Dhaka">Asia/Dhaka (GMT+6)</SelectItem>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</SelectItem>
                        <SelectItem value="Asia/Riyadh">Asia/Riyadh (GMT+3)</SelectItem>
                        <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("adminSettings.general.metaDescription")}</Label>
                  <Textarea value={general.metaDescription} onChange={(e) => setGeneral({ ...general, metaDescription: e.target.value })} rows={2} maxLength={300} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{t("adminSettings.general.maintenance")}</p>
                    <p className="text-sm text-muted-foreground">{t("adminSettings.general.maintenanceDesc")}</p>
                  </div>
                  <Switch checked={general.maintenanceMode} onCheckedChange={(v) => setGeneral({ ...general, maintenanceMode: v })} />
                </div>

                <Button onClick={() => handleSave(t("adminSettings.tabs.general"))} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {t("adminSettings.general.saveBtn")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════ EMAIL ════════ */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> {t("adminSettings.email.title")}</CardTitle>
                <CardDescription>{t("adminSettings.email.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{t("adminSettings.email.enable")}</p>
                    <p className="text-sm text-muted-foreground">{t("adminSettings.email.enableDesc")}</p>
                  </div>
                  <Switch checked={email.enabled} onCheckedChange={(v) => setEmail({ ...email, enabled: v })} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("adminSettings.email.host")}</Label>
                    <Input placeholder="smtp.gmail.com" value={email.smtpHost} onChange={(e) => setEmail({ ...email, smtpHost: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.email.port")}</Label>
                    <Input type="number" placeholder="587" value={email.smtpPort} onChange={(e) => setEmail({ ...email, smtpPort: parseInt(e.target.value) || 587 })} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch checked={email.smtpSecure} onCheckedChange={(v) => setEmail({ ...email, smtpSecure: v })} />
                  <Label>{t("adminSettings.email.ssl")}</Label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("adminSettings.email.user")}</Label>
                    <Input placeholder="your@email.com" value={email.smtpUser} onChange={(e) => setEmail({ ...email, smtpUser: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.email.pass")}</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords.smtp ? "text" : "password"}
                        placeholder="••••••••"
                        value={email.smtpPass}
                        onChange={(e) => setEmail({ ...email, smtpPass: e.target.value })}
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => togglePass("smtp")}>
                        {showPasswords.smtp ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("adminSettings.email.fromName")}</Label>
                    <Input placeholder="Travel Agency Website & Software Solution" value={email.fromName} onChange={(e) => setEmail({ ...email, fromName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.email.fromEmail")}</Label>
                    <Input type="email" placeholder="noreply@travelagencyweb.com" value={email.fromEmail} onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })} />
                  </div>
                </div>

                <Button onClick={() => handleSave(t("adminSettings.tabs.email"))} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {t("adminSettings.email.saveBtn")}
                </Button>

                {/* Test Email */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">{t("adminSettings.email.testTitle")}</h4>
                  <div className="flex gap-2">
                    <Input placeholder={t("adminSettings.email.testPlaceholder")} type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="max-w-xs" />
                    <Button variant="outline" onClick={handleTestEmail} disabled={!testEmail}>
                      <Send className="mr-2 h-4 w-4" /> {t("adminSettings.common.sendTest")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════ PAYMENT ════════ */}
          <TabsContent value="payment">
            <div className="space-y-4">
            <GatewayStatusPanel />
              {/* SSLCommerz */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" /> {t("adminSettings.payment.ssl.title")}
                  </CardTitle>
                  <CardDescription>{t("adminSettings.payment.ssl.desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{t("adminSettings.payment.ssl.enable")}</p>
                      <p className="text-sm text-muted-foreground">{t("adminSettings.payment.ssl.enableDesc")}</p>
                    </div>
                    <Switch checked={payment.sslcommerzEnabled} onCheckedChange={(v) => setPayment({ ...payment, sslcommerzEnabled: v })} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("adminSettings.payment.ssl.storeId")}</Label>
                      <Input placeholder="your_store_id" value={payment.sslcommerzStoreId} onChange={(e) => setPayment({ ...payment, sslcommerzStoreId: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminSettings.payment.ssl.storePass")}</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords.ssl ? "text" : "password"}
                          placeholder="••••••••"
                          value={payment.sslcommerzStorePass}
                          onChange={(e) => setPayment({ ...payment, sslcommerzStorePass: e.target.value })}
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => togglePass("ssl")}>
                          {showPasswords.ssl ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={payment.sslcommerzSandbox} onCheckedChange={(v) => setPayment({ ...payment, sslcommerzSandbox: v })} />
                    <Label>{t("adminSettings.payment.ssl.sandbox")}</Label>
                  </div>
                </CardContent>
              </Card>

              {/* bKash */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-pink-500" /> {t("adminSettings.payment.bkash.title")}
                  </CardTitle>
                  <CardDescription>{t("adminSettings.payment.bkash.desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{t("adminSettings.payment.bkash.enable")}</p>
                      <p className="text-sm text-muted-foreground">{t("adminSettings.payment.bkash.enableDesc")}</p>
                    </div>
                    <Switch checked={payment.bkashEnabled} onCheckedChange={(v) => setPayment({ ...payment, bkashEnabled: v })} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("adminSettings.payment.bkash.appKey")}</Label>
                      <Input placeholder="bKash App Key" value={payment.bkashAppKey} onChange={(e) => setPayment({ ...payment, bkashAppKey: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminSettings.payment.bkash.appSecret")}</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords.bkashSecret ? "text" : "password"}
                          placeholder="••••••••"
                          value={payment.bkashAppSecret}
                          onChange={(e) => setPayment({ ...payment, bkashAppSecret: e.target.value })}
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => togglePass("bkashSecret")}>
                          {showPasswords.bkashSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminSettings.payment.bkash.username")}</Label>
                      <Input placeholder="bKash Username" value={payment.bkashUsername} onChange={(e) => setPayment({ ...payment, bkashUsername: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminSettings.payment.bkash.password")}</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords.bkashPass ? "text" : "password"}
                          placeholder="••••••••"
                          value={payment.bkashPassword}
                          onChange={(e) => setPayment({ ...payment, bkashPassword: e.target.value })}
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => togglePass("bkashPass")}>
                          {showPasswords.bkashPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={payment.bkashSandbox} onCheckedChange={(v) => setPayment({ ...payment, bkashSandbox: v })} />
                    <Label>{t("adminSettings.payment.bkash.sandbox")}</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Manual Payment */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("adminSettings.payment.manual.title")}</CardTitle>
                  <CardDescription>{t("adminSettings.payment.manual.desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{t("adminSettings.payment.manual.enable")}</p>
                      <p className="text-sm text-muted-foreground">{t("adminSettings.payment.manual.enableDesc")}</p>
                    </div>
                    <Switch checked={payment.manualPaymentEnabled} onCheckedChange={(v) => setPayment({ ...payment, manualPaymentEnabled: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.payment.manual.instructions")}</Label>
                    <Textarea
                      value={payment.manualPaymentInstructions}
                      onChange={(e) => setPayment({ ...payment, manualPaymentInstructions: e.target.value })}
                      rows={4}
                      placeholder={t("adminSettings.payment.manual.instructionsPlaceholder")}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button onClick={() => handleSave(t("adminSettings.tabs.payment"))} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {t("adminSettings.payment.saveBtn")}
              </Button>
            </div>
          </TabsContent>

          {/* ════════ DOMAIN ════════ */}
          <TabsContent value="domain">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> {t("adminSettings.domain.title")}</CardTitle>
                <CardDescription>{t("adminSettings.domain.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("adminSettings.domain.main")}</Label>
                    <Input value={domain.mainDomain} onChange={(e) => setDomain({ ...domain, mainDomain: e.target.value })} placeholder="travelagencyweb.com" />
                    <p className="text-xs text-muted-foreground">{t("adminSettings.domain.mainHelp")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.domain.prefix")}</Label>
                    <Input value={domain.subdomainPrefix} onChange={(e) => setDomain({ ...domain, subdomainPrefix: e.target.value })} placeholder="app" />
                    <p className="text-xs text-muted-foreground">{t("adminSettings.domain.prefixHelp")}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("adminSettings.domain.pattern")}</Label>
                  <Input value={domain.defaultSubdomain} onChange={(e) => setDomain({ ...domain, defaultSubdomain: e.target.value })} placeholder="{company}.travelagencyweb.com" />
                  <p className="text-xs text-muted-foreground">{t("adminSettings.domain.patternHelp", { ph: "{company}" })}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{t("adminSettings.domain.ssl")}</p>
                      <p className="text-sm text-muted-foreground">{t("adminSettings.domain.sslDesc")}</p>
                    </div>
                    <Switch checked={domain.sslEnabled} onCheckedChange={(v) => setDomain({ ...domain, sslEnabled: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{t("adminSettings.domain.customDomain")}</p>
                      <p className="text-sm text-muted-foreground">{t("adminSettings.domain.customDomainDesc")}</p>
                    </div>
                    <Switch checked={domain.customDomainEnabled} onCheckedChange={(v) => setDomain({ ...domain, customDomainEnabled: v })} />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">{t("adminSettings.domain.dnsGuide")}</p>
                  <div className="space-y-1 text-xs text-muted-foreground font-mono">
                    <p>A Record: @ → Your Server IP</p>
                    <p>A Record: *.{domain.mainDomain} → Your Server IP</p>
                    <p>CNAME: www → {domain.mainDomain}</p>
                  </div>
                </div>

                <Button onClick={() => handleSave(t("adminSettings.tabs.domain"))} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {t("adminSettings.domain.saveBtn")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════ SMS ════════ */}
          <TabsContent value="sms">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" /> {t("adminSettings.sms.title")}
                </CardTitle>
                <CardDescription>{t("adminSettings.sms.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{t("adminSettings.sms.enable")}</p>
                    <p className="text-sm text-muted-foreground">{t("adminSettings.sms.enableDesc")}</p>
                  </div>
                  <Switch checked={sms.enabled} onCheckedChange={(v) => setSms({ ...sms, enabled: v })} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("adminSettings.sms.provider")}</Label>
                    <Select value={sms.provider} onValueChange={(v: "sslwireless" | "bulksms") => setSms({ ...sms, provider: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sslwireless">SSL Wireless</SelectItem>
                        <SelectItem value="bulksms">BulkSMS BD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.sms.senderId")}</Label>
                    <Input
                      placeholder="e.g. TAWSS"
                      value={sms.senderId}
                      onChange={(e) => setSms({ ...sms, senderId: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">{t("adminSettings.sms.senderIdHelp")}</p>
                  </div>
                </div>

                {sms.envManagedMessage && (
                  <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">{sms.envManagedMessage}</p>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("adminSettings.sms.apiKey")}</Label>
                    <Input
                      readOnly
                      disabled
                      placeholder={sms.apiKeyConfigured ? "Configured via environment" : "Not configured"}
                      value={sms.apiKeyConfigured ? "••••••••" : ""}
                    />
                    <p className="text-xs text-muted-foreground">Set SMS_API_KEY or TWILIO_* in server environment variables.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("adminSettings.sms.baseUrl")}</Label>
                    <Input
                      placeholder={sms.provider === "sslwireless" ? "https://smsplus.sslwireless.com/api/v3" : "https://bulksmsbd.net/api"}
                      value={sms.baseUrl}
                      onChange={(e) => setSms({ ...sms, baseUrl: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">{t("adminSettings.sms.baseUrlHelp")}</p>
                  </div>
                </div>

                <Button onClick={() => handleSave(t("adminSettings.tabs.sms"))} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {t("adminSettings.sms.saveBtn")}
                </Button>

                {/* Test SMS */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">{t("adminSettings.sms.testTitle")}</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("adminSettings.sms.testPlaceholder")}
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button variant="outline" onClick={async () => {
                      if (!testPhone) return;
                      try {
                        const res = await smsApi.testSms(testPhone);
                        toast({ title: t("adminSettings.toast.testSmsSent"), description: res.success ? t("adminSettings.toast.testSmsDelivered") : res.error });
                        setTestPhone("");
                      } catch (err: any) {
                        toast({ title: t("adminSettings.toast.testFailed"), description: err.message, variant: "destructive" });
                      }
                    }} disabled={!testPhone}>
                      <Send className="mr-2 h-4 w-4" /> {t("adminSettings.common.sendTest")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
