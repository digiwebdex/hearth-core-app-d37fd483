import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Target,
  UserCheck,
  UserCog,
  Store,
  FileText,
  Package2,
  Plane,
  RefreshCw,
  Moon,
  GraduationCap,
  ListTodo,
  Clock,
  FolderOpen,
  Receipt,
  CreditCard,
  Wallet,
  Banknote,
  Percent,
  BarChart3,
  Globe,
  Wand2,
  UploadCloud,
  Users,
  UserCog2,
  Building2,
  Crown,
  Bell,
  Settings,
  BookOpen,
  Briefcase,
  Activity,
  Headphones,
  CalendarClock,
  Newspaper,
  TrendingUp,
  DollarSign,
  Search,
  Star,
} from "lucide-react";
import type { PlanType } from "@/lib/plans";
import type { Module } from "@/lib/permissions";
import { normalizeEnabledServiceTypes, resolveEffectiveServiceTypes } from "@/lib/enabledServiceTypes";

export interface NavItemConfig {
  id: string;
  titleKey: string;
  url?: string;
  icon: LucideIcon;
  module: Module;
  requiredFeature?: string;
  minPlan?: PlanType;
  children?: NavItemConfig[];
}

export interface NavGroupConfig {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: NavItemConfig[];
}

export interface NavigationOptions {
  /** When false, hides Hajj/Umrah Operations from Operations group. Default true. */
  enableHajjUmrahModule?: boolean;
  /** When true, shows Student/Manpower operations desk. Default false. */
  enableBdOperationsModule?: boolean;
  /** When true, shows Activity log in Administration (owner/manager). */
  showActivityLog?: boolean;
  /** Empty or omitted = all service presets visible. */
  enabledServiceTypes?: string[];
  enabledSubcategories?: string[];
}

export function getNavigationGroups(options: NavigationOptions = {}): NavGroupConfig[] {
  const enabled = resolveEffectiveServiceTypes(
    normalizeEnabledServiceTypes(options.enabledServiceTypes),
    options.enabledSubcategories,
  );
  const showAllServices = enabled.length === 0
    && !(options.enabledSubcategories?.length);
  let enableHajj = options.enableHajjUmrahModule !== false;
  let enableBd = options.enableBdOperationsModule === true;
  if (!showAllServices) {
    if (!enabled.includes("hajj_umrah")) enableHajj = false;
    if (!enabled.includes("study_abroad") && !enabled.includes("b2b_agent")) enableBd = false;
  }
  const showActivityLog = options.showActivityLog === true;

  const operationsItems: NavItemConfig[] = [
    { id: "documents", titleKey: "sidebar.documents", url: "/documents", icon: FolderOpen, module: "clients" },
    { id: "tasks", titleKey: "sidebar.tasks", url: "/tasks", icon: ListTodo, module: "tasks" },
    {
      id: "service-operations",
      titleKey: "sidebar.serviceOperations",
      url: "/operations/services",
      icon: Briefcase,
      module: "bookings",
    },
    {
      id: "support-tickets",
      titleKey: "sidebar.supportTickets",
      url: "/support",
      icon: Headphones,
      module: "tasks",
    },
  ];

  if (enableHajj) {
    operationsItems.push({
      id: "hajj-operations",
      titleKey: "sidebar.hajjUmrahOperations",
      url: "/hajj-umrah",
      icon: Moon,
      module: "hajj_umrah",
    });
  }

  if (enableBd) {
    operationsItems.push({
      id: "bd-operations",
      titleKey: "sidebar.bdOperations",
      url: "/operations/bd",
      icon: GraduationCap,
      module: "bookings",
    });
  }

  return [
    {
      id: "overview",
      labelKey: "sidebar.overview",
      icon: LayoutDashboard,
      items: [
        {
          id: "dashboard",
          titleKey: "sidebar.dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
          module: "dashboard",
        },
      ],
    },
    {
      id: "crm",
      labelKey: "sidebar.crm",
      icon: UserCheck,
      items: [
        { id: "leads", titleKey: "sidebar.leads", url: "/leads", icon: Target, module: "leads" },
        { id: "follow-ups", titleKey: "sidebar.followUps", url: "/follow-ups", icon: Clock, module: "leads" },
        { id: "clients", titleKey: "sidebar.clients", url: "/clients", icon: UserCheck, module: "clients" },
        { id: "corporate", titleKey: "sidebar.corporateTravel", url: "/corporate", icon: Building2, module: "clients" },
        { id: "agents", titleKey: "sidebar.agents", url: "/agents", icon: UserCog, module: "agents" },
        { id: "vendors", titleKey: "sidebar.vendors", url: "/vendors", icon: Store, module: "vendors" },
      ],
    },
    {
      id: "serviceCatalog",
      labelKey: "sidebar.serviceCatalog",
      icon: Package2,
      items: [
        {
          id: "service-catalog",
          titleKey: "sidebar.serviceCatalogItem",
          url: "/packages/all",
          icon: Package2,
          module: "packages",
        },
      ],
    },
    {
      id: "sales",
      labelKey: "sidebar.sales",
      icon: Plane,
      items: [
        { id: "quotations", titleKey: "sidebar.quotations", url: "/quotations", icon: FileText, module: "quotations" },
        { id: "bookings", titleKey: "sidebar.bookings", url: "/bookings", icon: Plane, module: "bookings" },
        { id: "ticket-transactions", titleKey: "sidebar.ticketTransactions", url: "/ticket-transactions", icon: RefreshCw, module: "bookings" },
        { id: "flight-reminders", titleKey: "sidebar.flightReminders", url: "/flight-reminders", icon: Bell, module: "bookings" },
        { id: "bsp-reconcile", titleKey: "sidebar.bspReconcile", url: "/bsp-reconcile", icon: FileText, module: "bookings" },
        { id: "bulk-import", titleKey: "sidebar.bulkImport", url: "/bulk-import", icon: UploadCloud, module: "bookings" },
      ],
    },
    {
      id: "operations",
      labelKey: "sidebar.operations",
      icon: Briefcase,
      items: operationsItems,
    },
    {
      id: "finance",
      labelKey: "sidebar.finance",
      icon: Wallet,
      items: [
        { id: "invoices", titleKey: "sidebar.invoices", url: "/invoices", icon: Receipt, module: "invoices" },
        { id: "payments", titleKey: "sidebar.payments", url: "/payments", icon: CreditCard, module: "invoices" },
        {
          id: "finance-reminders",
          titleKey: "sidebar.paymentReminders",
          url: "/finance/reminders",
          icon: Bell,
          module: "invoices",
        },
        {
          id: "expenses",
          titleKey: "sidebar.expenses",
          url: "/expenses",
          icon: Banknote,
          module: "accounts",
          minPlan: "basic",
        },
        {
          id: "commissions",
          titleKey: "sidebar.commissions",
          url: "/commissions",
          icon: Percent,
          module: "agents",
        },
        {
          id: "accounts",
          titleKey: "sidebar.accountsLedger",
          url: "/accounts",
          icon: Wallet,
          module: "accounts",
          minPlan: "basic",
        },
        {
          id: "reports",
          titleKey: "sidebar.financialReports",
          url: "/reports",
          icon: BarChart3,
          module: "reports",
          requiredFeature: "hasAdvancedAnalytics",
          minPlan: "business",
        },
        {
          id: "financial-statements",
          titleKey: "sidebar.financialStatements",
          url: "/financial-statements",
          icon: TrendingUp,
          module: "reports",
          minPlan: "basic",
        },
        {
          id: "payroll",
          titleKey: "sidebar.payroll",
          url: "/payroll",
          icon: DollarSign,
          module: "team",
          minPlan: "basic",
        },
        {
          id: "sales-analytics",
          titleKey: "sidebar.salesAnalytics",
          url: "/sales-analytics",
          icon: TrendingUp,
          module: "reports",
          minPlan: "basic",
        },
      ],
    },
    {
      id: "crmMarketing",
      labelKey: "sidebar.crmMarketing",
      icon: Star,
      items: [
        {
          id: "loyalty",
          titleKey: "sidebar.loyalty",
          url: "/loyalty",
          icon: Star,
          module: "clients",
          minPlan: "basic",
        },
        {
          id: "referrals",
          titleKey: "sidebar.referrals",
          url: "/referrals",
          icon: Users,
          module: "clients",
          minPlan: "basic",
        },
        {
          id: "group-tours",
          titleKey: "sidebar.groupTours",
          url: "/group-tours",
          icon: Globe,
          module: "bookings",
          minPlan: "basic",
        },
        {
          id: "mice",
          titleKey: "sidebar.mice",
          url: "/mice",
          icon: Briefcase,
          module: "bookings",
          minPlan: "basic",
        },
        {
          id: "travel-approvals",
          titleKey: "sidebar.travelApprovals",
          url: "/travel-approvals",
          icon: BookOpen,
          module: "bookings",
          minPlan: "basic",
        },
        {
          id: "visa-tracker",
          titleKey: "sidebar.visaTracker",
          url: "/visa-tracker",
          icon: FileText,
          module: "bookings",
          minPlan: "basic",
        },
        {
          id: "inventory",
          titleKey: "sidebar.inventory",
          url: "/inventory",
          icon: Store,
          module: "bookings",
          minPlan: "basic",
        },
        {
          id: "recruitment",
          titleKey: "sidebar.recruitment",
          url: "/recruitment",
          icon: UserCog,
          module: "team",
          minPlan: "basic",
        },
      ],
    },
    {
      id: "websiteCms",
      labelKey: "sidebar.websiteCms",
      icon: Globe,
      items: [
        {
          id: "website-home",
          titleKey: "sidebar.websiteHome",
          url: "/website",
          icon: Globe,
          module: "website",
          requiredFeature: "hasWebsiteTemplates",
          minPlan: "pro",
        },
        {
          id: "website-builder",
          titleKey: "sidebar.themeBuilder",
          url: "/website/builder",
          icon: Wand2,
          module: "website",
          requiredFeature: "hasWebsiteTemplates",
          minPlan: "pro",
        },
        {
          id: "website-blog",
          titleKey: "sidebar.websiteBlog",
          url: "/website/blog",
          icon: Newspaper,
          module: "website",
          requiredFeature: "hasWebsiteTemplates",
          minPlan: "pro",
        },
        {
          id: "website-publish",
          titleKey: "sidebar.publishDomain",
          url: "/website/publish",
          icon: UploadCloud,
          module: "website",
          requiredFeature: "hasWebsiteTemplates",
          minPlan: "pro",
        },
        {
          id: "website-seo",
          titleKey: "sidebar.websiteSeo",
          url: "/website/seo",
          icon: Search,
          module: "website",
          requiredFeature: "hasWebsiteTemplates",
          minPlan: "pro",
        },
      ],
    },
    {
      id: "administration",
      labelKey: "sidebar.administration",
      icon: Settings,
      items: [
        { id: "team", titleKey: "sidebar.team", url: "/team", icon: Users, module: "team" },
        { id: "hrm", titleKey: "sidebar.hrm", url: "/hrm", icon: CalendarClock, module: "team" },
        { id: "roles", titleKey: "sidebar.roles", url: "/roles", icon: UserCog2, module: "team" },
        ...(showActivityLog
          ? [{ id: "activity-log", titleKey: "sidebar.activityLog", url: "/activity-log", icon: Activity, module: "team" as const }]
          : []),
        { id: "notifications", titleKey: "sidebar.notifications", url: "/notifications", icon: Bell, module: "reports" },
        { id: "settings", titleKey: "sidebar.settings", url: "/settings", icon: Settings, module: "settings" },
        { id: "organization", titleKey: "sidebar.organization", url: "/organization", icon: Building2, module: "organization" },
        { id: "subscription", titleKey: "sidebar.subscription", url: "/subscription", icon: Crown, module: "subscription" },
        { id: "userGuide", titleKey: "sidebar.userGuide", url: "/user-guide", icon: BookOpen, module: "dashboard" },
      ],
    },
  ];
}

/** @deprecated Use getNavigationGroups() — kept for tests and gradual migration. */
export const navigationGroups = getNavigationGroups();

/** Default packages landing — catalog shows all types with in-page tabs. */
export const packagesDefaultPath = "/packages/all";
