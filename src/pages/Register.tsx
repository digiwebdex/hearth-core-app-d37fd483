import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { PLANS, getDisplayMonthlyPrice, getPlanPrice, type BillingCycle } from "@/lib/plans";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { validateEmail, validatePhone } from "@/lib/contactValidation";

const Register = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const planParam = (searchParams.get("plan") || "pro").toLowerCase();
  const billingParam = (searchParams.get("billing") || "monthly").toLowerCase();
  const billingCycle: BillingCycle = billingParam === "yearly" ? "yearly" : "monthly";
  const selectedPlan = useMemo(
    () => PLANS.find((p) => p.id === planParam) || PLANS.find((p) => p.id === "pro") || PLANS[0],
    [planParam]
  );
  const displayPrice = useMemo(() => getDisplayMonthlyPrice(selectedPlan, billingCycle), [selectedPlan, billingCycle]);
  const billingTotal = useMemo(() => getPlanPrice(selectedPlan.id, billingCycle), [selectedPlan, billingCycle]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isFree = selectedPlan.id === "free";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      toast({ variant: "destructive", title: t("auth.validationFailed"), description: emailCheck.message });
      return;
    }

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) {
      toast({ variant: "destructive", title: t("auth.validationFailed"), description: phoneCheck.message });
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        name: name.trim(),
        email: emailCheck.email,
        phone: phoneCheck.phone,
        password,
        tenantName: tenantName.trim(),
        plan: selectedPlan.id,
      });
      if (result.pendingApproval) {
        toast({ title: "Account submitted", description: result.message || "Pending admin approval." });
        navigate("/login");
      } else {
        toast({
          title: isFree ? t("common.welcome") : "🎉 3-day Pro Trial Started!",
          description: isFree ? "Your free account is ready." : "Explore all Pro features for the next 3 days.",
        });
        navigate("/onboarding");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      toast({ variant: "destructive", title: "Registration failed", description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-end mb-2"><LanguageSwitcher /></div>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t("auth.registerTitle")}</CardTitle>
          <CardDescription>{t("auth.registerSubtitle")}</CardDescription>
          <div className="mt-3 flex flex-col items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {t("common.selectedPlan")}: <span className="ml-1 font-semibold">{selectedPlan.name}</span>
              {displayPrice > 0 && (
                <span className="ml-2 text-muted-foreground">
                  · {billingCycle === "yearly" ? t("marketing.pricing.yearly") : t("marketing.pricing.monthly")}
                  {" "}৳{billingCycle === "yearly" ? billingTotal.toLocaleString() : displayPrice.toLocaleString()}
                  {billingCycle === "yearly" ? t("marketing.pricing.perYear") : t("common.perMonth")}
                </span>
              )}
            </Badge>
            {billingCycle === "yearly" && displayPrice > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{t("marketing.pricing.save2Months")}</p>
            )}
            {!isFree && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 text-xs font-medium">
                <Clock className="h-3.5 w-3.5" />
                {t("auth.trialBadge")}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("common.fullName")} *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantName">{t("common.agencyName")} *</Label>
              <Input id="tenantName" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")} *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("auth.phone")} *</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("auth.phonePlaceholder")}
                required
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">{t("auth.phoneHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")} *</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.creating") : isFree ? t("common.createAccount") : t("common.startFreeTrial")}
            </Button>
            <div className="space-y-1.5 pt-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {t("common.noCreditCard")}</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {t("common.instantAccess")}</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {t("common.cancelAnytime")}</p>
            </div>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("common.alreadyHaveAccount")} <Link to="/login" className="text-primary underline">{t("common.signIn")}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
