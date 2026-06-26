import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import SmtpSettings from "@/components/SmtpSettings";
import WhatsAppSettings from "@/components/WhatsAppSettings";
import DataExport from "@/components/DataExport";
import ModuleSettings from "@/components/ModuleSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, ArrowRight, User, Lock, Bell, ShieldCheck,
  Loader2, CheckCircle2, Eye, EyeOff,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";
async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
  return res.json();
}

interface NotifSettings {
  smsEnabled: boolean;
  notifyOnBooking: boolean;
  notifyOnPayment: boolean;
  notifyOnLead: boolean;
}

const SettingsPage = () => {
  const { t } = useTranslation();
  const { user, refreshTenant, appRole } = useAuth();
  const { toast } = useToast();

  // ── Profile state ──
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Password state ──
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // ── Notification state ──
  const [notif, setNotif] = useState<NotifSettings>({ smsEnabled: true, notifyOnBooking: true, notifyOnPayment: true, notifyOnLead: true });
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifLoaded, setNotifLoaded] = useState(false);

  const isOwner = appRole === "tenant_owner" || appRole === "owner";

  useEffect(() => {
    if (user) setName(user.name || "");
  }, [user]);

  useEffect(() => {
    if (!isOwner) return;
    apiFetch<NotifSettings>("/tenants/me/notification-settings")
      .then((d) => { setNotif(d); setNotifLoaded(true); })
      .catch(() => setNotifLoaded(true));
  }, [isOwner]);

  async function saveProfile() {
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ name }) });
      await refreshTenant();
      toast({ title: "Profile updated" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!currentPw || !newPw) return;
    if (newPw !== confirmPw) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      toast({ title: "Password changed successfully" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to change", variant: "destructive" });
    } finally {
      setSavingPw(false);
    }
  }

  async function saveNotif(patch: Partial<NotifSettings>) {
    const next = { ...notif, ...patch };
    setNotif(next);
    setSavingNotif(true);
    try {
      await apiFetch("/tenants/me/notification-settings", { method: "PATCH", body: JSON.stringify(patch) });
      toast({ title: "Notification settings saved" });
    } catch (err: unknown) {
      setNotif(notif);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSavingNotif(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">

        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("pages.settingsTitle", "Settings")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("pages.settingsSubtitle", "Manage your account, notifications, and integrations")}</p>
        </div>

        {/* ── My Profile ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" /> My Profile
            </CardTitle>
            <CardDescription>Update your display name and account email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prof-name">{t("common.fullName", "Full Name")}</Label>
                <Input
                  id="prof-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.email", "Email")}</Label>
                <Input value={user?.email || ""} disabled className="bg-muted text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={saveProfile} disabled={savingProfile || !name.trim()} size="sm">
                {savingProfile ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />{t("pages.updateProfile", "Update Profile")}</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Change Password ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-primary" /> Change Password
            </CardTitle>
            <CardDescription>Set a new password for your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min 8 characters"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  className={confirmPw && confirmPw !== newPw ? "border-red-400" : ""}
                />
                {confirmPw && confirmPw !== newPw && <p className="text-xs text-red-500">Passwords don't match</p>}
              </div>
            </div>
            <Button onClick={changePassword} disabled={savingPw || !currentPw || !newPw || !confirmPw} size="sm">
              {savingPw ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : <><ShieldCheck className="mr-2 h-3.5 w-3.5" />Change Password</>}
            </Button>
          </CardContent>
        </Card>

        {/* ── Notification Preferences ── */}
        {isOwner && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-primary" /> Notification Preferences
              </CardTitle>
              <CardDescription>Choose which events trigger WhatsApp and SMS alerts to your agency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "notifyOnLead" as keyof NotifSettings, label: "New Web Inquiries / Leads", desc: "Get notified when a visitor submits a booking or inquiry from your website" },
                { key: "notifyOnBooking" as keyof NotifSettings, label: "New Bookings & Quotations", desc: "Alert when a new booking or quotation is created in the system" },
                { key: "notifyOnPayment" as keyof NotifSettings, label: "Payment Received", desc: "Alert when a payment is recorded against an invoice" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <Switch
                    checked={notif[key] as boolean}
                    disabled={savingNotif || !notifLoaded}
                    onCheckedChange={(v) => saveNotif({ [key]: v })}
                  />
                </div>
              ))}
              <Separator />
              <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">SMS Notifications</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enable or disable all SMS notifications globally (requires SMS provider configured)</p>
                </div>
                <Switch
                  checked={notif.smsEnabled}
                  disabled={savingNotif || !notifLoaded}
                  onCheckedChange={(v) => saveNotif({ smsEnabled: v })}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Module Settings ── */}
        <ModuleSettings />

        {/* ── Billing ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-primary" /> {t("pages.billingSection", "Billing & Subscription")}
                </CardTitle>
                <CardDescription>{t("pages.billingDesc", "Manage your plan, payments, and subscription status")}</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings/billing">
                  {t("pages.manageBilling", "Manage Billing")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* ── SMTP ── */}
        <SmtpSettings />

        {/* ── WhatsApp ── */}
        <WhatsAppSettings />

        {/* ── Data Export ── */}
        <DataExport />

        {/* ── Tax Rules ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">Tax &amp; VAT Rules</CardTitle>
                <CardDescription>Configure tax rates for invoices and quotations</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings/tax">
                  Manage Tax Rules <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
