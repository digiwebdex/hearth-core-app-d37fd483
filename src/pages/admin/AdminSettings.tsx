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
import { Badge } from "@/components/ui/badge";
import {
  Settings, Globe, Mail, CreditCard, Upload, Save, Loader2, CheckCircle2,
  Send, Eye, EyeOff, Shield, MessageSquare, Smartphone, MessageCircle,
  KeyRound, AlertTriangle, Info, Zap, CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GatewayStatusPanel } from "@/components/admin/GatewayStatusPanel";
import { smsApi, type SmsConfig } from "@/lib/smsApi";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const authReq = (path: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem("token");
  return fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  }).then(async (r) => {
    if (!r.ok) { const e = await r.json().catch(() => ({ message: r.statusText })); throw new Error(e.message); }
    return r.json();
  });
};

// ── Types ──
interface GeneralSettings { appName: string; logoUrl: string; currency: string; currencySymbol: string; timezone: string; maintenanceMode: boolean; supportEmail: string; metaDescription: string; }
interface EmailSettings { smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string; smtpPass: string; fromName: string; fromEmail: string; enabled: boolean; }
interface PaymentSettings { sslcommerzStoreId: string; sslcommerzStorePass: string; sslcommerzSandbox: boolean; sslcommerzEnabled: boolean; bkashAppKey: string; bkashAppSecret: string; bkashUsername: string; bkashPassword: string; bkashSandbox: boolean; bkashEnabled: boolean; manualPaymentEnabled: boolean; manualPaymentInstructions: string; }
interface DomainSettings { mainDomain: string; subdomainPrefix: string; sslEnabled: boolean; customDomainEnabled: boolean; defaultSubdomain: string; }
interface SmsSettings { provider: "sslwireless" | "bulksms"; apiKey: string; senderId: string; baseUrl: string; enabled: boolean; apiKeyConfigured?: boolean; envManagedMessage?: string; }
interface WhatsAppSettings { provider: "wasender" | "meta" | "twilio" | "console"; wasenderApiKey: string; metaToken: string; metaPhoneId: string; twilioSid: string; twilioToken: string; twilioFrom: string; configured: boolean; wasenderKeyConfigured: boolean; }

const defaultGeneral: GeneralSettings = { appName: "Travel Agency Website & Software Solution", logoUrl: "", currency: "BDT", currencySymbol: "৳", timezone: "Asia/Dhaka", maintenanceMode: false, supportEmail: "support@travelagencyweb.com", metaDescription: "Complete Travel Agency Website & Software Solution" };
const defaultEmail: EmailSettings = { smtpHost: "", smtpPort: 587, smtpSecure: false, smtpUser: "", smtpPass: "", fromName: "TAWSS", fromEmail: "noreply@travelagencyweb.com", enabled: false };
const defaultPayment: PaymentSettings = { sslcommerzStoreId: "", sslcommerzStorePass: "", sslcommerzSandbox: true, sslcommerzEnabled: false, bkashAppKey: "", bkashAppSecret: "", bkashUsername: "", bkashPassword: "", bkashSandbox: true, bkashEnabled: false, manualPaymentEnabled: true, manualPaymentInstructions: "Send payment to bKash: 01XXXXXXXXX\nOr transfer to bank: [Account Details]" };
const defaultDomain: DomainSettings = { mainDomain: "travelagencyweb.com", subdomainPrefix: "app", sslEnabled: true, customDomainEnabled: true, defaultSubdomain: "{company}.travelagencyweb.com" };
const defaultSms: SmsSettings = { provider: "sslwireless", apiKey: "", senderId: "", baseUrl: "", enabled: false };
const defaultWA: WhatsAppSettings = { provider: "console", wasenderApiKey: "", metaToken: "", metaPhoneId: "", twilioSid: "", twilioToken: "", twilioFrom: "", configured: false, wasenderKeyConfigured: false };

const PasswordInput = ({ value, onChange, placeholder = "••••••••", id }: { value: string; onChange: (v: string) => void; placeholder?: string; id: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" />
      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShow((s) => !s)}>
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};

const InfoBox = ({ children, variant = "info" }: { children: React.ReactNode; variant?: "info" | "warning" | "success" }) => {
  const cls = { info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200", warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200", success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200" }[variant];
  const Icon = { info: Info, warning: AlertTriangle, success: CheckCircle }[variant];
  return <div className={`flex gap-2 rounded-lg border p-3 text-sm ${cls}`}><Icon className="h-4 w-4 mt-0.5 shrink-0" /><div>{children}</div></div>;
};

const AdminSettings = () => {
  const { t } = useTranslation();
  const [general, setGeneral] = useState<GeneralSettings>(defaultGeneral);
  const [email, setEmail] = useState<EmailSettings>(defaultEmail);
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [domain, setDomain] = useState<DomainSettings>(defaultDomain);
  const [sms, setSms] = useState<SmsSettings>(defaultSms);
  const [wa, setWa] = useState<WhatsAppSettings>(defaultWA);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testWaPhone, setTestWaPhone] = useState("");
  const [testWaMsg, setTestWaMsg] = useState("Test WhatsApp message from Travel Agency ERP");
  const [sendingWaTest, setSendingWaTest] = useState(false);

  // Password reset
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPass, setResettingPass] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    smsApi.getConfig()
      .then((config) => setSms((prev) => ({ ...prev, provider: config.provider, senderId: config.senderId, baseUrl: config.baseUrl, enabled: config.enabled, apiKeyConfigured: config.apiKeyConfigured, apiKey: "", envManagedMessage: config.message })))
      .catch(() => {});

    authReq("/whatsapp/config")
      .then((cfg: any) => setWa((prev) => ({ ...prev, provider: cfg.provider || "console", configured: cfg.configured, wasenderKeyConfigured: cfg.wasenderKeyConfigured, metaPhoneId: cfg.metaPhoneId || "", twilioFrom: cfg.twilioFrom || "" })))
      .catch(() => {});
  }, []);

  const handleSave = async (section: string) => {
    setSaving(true);
    try {
      if (section === t("adminSettings.tabs.sms")) {
        const updated = await smsApi.updateConfig({ provider: sms.provider, senderId: sms.senderId, baseUrl: sms.baseUrl, enabled: sms.enabled });
        setSms((prev) => ({ ...prev, provider: updated.provider, senderId: updated.senderId, baseUrl: updated.baseUrl, enabled: updated.enabled, apiKeyConfigured: updated.apiKeyConfigured, envManagedMessage: updated.message }));
        toast({ title: t("adminSettings.toast.saved", { section }), description: updated.message || t("adminSettings.toast.savedDesc") });
      } else {
        await new Promise((r) => setTimeout(r, 600));
        toast({ title: t("adminSettings.toast.saved", { section }), description: t("adminSettings.toast.savedDesc") });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 8) { toast({ title: "Too short", description: "Password must be at least 8 characters.", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" }); return; }
    setResettingPass(true);
    try {
      await authReq("/auth/super-admin/reset-password", { method: "POST", body: JSON.stringify({ newPassword }) });
      toast({ title: "Password updated", description: "Your super admin password has been changed successfully." });
      setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setResettingPass(false); }
  };

  const handleWaTest = async () => {
    if (!testWaPhone || !testWaMsg) return;
    setSendingWaTest(true);
    try {
      const res = await authReq("/whatsapp/send", { method: "POST", body: JSON.stringify({ to: testWaPhone, message: testWaMsg }) });
      toast({ title: res.success ? "WhatsApp sent!" : "Send failed", description: res.success ? `Provider: ${res.provider} | ID: ${res.messageId}` : res.error, variant: res.success ? "default" : "destructive" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSendingWaTest(false); }
  };

  const PROVIDER_DOCS: Record<string, { label: string; color: string; envVars: string[]; docsUrl: string; description: string }> = {
    wasender: { label: "WasenderAPI", color: "bg-green-500", envVars: ["WHATSAPP_PROVIDER=wasender", "WASENDER_API_KEY=your_api_key"], docsUrl: "https://wasenderapi.com", description: "Best for Bangladesh. Uses WhatsApp Business through WasenderAPI cloud service. Easy setup, no WhatsApp Business approval needed." },
    meta: { label: "Meta Cloud API", color: "bg-blue-500", envVars: ["WHATSAPP_PROVIDER=meta", "META_WHATSAPP_TOKEN=your_token", "META_WHATSAPP_PHONE_ID=your_phone_id"], docsUrl: "https://developers.facebook.com/docs/whatsapp", description: "Official WhatsApp Business Cloud API by Meta/Facebook. Requires WhatsApp Business account approval." },
    twilio: { label: "Twilio WhatsApp", color: "bg-red-500", envVars: ["WHATSAPP_PROVIDER=twilio", "TWILIO_ACCOUNT_SID=ACxxxxxxxx", "TWILIO_AUTH_TOKEN=your_token", "WHATSAPP_FROM_NUMBER=whatsapp:+14155238886"], docsUrl: "https://www.twilio.com/whatsapp", description: "Twilio sandbox & production WhatsApp. Reliable but requires Twilio account." },
    console: { label: "Console (Dev Mode)", color: "bg-gray-500", envVars: ["WHATSAPP_PROVIDER=console"], docsUrl: "", description: "No messages are sent. All WhatsApp calls are logged to server console only. Use this during development." },
  };

  const currentProviderInfo = PROVIDER_DOCS[wa.provider] || PROVIDER_DOCS.console;

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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="general" className="gap-1"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
            <TabsTrigger value="security" className="gap-1"><KeyRound className="h-3.5 w-3.5" /> Security</TabsTrigger>
            <TabsTrigger value="email" className="gap-1"><Mail className="h-3.5 w-3.5" /> Email</TabsTrigger>
            <TabsTrigger value="sms" className="gap-1"><Smartphone className="h-3.5 w-3.5" /> SMS</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</TabsTrigger>
            <TabsTrigger value="payment" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Payment</TabsTrigger>
            <TabsTrigger value="domain" className="gap-1"><Globe className="h-3.5 w-3.5" /> Domain</TabsTrigger>
          </TabsList>

          {/* ════════ GENERAL ════════ */}
          <TabsContent value="general">
            <Card>
              <CardHeader><CardTitle>{t("adminSettings.general.title")}</CardTitle><CardDescription>{t("adminSettings.general.desc")}</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>{t("adminSettings.general.appName")}</Label><Input value={general.appName} onChange={(e) => setGeneral({ ...general, appName: e.target.value })} /></div>
                  <div className="space-y-2"><Label>{t("adminSettings.general.supportEmail")}</Label><Input type="email" value={general.supportEmail} onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>{t("adminSettings.general.logo")}</Label>
                  <div className="flex items-center gap-4">
                    {general.logoUrl ? <img src={general.logoUrl} alt="Logo" className="h-12 w-12 rounded-md object-cover border" /> : <div className="h-12 w-12 rounded-md border border-dashed flex items-center justify-center"><Upload className="h-5 w-5 text-muted-foreground" /></div>}
                    <Input type="url" placeholder={t("adminSettings.general.logoPlaceholder")} value={general.logoUrl} onChange={(e) => setGeneral({ ...general, logoUrl: e.target.value })} className="flex-1" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2"><Label>{t("adminSettings.general.currency")}</Label>
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
                  <div className="space-y-2"><Label>{t("adminSettings.general.currencySymbol")}</Label><Input value={general.currencySymbol} onChange={(e) => setGeneral({ ...general, currencySymbol: e.target.value })} maxLength={5} /></div>
                  <div className="space-y-2"><Label>{t("adminSettings.general.timezone")}</Label>
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
                <div className="space-y-2"><Label>{t("adminSettings.general.metaDescription")}</Label><Textarea value={general.metaDescription} onChange={(e) => setGeneral({ ...general, metaDescription: e.target.value })} rows={2} maxLength={300} /></div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-medium">{t("adminSettings.general.maintenance")}</p><p className="text-sm text-muted-foreground">{t("adminSettings.general.maintenanceDesc")}</p></div>
                  <Switch checked={general.maintenanceMode} onCheckedChange={(v) => setGeneral({ ...general, maintenanceMode: v })} />
                </div>
                <Button onClick={() => handleSave(t("adminSettings.tabs.general"))} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t("adminSettings.general.saveBtn")}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════ SECURITY ════════ */}
          <TabsContent value="security">
            <div className="space-y-4">
              {/* Password Reset */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Super Admin Password Reset</CardTitle>
                  <CardDescription>Change your super admin account password directly. No current password required.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <InfoBox variant="warning">
                    This resets the <strong>super admin</strong> account password. This action is immediate and cannot be undone. Make sure to save your new password securely.
                  </InfoBox>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-pass">New Password</Label>
                      <PasswordInput id="new-pass" value={newPassword} onChange={setNewPassword} placeholder="Min. 8 characters" />
                      <p className="text-xs text-muted-foreground">Use a strong password with letters, numbers & symbols.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-pass">Confirm New Password</Label>
                      <PasswordInput id="confirm-pass" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat new password" />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Passwords do not match</p>
                      )}
                      {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                        <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Passwords match</p>
                      )}
                    </div>
                  </div>

                  {/* Strength indicator */}
                  {newPassword && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Password strength</p>
                      <div className="flex gap-1">
                        {[8, 10, 12, 16].map((len, i) => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${newPassword.length >= len ? ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-500"][i] : "bg-muted"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {newPassword.length < 8 ? "Too short" : newPassword.length < 10 ? "Weak" : newPassword.length < 12 ? "Fair" : newPassword.length < 16 ? "Good" : "Strong"}
                      </p>
                    </div>
                  )}

                  <Button onClick={handlePasswordReset} disabled={resettingPass || !newPassword || newPassword !== confirmPassword || newPassword.length < 8} className="gap-2">
                    {resettingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    {resettingPass ? "Updating…" : "Update Password"}
                  </Button>
                </CardContent>
              </Card>

              {/* 2FA Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-green-600" /> Two-Factor Authentication (2FA)</CardTitle>
                  <CardDescription>Manage Google Authenticator 2FA for the super admin account.</CardDescription>
                </CardHeader>
                <CardContent>
                  <InfoBox variant="info">
                    Google Authenticator 2FA setup is managed from the <strong>Two-Factor Auth</strong> page in the sidebar. Once enabled, you will be prompted for a 6-digit code on every login.
                  </InfoBox>
                  <Button variant="outline" className="mt-4 gap-2" onClick={() => window.location.href = "/admin/two-factor"}>
                    <Shield className="h-4 w-4" /> Go to Two-Factor Auth Setup
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ════════ EMAIL ════════ */}
          <TabsContent value="email">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> {t("adminSettings.email.title")}</CardTitle><CardDescription>{t("adminSettings.email.desc")}</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-medium">{t("adminSettings.email.enable")}</p><p className="text-sm text-muted-foreground">{t("adminSettings.email.enableDesc")}</p></div>
                  <Switch checked={email.enabled} onCheckedChange={(v) => setEmail({ ...email, enabled: v })} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>{t("adminSettings.email.host")}</Label><Input placeholder="smtp.gmail.com" value={email.smtpHost} onChange={(e) => setEmail({ ...email, smtpHost: e.target.value })} /></div>
                  <div className="space-y-2"><Label>{t("adminSettings.email.port")}</Label><Input type="number" placeholder="587" value={email.smtpPort} onChange={(e) => setEmail({ ...email, smtpPort: parseInt(e.target.value) || 587 })} /></div>
                </div>
                <div className="flex items-center gap-3"><Switch checked={email.smtpSecure} onCheckedChange={(v) => setEmail({ ...email, smtpSecure: v })} /><Label>{t("adminSettings.email.ssl")}</Label></div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>{t("adminSettings.email.user")}</Label><Input placeholder="your@email.com" value={email.smtpUser} onChange={(e) => setEmail({ ...email, smtpUser: e.target.value })} /></div>
                  <div className="space-y-2"><Label>{t("adminSettings.email.pass")}</Label><PasswordInput id="smtp-pass" value={email.smtpPass} onChange={(v) => setEmail({ ...email, smtpPass: v })} /></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>{t("adminSettings.email.fromName")}</Label><Input value={email.fromName} onChange={(e) => setEmail({ ...email, fromName: e.target.value })} /></div>
                  <div className="space-y-2"><Label>{t("adminSettings.email.fromEmail")}</Label><Input type="email" value={email.fromEmail} onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })} /></div>
                </div>
                <Button onClick={() => handleSave(t("adminSettings.tabs.email"))} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t("adminSettings.email.saveBtn")}</Button>
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">{t("adminSettings.email.testTitle")}</h4>
                  <div className="flex gap-2">
                    <Input placeholder={t("adminSettings.email.testPlaceholder")} type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="max-w-xs" />
                    <Button variant="outline" onClick={() => { toast({ title: t("adminSettings.toast.testEmailSent"), description: t("adminSettings.toast.testEmailDesc", { email: testEmail }) }); setTestEmail(""); }} disabled={!testEmail}><Send className="mr-2 h-4 w-4" /> {t("adminSettings.common.sendTest")}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════ SMS ════════ */}
          <TabsContent value="sms">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /> {t("adminSettings.sms.title")}</CardTitle><CardDescription>{t("adminSettings.sms.desc")}</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-medium">{t("adminSettings.sms.enable")}</p><p className="text-sm text-muted-foreground">{t("adminSettings.sms.enableDesc")}</p></div>
                  <Switch checked={sms.enabled} onCheckedChange={(v) => setSms({ ...sms, enabled: v })} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>{t("adminSettings.sms.provider")}</Label>
                    <Select value={sms.provider} onValueChange={(v: "sslwireless" | "bulksms") => setSms({ ...sms, provider: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sslwireless">SSL Wireless</SelectItem>
                        <SelectItem value="bulksms">BulkSMS BD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>{t("adminSettings.sms.senderId")}</Label><Input placeholder="e.g. TAWSS" value={sms.senderId} onChange={(e) => setSms({ ...sms, senderId: e.target.value })} /><p className="text-xs text-muted-foreground">{t("adminSettings.sms.senderIdHelp")}</p></div>
                </div>
                {sms.envManagedMessage && <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">{sms.envManagedMessage}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>{t("adminSettings.sms.apiKey")}</Label><Input readOnly disabled placeholder={sms.apiKeyConfigured ? "Configured via environment" : "Not configured"} value={sms.apiKeyConfigured ? "••••••••" : ""} /><p className="text-xs text-muted-foreground">Set SMS_API_KEY in server .env</p></div>
                  <div className="space-y-2"><Label>{t("adminSettings.sms.baseUrl")}</Label><Input placeholder={sms.provider === "sslwireless" ? "https://smsplus.sslwireless.com/api/v3" : "https://bulksmsbd.net/api"} value={sms.baseUrl} onChange={(e) => setSms({ ...sms, baseUrl: e.target.value })} /></div>
                </div>
                <Button onClick={() => handleSave(t("adminSettings.tabs.sms"))} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t("adminSettings.sms.saveBtn")}</Button>
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">{t("adminSettings.sms.testTitle")}</h4>
                  <div className="flex gap-2">
                    <Input placeholder={t("adminSettings.sms.testPlaceholder")} type="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className="max-w-xs" />
                    <Button variant="outline" onClick={async () => { try { const res = await smsApi.testSms(testPhone); toast({ title: t("adminSettings.toast.testSmsSent"), description: res.success ? t("adminSettings.toast.testSmsDelivered") : res.error }); setTestPhone(""); } catch (err: any) { toast({ title: t("adminSettings.toast.testFailed"), description: err.message, variant: "destructive" }); } }} disabled={!testPhone}><Send className="mr-2 h-4 w-4" /> {t("adminSettings.common.sendTest")}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════ WHATSAPP ════════ */}
          <TabsContent value="whatsapp">
            <div className="space-y-4">
              {/* Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-green-500" /> WhatsApp Configuration
                    <Badge className={`ml-2 text-white ${wa.configured ? "bg-green-500" : "bg-gray-400"}`}>
                      {wa.configured ? "✓ Configured" : "Not Configured"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Configure the WhatsApp provider used for all system notifications — subscription alerts, payment updates, drip messages, etc.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Provider selector */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Select Provider</Label>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      {(["wasender", "meta", "twilio", "console"] as const).map((p) => {
                        const info = PROVIDER_DOCS[p];
                        const isActive = wa.provider === p;
                        return (
                          <button
                            key={p}
                            onClick={() => setWa({ ...wa, provider: p })}
                            className={`text-left rounded-xl border-2 p-4 transition-all ${isActive ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-2.5 h-2.5 rounded-full ${info.color}`} />
                              <span className="text-sm font-semibold">{info.label}</span>
                              {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{info.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Provider-specific fields */}
                  {wa.provider === "wasender" && (
                    <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-300">
                          <Zap className="h-4 w-4" /> WasenderAPI Setup
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <InfoBox variant="success">
                          <strong>Recommended for Bangladesh.</strong> Get your API key from <strong>wasenderapi.com</strong> — create an account, connect your WhatsApp number, and copy the API key.
                        </InfoBox>
                        <div className="space-y-2">
                          <Label>Wasender API Key</Label>
                          <PasswordInput id="wasender-key" value={wa.wasenderApiKey} onChange={(v) => setWa({ ...wa, wasenderApiKey: v })} placeholder="wa_xxxxxxxxxxxxxxxxxxxxxxxx" />
                          {wa.wasenderKeyConfigured && !wa.wasenderApiKey && (
                            <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> API key is already configured via environment variable.</p>
                          )}
                          <p className="text-xs text-muted-foreground">Set <code className="bg-muted px-1 rounded">WASENDER_API_KEY</code> in your server <code className="bg-muted px-1 rounded">.env</code> file.</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-3 font-mono text-xs space-y-1">
                          <p className="text-muted-foreground font-sans text-xs font-medium mb-2">Add to server .env:</p>
                          {PROVIDER_DOCS.wasender.envVars.map((v) => <p key={v} className="text-foreground">{v}</p>)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {wa.provider === "meta" && (
                    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-blue-800 dark:text-blue-300">
                          <MessageCircle className="h-4 w-4" /> Meta WhatsApp Business Cloud API
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <InfoBox variant="info">
                          Requires a <strong>Meta Business account</strong> and approved WhatsApp Business phone number. Get your credentials from <strong>developers.facebook.com</strong>.
                        </InfoBox>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Access Token</Label>
                            <PasswordInput id="meta-token" value={wa.metaToken} onChange={(v) => setWa({ ...wa, metaToken: v })} placeholder="EAAxxxxxxxx..." />
                            <p className="text-xs text-muted-foreground">Set <code className="bg-muted px-1 rounded">META_WHATSAPP_TOKEN</code> in .env</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Phone Number ID</Label>
                            <Input value={wa.metaPhoneId} onChange={(e) => setWa({ ...wa, metaPhoneId: e.target.value })} placeholder="1234567890" />
                            <p className="text-xs text-muted-foreground">Set <code className="bg-muted px-1 rounded">META_WHATSAPP_PHONE_ID</code> in .env</p>
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-3 font-mono text-xs space-y-1">
                          <p className="text-muted-foreground font-sans text-xs font-medium mb-2">Add to server .env:</p>
                          {PROVIDER_DOCS.meta.envVars.map((v) => <p key={v} className="text-foreground">{v}</p>)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {wa.provider === "twilio" && (
                    <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-red-800 dark:text-red-300">
                          <MessageCircle className="h-4 w-4" /> Twilio WhatsApp
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <InfoBox variant="info">
                          Use Twilio's WhatsApp sandbox for testing or production with an approved number. Get credentials from <strong>console.twilio.com</strong>.
                        </InfoBox>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Account SID</Label>
                            <Input value={wa.twilioSid} onChange={(e) => setWa({ ...wa, twilioSid: e.target.value })} placeholder="ACxxxxxxxxxxxxxxxx" />
                            <p className="text-xs text-muted-foreground">Set <code className="bg-muted px-1 rounded">TWILIO_ACCOUNT_SID</code> in .env</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Auth Token</Label>
                            <PasswordInput id="twilio-token" value={wa.twilioToken} onChange={(v) => setWa({ ...wa, twilioToken: v })} placeholder="••••••••" />
                            <p className="text-xs text-muted-foreground">Set <code className="bg-muted px-1 rounded">TWILIO_AUTH_TOKEN</code> in .env</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>From Number</Label>
                          <Input value={wa.twilioFrom} onChange={(e) => setWa({ ...wa, twilioFrom: e.target.value })} placeholder="whatsapp:+14155238886" />
                          <p className="text-xs text-muted-foreground">Set <code className="bg-muted px-1 rounded">WHATSAPP_FROM_NUMBER</code> in .env (include <code>whatsapp:</code> prefix)</p>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-3 font-mono text-xs space-y-1">
                          <p className="text-muted-foreground font-sans text-xs font-medium mb-2">Add to server .env:</p>
                          {PROVIDER_DOCS.twilio.envVars.map((v) => <p key={v} className="text-foreground">{v}</p>)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {wa.provider === "console" && (
                    <InfoBox variant="warning">
                      <strong>Console mode is active.</strong> No WhatsApp messages will be delivered. All sends are printed to the server log. Switch to a real provider for production use.
                    </InfoBox>
                  )}

                  {/* How it's used */}
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">What sends WhatsApp messages?</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        {[
                          "✅ Subscription activated / renewed / upgraded",
                          "📅 Subscription extended / scheduled",
                          "⛔ Subscription suspended or cancelled",
                          "📩 Payment request submitted by agency",
                          "✅ Payment approved by admin",
                          "❌ Payment rejected / needs info",
                          "📢 Trial day-1 & day-2 onboarding drips (SMS/Email only — WhatsApp drip disabled)",
                        ].map((item) => <li key={item} className="flex items-start gap-2">{item}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              {/* Test WhatsApp */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4 text-green-500" /> Test WhatsApp Message</CardTitle>
                  <CardDescription>Send a test message to verify the current provider is working correctly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input value={testWaPhone} onChange={(e) => setTestWaPhone(e.target.value)} placeholder="+8801XXXXXXXXX" />
                      <p className="text-xs text-muted-foreground">Include country code (e.g. +880 for Bangladesh)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Input value={testWaMsg} onChange={(e) => setTestWaMsg(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleWaTest} disabled={sendingWaTest || !testWaPhone} className="gap-2">
                    {sendingWaTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sendingWaTest ? "Sending…" : "Send Test Message"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ════════ PAYMENT ════════ */}
          <TabsContent value="payment">
            <div className="space-y-4">
              <GatewayStatusPanel />
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> {t("adminSettings.payment.ssl.title")}</CardTitle><CardDescription>{t("adminSettings.payment.ssl.desc")}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium">{t("adminSettings.payment.ssl.enable")}</p><p className="text-sm text-muted-foreground">{t("adminSettings.payment.ssl.enableDesc")}</p></div><Switch checked={payment.sslcommerzEnabled} onCheckedChange={(v) => setPayment({ ...payment, sslcommerzEnabled: v })} /></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>{t("adminSettings.payment.ssl.storeId")}</Label><Input placeholder="your_store_id" value={payment.sslcommerzStoreId} onChange={(e) => setPayment({ ...payment, sslcommerzStoreId: e.target.value })} /></div>
                    <div className="space-y-2"><Label>{t("adminSettings.payment.ssl.storePass")}</Label><PasswordInput id="ssl-pass" value={payment.sslcommerzStorePass} onChange={(v) => setPayment({ ...payment, sslcommerzStorePass: v })} /></div>
                  </div>
                  <div className="flex items-center gap-3"><Switch checked={payment.sslcommerzSandbox} onCheckedChange={(v) => setPayment({ ...payment, sslcommerzSandbox: v })} /><Label>{t("adminSettings.payment.ssl.sandbox")}</Label></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-pink-500" /> {t("adminSettings.payment.bkash.title")}</CardTitle><CardDescription>{t("adminSettings.payment.bkash.desc")}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium">{t("adminSettings.payment.bkash.enable")}</p><p className="text-sm text-muted-foreground">{t("adminSettings.payment.bkash.enableDesc")}</p></div><Switch checked={payment.bkashEnabled} onCheckedChange={(v) => setPayment({ ...payment, bkashEnabled: v })} /></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>{t("adminSettings.payment.bkash.appKey")}</Label><Input value={payment.bkashAppKey} onChange={(e) => setPayment({ ...payment, bkashAppKey: e.target.value })} /></div>
                    <div className="space-y-2"><Label>{t("adminSettings.payment.bkash.appSecret")}</Label><PasswordInput id="bkash-secret" value={payment.bkashAppSecret} onChange={(v) => setPayment({ ...payment, bkashAppSecret: v })} /></div>
                    <div className="space-y-2"><Label>{t("adminSettings.payment.bkash.username")}</Label><Input value={payment.bkashUsername} onChange={(e) => setPayment({ ...payment, bkashUsername: e.target.value })} /></div>
                    <div className="space-y-2"><Label>{t("adminSettings.payment.bkash.password")}</Label><PasswordInput id="bkash-pass" value={payment.bkashPassword} onChange={(v) => setPayment({ ...payment, bkashPassword: v })} /></div>
                  </div>
                  <div className="flex items-center gap-3"><Switch checked={payment.bkashSandbox} onCheckedChange={(v) => setPayment({ ...payment, bkashSandbox: v })} /><Label>{t("adminSettings.payment.bkash.sandbox")}</Label></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>{t("adminSettings.payment.manual.title")}</CardTitle><CardDescription>{t("adminSettings.payment.manual.desc")}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium">{t("adminSettings.payment.manual.enable")}</p><p className="text-sm text-muted-foreground">{t("adminSettings.payment.manual.enableDesc")}</p></div><Switch checked={payment.manualPaymentEnabled} onCheckedChange={(v) => setPayment({ ...payment, manualPaymentEnabled: v })} /></div>
                  <div className="space-y-2"><Label>{t("adminSettings.payment.manual.instructions")}</Label><Textarea value={payment.manualPaymentInstructions} onChange={(e) => setPayment({ ...payment, manualPaymentInstructions: e.target.value })} rows={4} /></div>
                </CardContent>
              </Card>
              <Button onClick={() => handleSave(t("adminSettings.tabs.payment"))} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t("adminSettings.payment.saveBtn")}</Button>
            </div>
          </TabsContent>

          {/* ════════ DOMAIN ════════ */}
          <TabsContent value="domain">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> {t("adminSettings.domain.title")}</CardTitle><CardDescription>{t("adminSettings.domain.desc")}</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>{t("adminSettings.domain.main")}</Label><Input value={domain.mainDomain} onChange={(e) => setDomain({ ...domain, mainDomain: e.target.value })} placeholder="travelagencyweb.com" /><p className="text-xs text-muted-foreground">{t("adminSettings.domain.mainHelp")}</p></div>
                  <div className="space-y-2"><Label>{t("adminSettings.domain.prefix")}</Label><Input value={domain.subdomainPrefix} onChange={(e) => setDomain({ ...domain, subdomainPrefix: e.target.value })} placeholder="app" /><p className="text-xs text-muted-foreground">{t("adminSettings.domain.prefixHelp")}</p></div>
                </div>
                <div className="space-y-2"><Label>{t("adminSettings.domain.pattern")}</Label><Input value={domain.defaultSubdomain} onChange={(e) => setDomain({ ...domain, defaultSubdomain: e.target.value })} /><p className="text-xs text-muted-foreground">{t("adminSettings.domain.patternHelp", { ph: "{company}" })}</p></div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium">{t("adminSettings.domain.ssl")}</p><p className="text-sm text-muted-foreground">{t("adminSettings.domain.sslDesc")}</p></div><Switch checked={domain.sslEnabled} onCheckedChange={(v) => setDomain({ ...domain, sslEnabled: v })} /></div>
                  <div className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium">{t("adminSettings.domain.customDomain")}</p><p className="text-sm text-muted-foreground">{t("adminSettings.domain.customDomainDesc")}</p></div><Switch checked={domain.customDomainEnabled} onCheckedChange={(v) => setDomain({ ...domain, customDomainEnabled: v })} /></div>
                </div>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">{t("adminSettings.domain.dnsGuide")}</p>
                  <div className="space-y-1 text-xs text-muted-foreground font-mono">
                    <p>A Record: @ → Your Server IP</p>
                    <p>A Record: *.{domain.mainDomain} → Your Server IP</p>
                    <p>CNAME: www → {domain.mainDomain}</p>
                  </div>
                </div>
                <Button onClick={() => handleSave(t("adminSettings.tabs.domain"))} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{t("adminSettings.domain.saveBtn")}</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
