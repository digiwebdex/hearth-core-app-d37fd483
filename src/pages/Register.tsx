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
import { Sparkles, Clock, CheckCircle2, ArrowLeft, ArrowRight, Layers } from "lucide-react";
import { PLANS, getDisplayMonthlyPrice, getPlanPrice, type BillingCycle } from "@/lib/plans";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { validateEmail, validatePhone } from "@/lib/contactValidation";
import ServiceCatalogPicker from "@/components/ServiceCatalogPicker";
import { buildServiceSelectionPayload } from "@/lib/enabledServiceTypes";

const Register = () => {
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [searchParams] = useSearchParams();
  const planParam = (searchParams.get("plan") || "pro").toLowerCase();
  const billingParam = (searchParams.get("billing") || "monthly").toLowerCase();
  const billingCycle: BillingCycle = billingParam === "yearly" ? "yearly" : "monthly";
  const selectedPlan = useMemo(
    () => PLANS.find((p) => p.id === planParam) || PLANS.find((p) => p.id === "pro") || PLANS[0],
    [planParam]
  );
  const displayPrice = getDisplayMonthlyPrice(selectedPlan, billingCycle);
  const billingAmount = getPlanPrice(selectedPlan.id, billingCycle);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isFree = selectedPlan.id === "free";

  const goToServices = (e: React.FormEvent) => {
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
    if (!name.trim() || !tenantName.trim() || password.length < 8) {
      toast({ variant: "destructive", title: t("auth.validationFailed"), description: isBn ? "সব আবশ্যক ফিল্ড পূরণ করুন" : "Please fill all required fields" });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const emailCheck = validateEmail(email);
    const phoneCheck = validatePhone(phone);
    if (!emailCheck.ok || !phoneCheck.ok) return;

    setLoading(true);
    try {
      const services = buildServiceSelectionPayload(selectedSubs);
      const result = await register({
        name: name.trim(),
        email: emailCheck.email,
        phone: phoneCheck.phone,
        password,
        tenantName: tenantName.trim(),
        plan: selectedPlan.id,
        enabledSubcategories: services.enabledSubcategories,
        enabledServiceTypes: services.enabledServiceTypes,
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
      <Card className={step === 2 ? "w-full max-w-2xl" : "w-full max-w-md"}>
        <CardHeader className="text-center">
          <div className="flex justify-end mb-2"><LanguageSwitcher /></div>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {step === 1 ? t("auth.registerTitle") : isBn ? "আপনার সার্ভিস নির্বাচন করুন" : "Choose your services"}
          </CardTitle>
          <CardDescription>
            {step === 1 ? t("auth.registerSubtitle") : isBn ? "যে সেবাগুলো আপনার এজেন্সি দেয় শুধু সেগুলো চালু করুন" : "Enable only what your agency offers — you can change this later"}
          </CardDescription>
          <div className="mt-3 flex flex-col items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {t("common.selectedPlan")}: <span className="ml-1 font-semibold">{selectedPlan.name}</span>
            </Badge>
            {!isFree && step === 1 && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 text-xs font-medium">
                <Clock className="h-3.5 w-3.5" />
                {t("auth.trialBadge")}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={goToServices} className="space-y-4">
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
                <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("auth.phonePlaceholder")} required autoComplete="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("common.password")} *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full">
                {isBn ? "পরবর্তী: সার্ভিস নির্বাচন" : "Next: Select services"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="h-4 w-4" />
                <span>{tenantName}</span>
              </div>
              <ServiceCatalogPicker value={selectedSubs} onChange={setSelectedSubs} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> {t("marketing.onboarding.back")}
                </Button>
                <Button type="button" className="flex-1" disabled={loading} onClick={handleSubmit}>
                  {loading ? t("common.creating") : isFree ? t("common.createAccount") : t("common.startFreeTrial")}
                </Button>
              </div>
            </div>
          )}
          {step === 1 ? (
            <>
              <div className="space-y-1.5 pt-4 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {t("common.noCreditCard")}</p>
                <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {t("common.instantAccess")}</p>
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t("common.alreadyHaveAccount")} <Link to="/login" className="text-primary underline">{t("common.signIn")}</Link>
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
