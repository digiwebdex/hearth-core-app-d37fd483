import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";
import { ShieldCheck, ShieldOff, Smartphone, RefreshCw } from "lucide-react";

const AdminTwoFactor = () => {
  const { toast } = useToast();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<"idle" | "setup" | "disable">("idle");

  useEffect(() => {
    authApi.totpStatus().then((r) => {
      setTotpEnabled(r.totpEnabled);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const startSetup = async () => {
    setSaving(true);
    try {
      const data = await authApi.totpSetup();
      setSetupData(data);
      setPhase("setup");
      setCode("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const confirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.totpEnable(code.replace(/\s/g, ""));
      setTotpEnabled(true);
      setPhase("idle");
      setSetupData(null);
      setCode("");
      toast({ title: "2FA Enabled", description: "Google Authenticator is now active for your account." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Invalid code", description: err.message });
      setCode("");
    } finally {
      setSaving(false);
    }
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.totpDisable(code.replace(/\s/g, ""));
      setTotpEnabled(false);
      setPhase("idle");
      setCode("");
      toast({ title: "2FA Disabled", description: "Two-factor authentication has been turned off." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Invalid code", description: err.message });
      setCode("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-lg mx-auto space-y-6 py-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Two-Factor Authentication
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Google Authenticator (TOTP) — super admin account only
          </p>
        </div>

        {loading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
        ) : phase === "idle" ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Status</CardTitle>
                <Badge variant={totpEnabled ? "default" : "outline"} className={totpEnabled ? "bg-green-600" : ""}>
                  {totpEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <CardDescription>
                {totpEnabled
                  ? "Your super admin account is protected with Google Authenticator. A 6-digit code is required on every login."
                  : "Enable 2FA to require a Google Authenticator code on every super admin login. No lockout — unlimited attempts allowed."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totpEnabled ? (
                <div className="space-y-3">
                  <Button variant="destructive" onClick={() => { setPhase("disable"); setCode(""); }}>
                    <ShieldOff className="mr-2 h-4 w-4" /> Disable 2FA
                  </Button>
                  <p className="text-xs text-muted-foreground">You will need your authenticator code to turn off 2FA.</p>
                </div>
              ) : (
                <Button onClick={startSetup} disabled={saving}>
                  <Smartphone className="mr-2 h-4 w-4" />
                  {saving ? "Generating…" : "Set Up Google Authenticator"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : phase === "setup" && setupData ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scan QR Code</CardTitle>
              <CardDescription>
                Open Google Authenticator (or Authy), tap <strong>+</strong>, then scan this QR code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <img src={setupData.qrDataUrl} alt="TOTP QR Code" className="rounded border p-2 bg-white w-48 h-48" />
              </div>
              <div className="rounded bg-muted p-3 text-xs font-mono break-all text-center text-muted-foreground">
                {setupData.secret}
                <p className="mt-1 text-xs normal-case">Manual entry key (if QR scan fails)</p>
              </div>
              <form onSubmit={confirmEnable} className="space-y-3">
                <div className="space-y-1">
                  <Label>Enter the 6-digit code from the app to confirm</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    maxLength={7}
                    placeholder="000 000"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="text-center text-xl tracking-widest font-mono"
                    autoFocus
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || code.replace(/\s/g, "").length < 6} className="flex-1">
                    {saving ? "Verifying…" : "Activate 2FA"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setPhase("idle"); setSetupData(null); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : phase === "disable" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disable 2FA</CardTitle>
              <CardDescription>Enter your current authenticator code to confirm.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={confirmDisable} className="space-y-3">
                <div className="space-y-1">
                  <Label>Authenticator Code</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    maxLength={7}
                    placeholder="000 000"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="text-center text-xl tracking-widest font-mono"
                    autoFocus
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="destructive" disabled={saving || code.replace(/\s/g, "").length < 6} className="flex-1">
                    {saving ? "Disabling…" : "Confirm Disable"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setPhase("idle"); setCode(""); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-dashed">
          <CardContent className="py-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">How it works</p>
            <p>• After entering your password, you'll be asked for a 6-digit code from the app.</p>
            <p>• The code refreshes every 30 seconds — no lockout, unlimited attempts.</p>
            <p>• Use Google Authenticator, Authy, or any TOTP-compatible app.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminTwoFactor;
