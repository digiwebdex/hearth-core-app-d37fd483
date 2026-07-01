import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { mapLegacyRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ShieldCheck, ArrowLeft } from "lucide-react";

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Try login without TOTP first — server returns requires2FA if needed
      const loggedInUser = await login(email, password);
      if (!loggedInUser) throw Object.assign(new Error("2FA_REQUIRED"), { requires2FA: true });
      const role = mapLegacyRole(loggedInUser.role);
      navigate(role === "super_admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      if (err.requires2FA || err.message === "2FA_REQUIRED") {
        setStep("totp");
        setTotpCode("");
      } else {
        toast({ variant: "destructive", title: "Login failed", description: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) return;
    setLoading(true);
    try {
      const loggedInUser = await login(email, password, totpCode.replace(/\s/g, ""));
      const role = mapLegacyRole(loggedInUser.role);
      navigate(role === "super_admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Invalid code", description: err.message || "Check your authenticator app" });
      setTotpCode("");
    } finally {
      setLoading(false);
    }
  };

  if (step === "totp") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-2">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your Google Authenticator app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTotp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totpCode">Authenticator Code</Label>
                <Input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  placeholder="000 000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="text-center text-2xl tracking-widest font-mono"
                  autoFocus
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || totpCode.replace(/\s/g, "").length < 6}>
                {loading ? "Verifying…" : "Verify & Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setStep("credentials"); setTotpCode(""); }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-end mb-2"><LanguageSwitcher /></div>
          <CardTitle className="text-2xl">{t("auth.welcomeBack")}</CardTitle>
          <CardDescription>{t("auth.signInSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCredentials} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("common.password")}</Label>
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">{t("common.forgotPassword")}</Link>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.signingIn") : t("common.signIn")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("common.dontHaveAccount")} <Link to="/register" className="text-primary underline">{t("common.register")}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
