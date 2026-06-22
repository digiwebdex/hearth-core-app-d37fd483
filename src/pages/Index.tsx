import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PLANS, getDisplayMonthlyPrice, type BillingCycle } from "@/lib/plans";
import BillingCycleToggle from "@/components/BillingCycleToggle";
import {
  Plane, BarChart3, Shield, Moon, Receipt,
  Check, ArrowRight, Zap, Crown, Rocket, Gem, Star,
  Target, FileText, Store, UserCheck, MapPin, ChevronDown, Quote,
} from "lucide-react";

const BRAND = "Travel Agency Website & Software Solution";

const planIcons: Record<string, React.ElementType> = { free: Star, basic: Zap, pro: Crown, business: Rocket, enterprise: Gem };

const featureKeys = [
  { icon: Target, t: "leads" },
  { icon: FileText, t: "quotes" },
  { icon: Plane, t: "bookings" },
  { icon: Receipt, t: "invoices" },
  { icon: Store, t: "vendors" },
  { icon: Shield, t: "team" },
  { icon: BarChart3, t: "reports" },
  { icon: Moon, t: "hajj" },
] as const;

const testimonials = [
  { name: "Rafiq Ahmed", role: "Owner, Al-Baraka Tours", text: "Before this platform, we managed everything on spreadsheets. Now our team handles 3x more bookings with less confusion." },
  { name: "Fatima Begum", role: "Operations Manager, Skyway Travel", text: "The vendor payable tracking is a game changer. Our profit margins are visible in real time." },
  { name: "Kamal Hossain", role: "Director, Noor Hajj Services", text: "The Hajj/Umrah module is exactly what we needed. Managing 500+ pilgrims is finally simple." },
];

import { useTranslation } from "react-i18next";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  const handleSelectPlan = (planId: string) => {
    navigate(`/register?plan=${planId}&billing=${billing}`);
  };

  const visiblePlans = PLANS;

  return (
    <MarketingLayout
      title={`${BRAND} — Complete Travel Agency Management`}
      description="Manage your travel agency online — leads, quotations, bookings, invoices, payments, vendors, reports, and Hajj/Umrah. Built for agencies in Bangladesh."
    >
      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="absolute inset-0 opacity-15" style={{
          backgroundImage: "radial-gradient(circle at 30% 40%, hsl(35, 92%, 50%) 0%, transparent 50%), radial-gradient(circle at 70% 60%, hsl(25, 95%, 45%) 0%, transparent 50%)",
        }} />
        <div className="container mx-auto px-4 text-center relative">
          <Badge className="mb-6 bg-amber-400/10 text-amber-400 border-amber-400/25 text-sm px-4 py-1.5">
            {t("landing.heroBadge")}
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            {t("landing.heroTitle1")}<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">{t("landing.heroTitle2")}</span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-3xl mx-auto mb-10">
            {t("landing.heroSubtitle")}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/pricing">
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 h-12 text-base shadow-lg shadow-amber-500/25">
                <Zap className="mr-2 h-5 w-5" />{t("landing.ctaPrimary")}
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { val: "500+", label: "Travel Agencies" },
              { val: "50K+", label: "Bookings Managed" },
              { val: "99.9%", label: "Uptime" },
              { val: "24/7", label: "Support" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-amber-400">{s.val}</p>
                <p className="text-sm text-white/40 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Workflow ───── */}
      <section className="py-20 bg-[#0f1729]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-amber-400/10 text-amber-400 border-amber-400/25">{t("landing.workflowBadge")}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("landing.workflowTitle")}</h2>
            <p className="text-white/45 max-w-2xl mx-auto">{t("landing.workflowSubtitle")}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {[
              { icon: Target, label: t("landing.stepLead"), sub: t("landing.stepLeadSub") },
              { icon: FileText, label: t("landing.stepQuote"), sub: t("landing.stepQuoteSub") },
              { icon: UserCheck, label: t("landing.stepWin"), sub: t("landing.stepWinSub") },
              { icon: Plane, label: t("landing.stepBook"), sub: t("landing.stepBookSub") },
              { icon: Receipt, label: t("landing.stepPay"), sub: t("landing.stepPaySub") },
              { icon: MapPin, label: t("landing.stepTrip"), sub: t("landing.stepTripSub") },
            ].map((step, i) => (
              <div key={step.label} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 flex items-center justify-center mb-3 relative border border-amber-500/10">
                  <step.icon className="h-7 w-7 text-amber-400" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-md">{i + 1}</span>
                </div>
                <h3 className="font-semibold text-sm mb-0.5">{step.label}</h3>
                <p className="text-xs text-white/35">{step.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-amber-400/10 text-amber-400 border-amber-400/25">{t("landing.featuresBadge")}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("landing.featuresTitle")}</h2>
            <p className="text-white/45 max-w-2xl mx-auto">{t("landing.featuresSubtitle")}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featureKeys.map((f) => (
              <div key={f.t} className="p-6 rounded-2xl bg-white/[0.04] border border-white/8 hover:border-amber-400/25 hover:bg-white/[0.06] transition-all group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 flex items-center justify-center mb-4 group-hover:from-amber-500/25 group-hover:to-orange-500/25 transition-all border border-amber-500/10">
                  <f.icon className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{t(`feat.${f.t}_t`)}</h3>
                <p className="text-sm text-white/45">{t(`feat.${f.t}_d`)}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/features">
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                {t("landing.seeAllFeatures")}<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Pricing Preview ───── */}
      <section className="py-24 bg-[#0f1729]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-amber-400/10 text-amber-400 border-amber-400/25">{t("landing.pricingBadge")}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("landing.pricingTitle")}</h2>
            <p className="text-white/45 max-w-2xl mx-auto mb-8">{t("landing.pricingSubtitle")}</p>
            <BillingCycleToggle value={billing} onChange={setBilling} />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {visiblePlans.map((plan) => {
              const Icon = planIcons[plan.id] || Star;
              const isHighlighted = plan.badge === "Most Popular" || plan.badge === "Best Value";
              const price = getDisplayMonthlyPrice(plan, billing);
              return (
                <Card key={plan.id} className={`relative overflow-hidden bg-white/[0.04] border-white/8 text-white ${isHighlighted ? "ring-2 ring-amber-400 border-amber-400/40 md:scale-105 z-10" : "hover:border-white/15"} transition-all`}>
                  {plan.badge && (
                    <div className={`absolute top-0 right-0 text-white text-xs font-bold px-3 py-1 rounded-bl-xl ${plan.badge === "Most Popular" ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`}>
                      {plan.badge === "Most Popular" ? t("common.popular").toUpperCase() : t("common.bestValue").toUpperCase()}
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
                        <span className="text-2xl font-extrabold text-amber-400">{t("common.custom")}</span>
                      ) : price === 0 ? (
                        <span className="text-3xl font-extrabold text-amber-400">{t("common.free")}</span>
                      ) : (
                        <>
                          <span className="text-3xl font-extrabold text-amber-400">৳{price.toLocaleString()}</span>
                          <span className="text-white/40 text-sm ml-1">{t("common.perMonth")}</span>
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
                      {plan.features.slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs"><Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" /><span className="text-white/60">{f}</span></li>
                      ))}
                    </ul>
                    <Button className={`w-full h-10 text-sm ${isHighlighted ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20" : "bg-white/8 hover:bg-white/12 text-white"}`} onClick={() => handleSelectPlan(plan.id)}>
                      {price === -1 ? t("register.contactForPrice") : t("common.subscribeNow")}<ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="text-center mt-10">
            <Link to="/pricing">
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                {t("landing.compareAll")}<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Testimonials ───── */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-amber-400/10 text-amber-400 border-amber-400/25">{t("landing.testimonialsBadge")}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("landing.testimonialsTitle")}</h2>
            <p className="text-white/45">{t("landing.testimonialsSubtitle")}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {testimonials.map((tm) => (
              <Card key={tm.name} className="bg-white/[0.04] border-white/8 text-white">
                <CardContent className="pt-6">
                  <Quote className="h-8 w-8 text-amber-400/25 mb-3" />
                  <p className="text-sm text-white/55 mb-4 leading-relaxed">{tm.text}</p>
                  <Separator className="bg-white/8 mb-3" />
                  <div>
                    <p className="font-semibold text-sm">{tm.name}</p>
                    <p className="text-xs text-white/35">{tm.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="py-24 bg-[#0f1729]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-amber-400/10 text-amber-400 border-amber-400/25">{t("landing.faqBadge")}</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("landing.faqTitle")}</h2>
          </div>
          <div className="max-w-2xl mx-auto space-y-2">
            {[1, 2, 3, 4].map((n, i) => (
              <div key={n} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03]">
                  <span className="font-medium text-sm pr-4">{t(`faq.q${n}`)}</span>
                  <ChevronDown className={`h-4 w-4 text-white/35 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && <div className="px-5 pb-4"><p className="text-sm text-white/45">{t(`faq.a${n}`)}</p></div>}
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/faq">
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                {t("landing.seeAllFaq")}<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("landing.finalCtaTitle")}</h2>
          <p className="text-white/45 max-w-xl mx-auto mb-8">{t("landing.finalCtaSubtitle")}</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/pricing">
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 h-12 text-base shadow-lg shadow-amber-500/25">
                {t("common.viewPricing")}
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 px-8 h-12 text-base">
                {t("landing.scheduleDemo")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </MarketingLayout>
  );
};

export default Index;