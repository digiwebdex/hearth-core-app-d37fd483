import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Users, UserCheck, UserCog, Store, Target, ListTodo, FileText, Plane, Package2,
  Receipt, Wallet, BarChart3, Bell, Moon, Building2, Globe, Crown, Settings, BookOpen,
  ListOrdered, Briefcase, Clock, FolderOpen, ArrowRight, PlayCircle, HelpCircle,
  MessageCircle, CalendarClock, CheckCircle2,
} from "lucide-react";

const sectionIcons: Record<string, typeof BookOpen> = {
  "getting-started": BookOpen,
  "daily-workflow": ListOrdered,
  "sidebar-map": LayoutDashboard,
  dashboard: LayoutDashboard,
  "inquiry-followup": HelpCircle,
  clients: UserCheck,
  agents: UserCog,
  vendors: Store,
  leads: Target,
  "follow-ups": Clock,
  tasks: ListTodo,
  quotations: FileText,
  packages: Package2,
  bookings: Plane,
  operations: Briefcase,
  invoices: Receipt,
  "finance-desk": Bell,
  accounts: Wallet,
  reports: BarChart3,
  notifications: Bell,
  hajj: Moon,
  portal: Globe,
  documents: FolderOpen,
  team: Users,
  organization: Building2,
  website: Globe,
  subscription: Crown,
  settings: Settings,
};

/** Display order — most important for new agency owners first. */
const sectionIds = [
  "getting-started",
  "daily-workflow",
  "sidebar-map",
  "dashboard",
  "inquiry-followup",
  "leads",
  "follow-ups",
  "quotations",
  "packages",
  "bookings",
  "operations",
  "invoices",
  "finance-desk",
  "accounts",
  "clients",
  "agents",
  "vendors",
  "hajj",
  "portal",
  "documents",
  "tasks",
  "reports",
  "notifications",
  "team",
  "organization",
  "website",
  "subscription",
  "settings",
];

const UserGuide = () => {
  const { t } = useTranslation();

  const workflowPhases = t("userGuide.workflow.phases", { returnObjects: true }) as Array<{
    title: string;
    steps: string[];
  }>;

  const threePillars = t("userGuide.threePillars.items", { returnObjects: true }) as Array<{
    title: string;
    desc: string;
  }>;

  const quickStart = t("userGuide.quickStartVideo", { returnObjects: true }) as {
    title: string;
    subtitle: string;
    duration: string;
    steps: string[];
    note: string;
  };

  const sections = sectionIds
    .filter((id) => sectionIcons[id])
    .map((id) => {
      const data = t(`userGuide.sections.${id}`, { returnObjects: true }) as {
        title: string;
        intro: string;
        steps: string[];
        tips?: string[];
      };
      return { id, icon: sectionIcons[id], ...data };
    })
    .filter((s) => s.title && s.steps?.length);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">{t("userGuide.title")}</h1>
            </div>
            <p className="text-muted-foreground">{t("userGuide.subtitle")}</p>
          </div>
          <Badge variant="secondary" className="hidden md:inline-flex shrink-0">
            {t("userGuide.badge")}
          </Badge>
        </div>

        {quickStart?.title && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-amber-600" />
                {quickStart.title}
                <Badge variant="outline" className="ml-1">{quickStart.duration}</Badge>
              </CardTitle>
              <CardDescription>{quickStart.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                {quickStart.steps?.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground border-t pt-3">{quickStart.note}</p>
            </CardContent>
          </Card>
        )}

        {/* Main business workflow */}
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              {t("userGuide.workflow.title")}
            </CardTitle>
            <CardDescription>{t("userGuide.workflow.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Array.isArray(workflowPhases) &&
              workflowPhases.map((phase, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                      {idx + 1}
                    </span>
                    {phase.title}
                  </h3>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground ml-8">
                    {phase.steps?.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* Inquiry → Booking process map (organogram) */}
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-orange-500" />
              {t("userGuide.sections.inquiry-followup.title", { defaultValue: "Inquiry & Follow-up" })}
            </CardTitle>
            <CardDescription>
              {t("userGuide.sections.inquiry-followup.intro", { defaultValue: "How a price-asking customer becomes a confirmed booking." })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-stretch gap-2">
              {/* Step row 1: add as inquiry */}
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15 text-orange-600 shrink-0"><HelpCircle className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">1 · Add booking as “Inquiry”</p>
                  <p className="text-xs text-muted-foreground">Customer asked a price — name, phone, service. 10 seconds.</p>
                </div>
              </div>
              <div className="flex justify-center text-muted-foreground"><ArrowRight className="h-4 w-4 rotate-90" /></div>

              {/* Step row 2: shows on dashboard */}
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 shrink-0"><LayoutDashboard className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">2 · Shows on Dashboard automatically</p>
                  <p className="text-xs text-muted-foreground">“Inquiries to follow up” → the only screen you open daily.</p>
                </div>
              </div>
              <div className="flex justify-center text-muted-foreground"><ArrowRight className="h-4 w-4 rotate-90" /></div>

              {/* Step row 3: branch */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 shrink-0"><CalendarClock className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Not yet? Snooze</p>
                    <p className="text-xs text-muted-foreground">Pick a date — comes back on that day.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/15 text-green-600 shrink-0"><MessageCircle className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Ready? WhatsApp / call</p>
                    <p className="text-xs text-muted-foreground">One tap to message the customer.</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center text-muted-foreground"><ArrowRight className="h-4 w-4 rotate-90" /></div>

              {/* Step row 4: convert */}
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 shrink-0"><CheckCircle2 className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">3 · Convert to booking</p>
                  <p className="text-xs text-muted-foreground">Status → Confirmed. Invoice, payment & receipt follow automatically — no retyping.</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-center text-muted-foreground">No separate lead module — the booking status does everything.</p>
          </CardContent>
        </Card>

        {/* Catalog vs Sales vs Ops */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("userGuide.threePillars.title")}</CardTitle>
            <CardDescription>{t("userGuide.threePillars.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.isArray(threePillars) &&
                threePillars.map((item, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("userGuide.quickNav")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <s.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{s.title}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Accordion
          type="multiple"
          defaultValue={["getting-started", "daily-workflow"]}
          className="space-y-3"
        >
          {sections.map((s) => (
            <AccordionItem key={s.id} value={s.id} id={s.id} className="border rounded-lg bg-card scroll-mt-24">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-semibold">{s.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <p className="text-muted-foreground mb-3">{s.intro}</p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-2 text-sm uppercase tracking-wide text-muted-foreground">
                      {t("userGuide.steps")}
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-sm leading-relaxed">
                      {s.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  {s.tips && s.tips.length > 0 && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                      <h4 className="font-medium mb-1.5 text-sm">{t("userGuide.tips")}</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {s.tips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {t("userGuide.help")}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>{t("userGuide.helpIntro")}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t("userGuide.helpEmail")}</li>
              <li>{t("userGuide.helpWeb")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UserGuide;
