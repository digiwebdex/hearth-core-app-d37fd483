import { Link } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading, GlassCard, IconTile, GradientText, PRIMARY_BTN, GHOST_BTN } from "@/components/marketing/primitives";
import { INDUSTRY_SOLUTIONS, TRAVEL_SERVICES } from "@/lib/marketingContent";
import { ArrowRight, Sparkles } from "lucide-react";

const Solutions = () => {
  return (
    <MarketingLayout
      title="Solutions by Agency Type — Travel Agency SaaS"
      description="Purpose-built solutions for Hajj & Umrah agencies, air ticketing offices, visa centers, tour operators, corporate travel and manpower & student consultancies."
    >
      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div
          className="absolute inset-0 opacity-15"
          style={{ backgroundImage: "radial-gradient(circle at 25% 35%, hsl(35,92%,50%) 0%, transparent 55%), radial-gradient(circle at 80% 55%, hsl(25,95%,45%) 0%, transparent 55%)" }}
        />
        <div className="container mx-auto px-4 text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-1.5 text-sm text-amber-400 mb-6">
            <Sparkles className="h-4 w-4" /> Solutions
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 text-white">
            Built for <GradientText>your kind</GradientText> of agency
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10">
            Whatever you sell — pilgrimages, tickets, visas, tours or manpower — the platform adapts to your workflow. Turn on exactly the services you need.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register"><Button size="lg" className={`${PRIMARY_BTN} px-8 h-12`}>Start free trial<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Link to="/modules"><Button size="lg" variant="outline" className={`${GHOST_BTN} px-8 h-12`}>See all modules</Button></Link>
          </div>
        </div>
      </section>

      {/* Solutions grid */}
      <Section alt>
        <SectionHeading
          badge="By agency type"
          title={<>One platform, <GradientText>many playbooks</GradientText></>}
          subtitle="Each solution turns on the right services and operations desks for your business."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {INDUSTRY_SOLUTIONS.map((sol) => (
            <GlassCard key={sol.id} interactive className="flex flex-col">
              <IconTile icon={sol.icon} size="lg" className="mb-4" />
              <h3 className="font-semibold text-lg mb-1.5 text-white">{sol.name}</h3>
              <p className="text-sm text-white/45 mb-4 flex-1">{sol.tagline}</p>
              <div className="flex flex-wrap gap-1.5">
                {sol.services.map((s) => (
                  <span key={s} className="rounded-full border border-amber-400/20 bg-amber-400/5 px-2.5 py-0.5 text-[11px] text-amber-300/90">{s}</span>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </Section>

      {/* All services strip */}
      <Section>
        <SectionHeading
          badge="Every service"
          title={<>Sell all <GradientText>{TRAVEL_SERVICES.length} travel services</GradientText></>}
          subtitle="Available on every plan — services are chosen at onboarding, never limited by your subscription."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {TRAVEL_SERVICES.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <IconTile icon={s.icon} size="sm" />
              <span className="text-sm font-medium text-white/80">{s.name}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section alt className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Find your fit in minutes</h2>
        <p className="text-white/45 max-w-xl mx-auto mb-8">Pick your services at signup and start selling the same day.</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/register"><Button size="lg" className={`${PRIMARY_BTN} px-8 h-12`}>Get started free<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <Link to="/pricing"><Button size="lg" variant="outline" className={`${GHOST_BTN} px-8 h-12`}>Compare plans</Button></Link>
        </div>
      </Section>
    </MarketingLayout>
  );
};

export default Solutions;
