import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS, FEATURE_COMPARISON, getDisplayMonthlyPrice, type BillingCycle, type PlanType } from "@/lib/plans";
import BillingCycleToggle from "@/components/BillingCycleToggle";
import {
  Check, X, ArrowRight, Star, Zap, Crown, Rocket, Gem,
  Lock, BarChart3, Receipt,
} from "lucide-react";

const planIcons: Record<string, React.ElementType> = { free: Star, basic: Zap, pro: Crown, business: Rocket, enterprise: Gem };

const Pricing = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ companyName: "", ownerName: "", email: "", phone: "", password: "" });

  const update = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleSelectPlan = (planId: string) => {
    if (planId === "free") {
      navigate(`/register?plan=free&billing=${billing}`);
    } else {
      navigate(`/register?plan=${planId}&billing=${billing}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register({ name: form.ownerName, email: form.email, password: form.password, tenantName: form.companyName, plan: selectedPlan || "pro" });
      if (res.pendingApproval) {
        toast({ title: t("marketing.pricing.submitted"), description: res.message || t("marketing.pricing.pendingApproval") });
        navigate("/login");
      } else {
        toast({ title: `🎉 ${t("marketing.pricing.trialStarted")}`, description: t("marketing.pricing.trialDesc", { plan: PLANS.find(p => p.id === selectedPlan)?.name }) });
        setDialogOpen(false);
        navigate("/onboarding");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: t("marketing.pricing.regFailed"), description: err.message });
    } finally { setLoading(false); }
  };

  const getPrice = (plan: typeof PLANS[0]) => getDisplayMonthlyPrice(plan, billing);

  return (
    <MarketingLayout
      title={t("marketing.pricing.metaTitle")}
      description={t("marketing.pricing.metaDesc")}
    >
      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6 bg-amber-400/10 text-amber-400 border-amber-400/25 text-sm px-4 py-1.5">
            {t("marketing.pricing.badge")}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            {t("marketing.pricing.title")}
          </h1>
          <p className="text-lg text-white/45 max-w-2xl mx-auto mb-8">
            {t("marketing.pricing.subtitle")}
          </p>
          <BillingCycleToggle value={billing} onChange={setBilling} />
        </div>
      </section>

      {/* Plan Cards */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
            {PLANS.map((plan) => {
              const Icon = planIcons[plan.id] || Star;
              const isHighlighted = plan.badge === "Most Popular" || plan.badge === "Best Value";
              const price = getPrice(plan);
              return (
                <Card key={plan.id} className={`relative overflow-hidden bg-white/[0.04] border-white/8 text-white ${isHighlighted ? "ring-2 ring-amber-400 border-amber-400/40 md:scale-105 z-10" : "hover:border-white/15"} transition-all`}>
                  {plan.badge && (
                    <div className={`absolute top-0 right-0 text-white text-xs font-bold px-3 py-1 rounded-bl-xl ${plan.badge === "Most Popular" ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`}>
                      {plan.badge.toUpperCase()}
                    </div>
                  )}
                  <CardHeader className="pb-2 text-center">
                    <Icon className="mx-auto h-8 w-8 text-amber-400 mb-2" />
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription className="text-white/40 text-xs">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      {price === -1 ? (
                        <span className="text-2xl font-extrabold text-amber-400">{t("marketing.pricing.custom")}</span>
                      ) : price === 0 ? (
                        <span className="text-3xl font-extrabold text-amber-400">{t("marketing.pricing.free")}</span>
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-amber-400">৳{price.toLocaleString()}</span>
                          <span className="text-white/40 text-sm ml-1">{t("marketing.pricing.perMonth")}</span>
                        </>
                      )}
                      {billing === "yearly" && price > 0 && (
                        <p className="text-xs text-emerald-400 mt-1">
                          ৳{plan.yearlyPrice.toLocaleString()}{t("marketing.pricing.perYear")}
                          <span className="text-white/35"> · {t("marketing.pricing.save2Months")}</span>
                        </p>
                      )}
                    </div>
                    <Separator className="bg-white/8" />
                    <ul className="space-y-2">
                      {plan.features.slice(0, 5).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs"><Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" /><span className="text-white/60">{f}</span></li>
                      ))}
                      {plan.features.length > 5 && <li className="text-xs text-white/35">+{plan.features.length - 5} {t("marketing.pricing.more")}</li>}
                    </ul>
                    {plan.restrictions.length > 0 && (
                      <ul className="space-y-1 pt-1 border-t border-white/5">
                        {plan.restrictions.slice(0, 2).map((r) => (
                          <li key={r} className="flex items-start gap-2 text-xs"><X className="h-3.5 w-3.5 text-red-400/50 mt-0.5 shrink-0" /><span className="text-white/35">{r}</span></li>
                        ))}
                      </ul>
                    )}
                    <Button className={`w-full h-10 text-sm ${isHighlighted ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20" : "bg-white/8 hover:bg-white/12 text-white"}`} onClick={() => handleSelectPlan(plan.id)}>
                      {price === -1 ? t("marketing.pricing.contactPrice") : t("marketing.pricing.subscribeNow")}<ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Locked Features Callout */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center"><Receipt className="h-5 w-5 text-amber-400" /></div>
                <div>
                  <h3 className="font-semibold">{t("marketing.pricing.accountsTitle")}</h3>
                  <Badge variant="secondary" className="text-[10px] bg-amber-400/10 text-amber-400 border-0">{t("marketing.pricing.accountsBadge")}</Badge>
                </div>
              </div>
              <p className="text-sm text-white/45">{t("marketing.pricing.accountsDesc")}</p>
            </div>
            <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-400/10 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-violet-400" /></div>
                <div>
                  <h3 className="font-semibold">{t("marketing.pricing.reportsTitle")}</h3>
                  <Badge variant="secondary" className="text-[10px] bg-violet-400/10 text-violet-400 border-0">{t("marketing.pricing.reportsBadge")}</Badge>
                </div>
              </div>
              <p className="text-sm text-white/45">{t("marketing.pricing.reportsDesc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-16 bg-[#0f1729]">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">{t("marketing.pricing.fullCompare")}</h2>
          <div className="max-w-7xl mx-auto overflow-x-auto rounded-xl border border-white/8">
            <Table>
              <TableHeader>
                <TableRow className="border-white/8 bg-white/[0.04]">
                  <TableHead className="text-white/60 min-w-[200px]">{t("marketing.pricing.feature")}</TableHead>
                  {PLANS.map((p) => (
                    <TableHead key={p.id} className="text-center text-white/60 min-w-[100px]">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-amber-400 font-normal">
                        {p.monthlyPrice === -1
                          ? t("marketing.pricing.custom")
                          : p.monthlyPrice === 0
                            ? t("marketing.pricing.free")
                            : billing === "yearly"
                              ? `৳${getDisplayMonthlyPrice(p, billing)}/mo`
                              : `৳${p.monthlyPrice}`}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {FEATURE_COMPARISON.map((cat) => (
                  <>
                    <TableRow key={cat.category} className="border-white/8 bg-white/[0.02]">
                      <TableCell colSpan={5} className="font-semibold text-amber-400 text-sm py-2">{cat.category}</TableCell>
                    </TableRow>
                    {cat.features.map((feat) => (
                      <TableRow key={feat.name} className="border-white/8 hover:bg-white/[0.04]">
                        <TableCell className="text-sm text-white/60">{feat.name}</TableCell>
                        {(["basic", "pro", "business", "enterprise"] as const).map((planId) => {
                          const val = feat[planId];
                          return (
                            <TableCell key={planId} className="text-center">
                              {val === true ? <Check className="h-4 w-4 text-emerald-400 mx-auto" /> : val === false ? <X className="h-4 w-4 text-white/15 mx-auto" /> : <span className="text-xs text-white/50">{val}</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <Gem className="h-10 w-10 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">{t("marketing.pricing.needCustom")}</h2>
          <p className="text-white/45 max-w-md mx-auto mb-6">
            {t("marketing.pricing.enterpriseDesc")}
          </p>
          <Link to="/demo">
            <Button size="lg" variant="outline" className="border-white/15 text-white hover:bg-white/10 px-8">
              {t("marketing.pricing.contactSales")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Registration Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedPlan(null);
        }}
      >
        {(() => {
          const selectedPlanInfo = PLANS.find((p) => p.id === selectedPlan);
          if (!selectedPlanInfo) return null;

          return (
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#111827] border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {t("marketing.pricing.subscribeTo")} <span className="text-amber-400">{selectedPlanInfo.name}</span> {t("marketing.pricing.planSuffix")}
                </DialogTitle>
                <DialogDescription className="text-white/45">
                  {t("marketing.pricing.fillDetails")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedPlanInfo.name} {t("marketing.pricing.planSuffix")}</span>
                  <span className="font-bold text-amber-400">
                    {selectedPlanInfo.monthlyPrice === -1
                      ? t("marketing.pricing.custom")
                      : selectedPlanInfo.monthlyPrice === 0
                        ? t("marketing.pricing.free")
                        : `৳${getPrice(selectedPlanInfo).toLocaleString()}${t("marketing.pricing.perMonth")}`}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-white/60">{t("marketing.pricing.companyName")} *</Label><Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder={t("marketing.pricing.companyPh")} required className="bg-white/5 border-white/12 text-white placeholder:text-white/25" /></div>
                  <div className="space-y-2"><Label className="text-white/60">{t("marketing.pricing.yourName")} *</Label><Input value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} placeholder={t("marketing.pricing.yourNamePh")} required className="bg-white/5 border-white/12 text-white placeholder:text-white/25" /></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-white/60">{t("marketing.pricing.email")} *</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder={t("marketing.pricing.emailPh")} required className="bg-white/5 border-white/12 text-white placeholder:text-white/25" /></div>
                  <div className="space-y-2"><Label className="text-white/60">{t("marketing.pricing.phone")} *</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder={t("marketing.pricing.phonePh")} required className="bg-white/5 border-white/12 text-white placeholder:text-white/25" /></div>
                </div>
                <div className="space-y-2"><Label className="text-white/60">{t("marketing.pricing.password")} *</Label><Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder={t("marketing.pricing.passwordPh")} required minLength={8} className="bg-white/5 border-white/12 text-white placeholder:text-white/25" /></div>
                <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20">
                  {loading ? t("marketing.pricing.creating") : t("marketing.pricing.createAccount")}
                </Button>
                <p className="text-center text-xs text-white/25">{t("marketing.pricing.alreadyHave")} <Link to="/login" className="text-amber-400 underline">{t("marketing.pricing.signIn")}</Link></p>
              </form>
            </DialogContent>
          );
        })()}
      </Dialog>
    </MarketingLayout>
  );
};

export default Pricing;
