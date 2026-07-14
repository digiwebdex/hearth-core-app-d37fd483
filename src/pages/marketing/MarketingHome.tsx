import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MarketingLayout from "@/components/MarketingLayout";
import {
  Sparkles, ArrowRight, Play, CheckCircle2, TrendingUp, Award,
  Users, UserPlus, FileText, CalendarCheck, Receipt, Calculator,
  Plane, Hotel, Ticket, Landmark, Building2, Briefcase,
  Wallet, BarChart3, Bell, MessageSquare, ClipboardList, CreditCard,
  Globe, ShieldCheck, Package, PieChart, Headset, MapPin,
} from "lucide-react";

const stats = [
  { value: "500+", label: "Travel Agencies" },
  { value: "৳2.5B+", label: "Bookings Processed" },
  { value: "50K+", label: "Trips Managed" },
  { value: "99.9%", label: "Uptime" },
];

const modules = [
  { icon: Users, name: "CRM & Clients", desc: "360° customer profiles" },
  { icon: UserPlus, name: "Leads", desc: "Capture & convert" },
  { icon: FileText, name: "Quotations", desc: "Branded proposals" },
  { icon: CalendarCheck, name: "Bookings", desc: "End-to-end reservations" },
  { icon: Receipt, name: "Invoicing", desc: "GST-ready billing" },
  { icon: Calculator, name: "Accounting", desc: "Full double-entry" },
  { icon: Plane, name: "Air Tickets", desc: "GDS & LCC fares" },
  { icon: Hotel, name: "Hotels", desc: "Global inventory" },
  { icon: Ticket, name: "Tour Packages", desc: "Build & sell tours" },
  { icon: Landmark, name: "Hajj & Umrah", desc: "Pilgrim management" },
  { icon: Globe, name: "Visa Processing", desc: "Applications & tracking" },
  { icon: Building2, name: "Vendors", desc: "Suppliers & payables" },
  { icon: Briefcase, name: "Corporate Travel", desc: "B2B accounts" },
  { icon: Wallet, name: "Payments", desc: "Collections & payouts" },
  { icon: BarChart3, name: "Reports", desc: "Real-time analytics" },
  { icon: PieChart, name: "Finance", desc: "P&L, balance sheet" },
  { icon: ClipboardList, name: "Tasks & Follow-ups", desc: "Never miss a step" },
  { icon: Bell, name: "Reminders", desc: "Flights & documents" },
  { icon: MessageSquare, name: "Campaigns", desc: "SMS, email & WhatsApp" },
  { icon: CreditCard, name: "Ledgers", desc: "Client & agent accounts" },
  { icon: Package, name: "Inventory", desc: "Stock & visa quota" },
  { icon: ShieldCheck, name: "Roles & Access", desc: "Granular permissions" },
  { icon: Headset, name: "Support Desk", desc: "Tickets & complaints" },
  { icon: MapPin, name: "Website Builder", desc: "Your own booking site" },
];

const MarketingHome = () => {
  return (
    <MarketingLayout
      title="TravelAgencyWeb — Run Your Entire Travel Agency From One Platform"
      description="Tours, visas, air tickets, hotels, accounting, Hajj & Umrah — everything your travel business needs, in English and Bangla."
    >
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-violet-50/40 to-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="container mx-auto grid items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          {/* Left */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" /> Trusted by 500+ agencies in Bangladesh
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Run Your Entire
              <br />
              <span className="text-primary">Travel Agency</span>
              <br />
              From One Platform
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Tours, visas, air tickets, hotels, accounting, Hajj &amp; Umrah — everything your
              travel business needs, in English and Bangla.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register">
                <Button size="lg" className="h-12 px-6 text-base shadow-lg shadow-primary/30">
                  Start 7-Day Free Trial <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/demo">
                <Button size="lg" variant="outline" className="h-12 border-slate-300 px-6 text-base">
                  <Play className="mr-1.5 h-4 w-4" /> Watch Demo
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {["No credit card", "Setup in minutes", "Cancel anytime"].map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {f}
                </span>
              ))}
            </div>
          </div>

          {/* Right — preview with floating stat chips */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5">
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 truncate text-xs font-medium text-slate-400">app.travelagencyweb.com/dashboard</span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Dashboard</p>
                    <p className="text-lg font-bold text-slate-900">Good morning, Rahim</p>
                  </div>
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">This month</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { k: "Revenue", v: "৳38.5L", up: "+12%" },
                    { k: "Bookings", v: "1,240", up: "+8%" },
                    { k: "New Leads", v: "318", up: "+21%" },
                  ].map((t) => (
                    <div key={t.k} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <p className="text-[11px] text-slate-400">{t.k}</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{t.v}</p>
                      <p className="text-[10px] font-semibold text-emerald-500">{t.up}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-slate-100 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">Revenue trend</p>
                    <p className="text-[10px] text-slate-400">Last 8 months</p>
                  </div>
                  <div className="flex h-24 items-end gap-2">
                    {[40, 55, 48, 70, 62, 85, 78, 96].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-primary/30 to-primary" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Floating: Monthly Revenue */}
            <div className="absolute -left-4 top-10 flex items-center gap-3 rounded-xl bg-white p-3 pr-5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">Monthly Revenue</p>
                <p className="text-base font-bold text-slate-900">৳ 38,50,000</p>
              </div>
            </div>
            {/* Floating: Bookings Today */}
            <div className="absolute -right-3 bottom-10 flex items-center gap-3 rounded-xl bg-white p-3 pr-5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Award className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">Bookings Today</p>
                <p className="text-base font-bold text-slate-900">42 new</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-slate-900">
        <div className="container mx-auto grid grid-cols-2 gap-8 px-4 py-12 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-white sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-4 w-4" /> Everything Included
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              25 Powerful Modules, One Platform
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Replace a dozen tools. Manage every corner of your travel business from a single,
              beautifully simple dashboard.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {modules.map((m) => (
              <div
                key={m.name}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <m.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{m.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-b from-white to-violet-50/60 py-20">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center shadow-xl shadow-primary/30 sm:px-12">
            <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <h2 className="text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl">
              Ready to run your agency from one platform?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/85">
              Join 500+ travel agencies growing with TravelAgencyWeb. Start your free 7-day trial —
              no credit card required.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register">
                <Button size="lg" variant="secondary" className="h-12 px-6 text-base font-semibold">
                  Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="h-12 border-white/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default MarketingHome;
