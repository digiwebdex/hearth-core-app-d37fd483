import { Link } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading, GlassCard, IconTile, GradientText, PRIMARY_BTN, GHOST_BTN } from "@/components/marketing/primitives";
import { PLATFORM_MODULES, TRAVEL_SERVICES } from "@/lib/marketingContent";
import { ArrowRight, Check, Layers } from "lucide-react";

const Modules = () => {
  return (
    <MarketingLayout
      title="Platform Modules — Travel Agency ERP"
      description="Every module of the travel-agency ERP: CRM, Booking, Accounting, Inventory, HR, Payroll, Website CMS, Reports, Marketing, Automation, Branch, User Management, Roles and Permissions."
    >
      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div
          className="absolute inset-0 opacity-15"
          style={{ backgroundImage: "radial-gradient(circle at 30% 30%, hsl(35,92%,50%) 0%, transparent 55%), radial-gradient(circle at 75% 60%, hsl(25,95%,45%) 0%, transparent 55%)" }}
        />
        <div className="container mx-auto px-4 text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-1.5 text-sm text-amber-400 mb-6">
            <Layers className="h-4 w-4" /> Platform Modules
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white">
            One platform. <GradientText>Every module</GradientText> you need.
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10">
            Run your entire agency — sales, operations, finance, people and marketing — from a single, tenant-isolated ERP built for Bangladesh travel businesses.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/pricing"><Button size="lg" className={`${PRIMARY_BTN} px-8 h-12`}>See pricing<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Link to="/demo"><Button size="lg" variant="outline" className={`${GHOST_BTN} px-8 h-12`}>Book a demo</Button></Link>
          </div>
        </div>
      </section>

      {/* Module grid */}
      <Section alt>
        <SectionHeading
          badge="14 modules"
          title={<>Everything runs from <GradientText>one system</GradientText></>}
          subtitle="No spreadsheets, no disconnected tools — every module shares the same clients, bookings and ledger."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_MODULES.map((m) => (
            <GlassCard key={m.id} interactive>
              <IconTile icon={m.icon} className="mb-4" />
              <h3 className="font-semibold text-lg mb-1.5 text-white">{m.name}</h3>
              <p className="text-sm text-white/45">{m.desc}</p>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* Services note — never plan gated */}
      <Section>
        <div className="max-w-4xl mx-auto rounded-3xl border border-white/8 bg-white/[0.03] p-8 md:p-12">
          <SectionHeading
            align="left"
            className="mb-8"
            badge="Sell everything"
            title={<>All {TRAVEL_SERVICES.length} travel services — <GradientText>on every plan</GradientText></>}
            subtitle="Business services are never restricted by your subscription. Choose what you sell at onboarding and change it anytime."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TRAVEL_SERVICES.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm text-white/70">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" /> {s.name}
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/solutions"><Button variant="outline" className={GHOST_BTN}>Explore solutions by agency type<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section alt className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Ready to run your agency on one platform?</h2>
        <p className="text-white/45 max-w-xl mx-auto mb-8">Start a 7-day free trial with full access — no card required.</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/register"><Button size="lg" className={`${PRIMARY_BTN} px-8 h-12`}>Start free trial<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <Link to="/pricing"><Button size="lg" variant="outline" className={`${GHOST_BTN} px-8 h-12`}>View pricing</Button></Link>
        </div>
      </Section>
    </MarketingLayout>
  );
};

export default Modules;
