import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Clock, CheckCircle2, ArrowLeft, ArrowRight, Layers,
  MessageCircle, Mail, Phone, Loader2, ShieldCheck, RefreshCw,
} from "lucide-react";
import { PLANS, getDisplayMonthlyPrice, getPlanPrice, type BillingCycle } from "@/lib/plans";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { validateEmail, validatePhone, formatPhoneLocal } from "@/lib/contactValidation";
import ServiceCatalogPicker from "@/components/ServiceCatalogPicker";
import { buildServiceSelectionPayload } from "@/lib/enabledServiceTypes";
import { authApi } from "@/lib/api";

type Step = 1 | 2 | 3;
const PW_MIN = 10;

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
  const isFree = selectedPlan.id === "free";

  const [step, setStep] = useState<Step>(1);

  // ── Form fields ──
  const [name, setName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [password, setPassword] = useState("");

  // ── OTP state ──
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [waToken, setWaToken] = useState("");      // proof token after verify
  const [verifiedWa, setVerifiedWa] = useState(""); // normalized verified number
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  // ── Services + submit ──
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const effectiveWhatsapp = sameAsMobile ? phone : whatsapp;

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  function startCooldown(sec: number) {
    setCooldown(sec);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  const [checkingEmail, setCheckingEmail] = useState(false);

  // ── Step 1 → 2 ──
  async function goToVerify(e: React.FormEvent) {
    e.preventDefault();
    const fail = (msg: string) =>
      toast({ variant: "destructive", title: t("auth.validationFailed"), description: msg });

    if (!name.trim() || !tenantName.trim())
      return fail(isBn ? "নাম ও এজেন্সির নাম দিন" : "Enter your name and agency name");
    const ec = validateEmail(email);
    if (!ec.ok) return fail(ec.message);
    const pc = validatePhone(phone);
    if (!pc.ok) return fail(pc.message);
    const wc = validatePhone(effectiveWhatsapp);
    if (!wc.ok) return fail(isBn ? "সঠিক হোয়াটসঅ্যাপ নম্বর দিন" : "Enter a valid WhatsApp number");
    if (password.length < PW_MIN)
      return fail(isBn ? `পাসওয়ার্ড কমপক্ষে ${PW_MIN} অক্ষরের হতে হবে` : `Password must be at least ${PW_MIN} characters`);

    // Check email availability up front — avoids wasting an OTP
    setCheckingEmail(true);
    try {
      const r = await authApi.checkEmail(ec.email);
      if (!r.available) {
        toast({
          variant: "destructive",
          title: isBn ? "ইমেইল ইতিমধ্যে নিবন্ধিত" : "Email already registered",
          description: isBn ? "এই ইমেইল দিয়ে অ্যাকাউন্ট আছে — লগইন করুন।" : "An account with this email exists — please sign in.",
        });
        return;
      }
    } catch { /* fail-open; register will re-check */ }
    finally { setCheckingEmail(false); }

    // If number changed after a prior verify, reset verification
    if (verifiedWa && verifiedWa !== wc.phone) {
      setWaToken(""); setVerifiedWa(""); setOtpSent(false); setOtpCode("");
    }
    setStep(2);
  }

  // ── Send OTP ──
  async function sendOtp() {
    const wc = validatePhone(effectiveWhatsapp);
    if (!wc.ok) return;
    setOtpSending(true);
    try {
      const res = await authApi.sendWhatsappOtp(effectiveWhatsapp);
      setOtpSent(true);
      startCooldown(60);
      toast({
        title: isBn ? "কোড পাঠানো হয়েছে" : "Code sent",
        description: res.delivered
          ? (isBn ? "আপনার হোয়াটসঅ্যাপে ৬-সংখ্যার কোড দেখুন।" : "Check your WhatsApp for the 6-digit code.")
          : (isBn ? "ডেলিভারি নিশ্চিত নয় — নম্বর যাচাই করে আবার চেষ্টা করুন।" : "Delivery not confirmed — verify the number and resend."),
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: isBn ? "পাঠানো যায়নি" : "Could not send", description: err.message });
      if (/wait (\d+)s/.test(err.message)) startCooldown(parseInt(RegExp.$1, 10));
    } finally {
      setOtpSending(false);
    }
  }

  // ── Verify OTP ──
  async function verifyOtp() {
    if (!/^\d{6}$/.test(otpCode)) {
      toast({ variant: "destructive", title: t("auth.validationFailed"), description: isBn ? "৬-সংখ্যার কোড দিন" : "Enter the 6-digit code" });
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await authApi.verifyWhatsappOtp(effectiveWhatsapp, otpCode);
      setWaToken(res.whatsappVerifyToken);
      setVerifiedWa(res.whatsapp);
      toast({ title: isBn ? "✓ যাচাই সম্পন্ন" : "✓ WhatsApp verified", description: res.whatsapp });
      setStep(3);
    } catch (err: any) {
      toast({ variant: "destructive", title: isBn ? "যাচাই ব্যর্থ" : "Verification failed", description: err.message });
    } finally {
      setOtpVerifying(false);
    }
  }

  // ── Final submit ──
  async function handleSubmit() {
    if (!waToken) {
      toast({ variant: "destructive", title: isBn ? "যাচাই প্রয়োজন" : "Verification needed", description: isBn ? "প্রথমে হোয়াটসঅ্যাপ যাচাই করুন।" : "Please verify WhatsApp first." });
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      const services = buildServiceSelectionPayload(selectedSubs);
      const ec = validateEmail(email);
      const pc = validatePhone(phone);
      const result = await register({
        name: name.trim(),
        email: ec.ok ? ec.email : email,
        phone: pc.ok ? pc.phone : phone,
        whatsapp: verifiedWa,
        whatsappVerifyToken: waToken,
        password,
        tenantName: tenantName.trim(),
        plan: selectedPlan.id,
        enabledSubcategories: services.enabledSubcategories,
        enabledServiceTypes: services.enabledServiceTypes,
      });
      if (result.pendingApproval) {
        toast({ title: isBn ? "জমা হয়েছে" : "Account submitted", description: result.message || "Pending admin approval." });
        navigate("/login");
      } else {
        const trialDays = result.trialDays ?? 7;
        toast({
          title: isFree ? t("common.welcome") : `🎉 ${trialDays}-Day Pro Trial Started!`,
          description: isFree
            ? (isBn ? "আপনার অ্যাকাউন্ট প্রস্তুত।" : "Your account is ready.")
            : (isBn ? `পরবর্তী ${trialDays} দিন সব Pro ফিচার ব্যবহার করুন।` : `Explore all Pro features for ${trialDays} days.`),
        });
        navigate("/onboarding");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      toast({ variant: "destructive", title: "Registration failed", description: message });
      if (/whatsapp/i.test(message)) { setWaToken(""); setStep(2); }
    } finally {
      setLoading(false);
    }
  }

  // ── Stepper UI ──
  const steps = [
    { n: 1, label: isBn ? "অ্যাকাউন্ট" : "Account", icon: Mail },
    { n: 2, label: isBn ? "যাচাই" : "Verify", icon: ShieldCheck },
    { n: 3, label: isBn ? "সার্ভিস" : "Services", icon: Layers },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/40 px-4 py-8">
      <Card className={step === 3 ? "w-full max-w-2xl" : "w-full max-w-md"}>
        <CardHeader className="text-center">
          <div className="flex justify-between items-center mb-2">
            <Badge variant="secondary" className="text-xs">
              {selectedPlan.name}
            </Badge>
            <LanguageSwitcher />
          </div>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">
            {step === 1 ? (isBn ? "অ্যাকাউন্ট তৈরি করুন" : "Create your account")
              : step === 2 ? (isBn ? "হোয়াটসঅ্যাপ যাচাই" : "Verify WhatsApp")
              : (isBn ? "আপনার সার্ভিস বাছুন" : "Choose your services")}
          </CardTitle>
          <CardDescription>
            {step === 1 ? (isBn ? "৩টি ধাপে সহজ সাইনআপ" : "Quick 3-step signup")
              : step === 2 ? (isBn ? "আপনার নম্বরে পাঠানো কোডটি দিন" : "Enter the code sent to your number")
              : (isBn ? "শুধু যা প্রয়োজন তা চালু করুন" : "Enable only what you offer — change anytime")}
          </CardDescription>

          {/* Progress stepper */}
          <div className="flex items-center justify-center gap-1 pt-4">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.n ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 w-8 transition-colors ${step > s.n ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {/* ── STEP 1 ── */}
          {step === 1 && (
            <form onSubmit={goToVerify} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("common.fullName")} *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenantName">{t("common.agencyName")} *</Label>
                <Input id="tenantName" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {t("common.email")} *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="name@agency.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {isBn ? "মোবাইল নম্বর" : "Mobile number"} *</Label>
                <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="017XXXXXXXX" required autoComplete="tel" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Checkbox id="same" checked={sameAsMobile} onCheckedChange={(v) => setSameAsMobile(!!v)} />
                  <Label htmlFor="same" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                    {isBn ? "হোয়াটসঅ্যাপ নম্বর মোবাইলের মতোই" : "WhatsApp is same as mobile"}
                  </Label>
                </div>
                {!sameAsMobile && (
                  <Input type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={isBn ? "হোয়াটসঅ্যাপ নম্বর (017...)" : "WhatsApp number (017...)"} autoComplete="tel" />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">{t("common.password")} *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={PW_MIN} autoComplete="new-password" placeholder={isBn ? `কমপক্ষে ${PW_MIN} অক্ষর` : `At least ${PW_MIN} characters`} />
              </div>

              <Button type="submit" className="w-full" disabled={checkingEmail}>
                {checkingEmail
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isBn ? "যাচাই হচ্ছে…" : "Checking…"}</>
                  : <>{isBn ? "পরবর্তী: হোয়াটসঅ্যাপ যাচাই" : "Next: Verify WhatsApp"} <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>

              <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {t("common.noCreditCard")}</p>
                {!isFree && <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /> {t("auth.trialBadge")}</p>}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {t("common.alreadyHaveAccount")} <Link to="/login" className="text-primary underline">{t("common.signIn")}</Link>
              </p>
            </form>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-green-50/60 dark:bg-green-950/20 p-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground">{isBn ? "যাচাই হবে এই নম্বরে:" : "Verifying this number:"}</div>
                  <div className="font-semibold">{formatPhoneLocal(validatePhone(effectiveWhatsapp).ok ? validatePhone(effectiveWhatsapp).phone! : effectiveWhatsapp)}</div>
                </div>
              </div>

              {!otpSent ? (
                <Button className="w-full" onClick={sendOtp} disabled={otpSending}>
                  {otpSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isBn ? "পাঠানো হচ্ছে…" : "Sending…"}</>
                    : <><MessageCircle className="mr-2 h-4 w-4" /> {isBn ? "যাচাই কোড পাঠান" : "Send verification code"}</>}
                </Button>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="otp">{isBn ? "৬-সংখ্যার কোড" : "6-digit code"}</Label>
                    <Input
                      id="otp" inputMode="numeric" maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      className="text-center text-2xl tracking-[0.5em] font-semibold"
                      autoFocus
                    />
                  </div>
                  <Button className="w-full" onClick={verifyOtp} disabled={otpVerifying || otpCode.length !== 6}>
                    {otpVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isBn ? "যাচাই হচ্ছে…" : "Verifying…"}</>
                      : <><ShieldCheck className="mr-2 h-4 w-4" /> {isBn ? "যাচাই করুন" : "Verify"}</>}
                  </Button>
                  <div className="flex items-center justify-center text-sm">
                    <Button variant="ghost" size="sm" onClick={sendOtp} disabled={cooldown > 0 || otpSending} className="text-muted-foreground">
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      {cooldown > 0 ? (isBn ? `আবার পাঠান (${cooldown}s)` : `Resend (${cooldown}s)`) : (isBn ? "কোড আবার পাঠান" : "Resend code")}
                    </Button>
                  </div>
                </>
              )}

              <Button type="button" variant="outline" className="w-full" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {isBn ? "ফিরে যান" : "Back"}
              </Button>
            </div>
          )}

          {/* ── STEP 3: Services ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Layers className="h-4 w-4" /> {tenantName}
                </div>
                <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0">
                  <CheckCircle2 className="h-3 w-3" /> {isBn ? "যাচাইকৃত" : "Verified"}
                </Badge>
              </div>
              <ServiceCatalogPicker value={selectedSubs} onChange={setSelectedSubs} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> {t("marketing.onboarding.back")}
                </Button>
                <Button type="button" className="flex-1" disabled={loading} onClick={handleSubmit}>
                  {loading ? t("common.creating") : isFree ? t("common.createAccount") : t("common.startFreeTrial")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
