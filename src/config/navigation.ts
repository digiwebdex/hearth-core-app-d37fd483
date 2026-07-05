import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LayoutGrid,
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
  CalendarClock,
  Newspaper,
  DollarSign,
  Search,
  Star,
  Hotel,
  MapPinned,
  Bus,
  ShieldCheck,
  HardHat,
  BadgeCheck,
  FileCheck2,
  Sparkles,
  Zap,
  Plug,
  Megaphone,
  ShoppingCart,
  Ticket,
} from "lucide-react";
import type { PlanType } from "@/lib/plans";
import type { Module } from "@/lib/permissions";
import type { ServiceType } from "@/lib/serviceTypes";
import { bookingPresetPath } from "@/lib/bookingRoutePresets";

/** Default packages landing — catalog shows all types with in-page tabs. */
const PACKAGES_ALL = "/packages/all";

export interface NavItemConfig {
  id: string;
  /** i18n key. When absent, `title` is used verbatim (new items that have no key yet). */
  titleKey?: string;
  /** Plain-label fallback used when `titleKey` is absent. */
  title?: string;
  url?: string;
  icon: LucideIcon;
  module: Module;
  /** Locked (not hidden) unless the plan has this feature flag. */
  requiredFeature?: string;
  /** Locked (not hidden) unless tenant plan rank ≥ this floor. */
  minPlan?: PlanType;
  /** Locked (not hidden) unless at least one of these service types is enabled for the tenant. */
  requiredServiceTypes?: ServiceType[];
  children?: NavItemConfig[];
}

export interface NavGroupConfig {
  id: string;
  /** i18n key. When absent, `label` is used verbatim. */
  labelKey?: string;
  /** Plain-label fallback used when `labelKey` is absent. */
  label?: string;
  icon: LucideIcon;
  items: NavItemConfig[];
}

export interface NavigationOptions {
  /** @deprecated Operations desks now derive from enabledServiceTypes. Ignored. */
  enableHajjUmrahModule?: boolean;
  /** @deprecated Operations desks now derive from enabledServiceTypes. Ignored. */
  enableBdOperationsModule?: boolean;
  /** When true, shows Activity log in HR & Payroll (owner/manager). */
  showActivityLog?: boolean;
  /** Empty or omitted = all service presets visible. Drives which travel services are unlocked. */
  enabledServiceTypes?: string[];
  enabledSubcategories?: string[];
}

// ── Travel Services (section 5) ──────────────────────────────────────────────
// The 13 travel services surfaced as their own sidebar group. Each is SHOWN
// FOR EVERY TENANT — unlocked when its service type is enabled (or the tenant
// shows-all), locked (🔒 + upgrade) otherwise. URLs reuse existing routes only:
// the per-type booking views (`/bookings/:preset`), the CorporateTravel page,
// and the unified service catalog (`/packages/all`) — no new pages are created.
const TRAVEL_SERVICES: NavItemConfig[] = [
  { id: "svc-air-ticket", title: "Air Ticket", url: bookingPresetPath("flight"), icon: Plane, module: "bookings", requiredServiceTypes: ["air_ticket"] },
  { id: "svc-visa", title: "Visa", url: bookingPresetPath("visa"), icon: FileCheck2, module: "bookings", requiredServiceTypes: ["visa"] },
  { id: "svc-hotel", title: "Hotel", url: bookingPresetPath("hotel"), icon: Hotel, module: "bookings", requiredServiceTypes: ["hotel"] },
  { id: "svc-hajj-umrah", title: "Hajj & Umrah", url: "/hajj-umrah", icon: Moon, module: "hajj_umrah", requiredServiceTypes: ["hajj_umrah"] },
  { id: "svc-tour", title: "Tour", url: bookingPresetPath("tour"), icon: MapPinned, module: "bookings", requiredServiceTypes: ["tour_domestic", "tour_international"] },
  { id: "svc-transport", title: "Transportation", url: bookingPresetPath("transport"), icon: Bus, module: "bookings", requiredServiceTypes: ["transport"] },
  { id: "svc-insurance", title: "Insurance", url: bookingPresetPath("insurance"), icon: ShieldCheck, module: "bookings", requiredServiceTypes: ["custom"] },
  { id: "svc-student", title: "Student Consultancy", url: bookingPresetPath("student"), icon: GraduationCap, module: "bookings", requiredServiceTypes: ["study_abroad"] },
  { id: "svc-manpower", title: "Overseas Manpower", url: bookingPresetPath("manpower"), icon: HardHat, module: "bookings", requiredServiceTypes: ["b2b_agent"] },
  { id: "svc-corporate", title: "Corporate Travel", url: "/corporate", icon: Building2, module: "clients", requiredServiceTypes: ["corporate_travel", "mice_event"] },
  { id: "svc-passport", title: "Passport Service", url: PACKAGES_ALL, icon: BadgeCheck, module: "packages", requiredServiceTypes: ["custom"] },
  { id: "svc-documentation", title: "Travel Documentation", url: PACKAGES_ALL, icon: FileText, module: "packages", requiredServiceTypes: ["custom"] },
  { id: "svc-other", title: "Other Services", url: PACKAGES_ALL, icon: Package2, module: "packages", requiredServiceTypes: ["custom"] },
];

/**
 * The single source of truth for the Tenant ERP sidebar. Returns the FULL
 * static 15-section tree; the renderer (AppSidebarNav) applies RBAC (hide) and
 * plan/feature/service gates (lock). Sidebar order matches
 * docs/v2-master/105-Frontend-Restructure.md / 04-Service-Modules.md.
 */
export function getNavigationGroups(options: NavigationOptions = {}): NavGroupConfig[] {
  const showActivityLog = options.showActivityLog === true;

  return [
    // 1 — Dashboard
    {
      id: "dashboard",
      labelKey: "sidebar.overview",
      icon: LayoutDashboard,
      items: [
        { id: "dashboard", titleKey: "sidebar.dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
      ],
    },

    // 2 — CRM
    {
      id: "crm",
      labelKey: "sidebar.crm",
      icon: UserCheck,
      items: [
        { id: "crm-hub", titleKey: "sidebar.crmWorkspace", url: "/crm", icon: LayoutGrid, module: "clients" },
        { id: "clients", titleKey: "sidebar.clients", url: "/clients", icon: UserCheck, module: "clients" },
        { id: "agents", titleKey: "sidebar.agents", url: "/agents", icon: UserCog, module: "agents" },
        { id: "vendors", titleKey: "sidebar.vendors", url: "/vendors", icon: Store, module: "vendors" },
      ],
    },

    // 3 — Sales
    {
      id: "sales",
      label: "Sales",
      icon: ShoppingCart,
      items: [
        { id: "quotations", titleKey: "sidebar.quotations", url: "/quotations", icon: FileText, module: "quotations" },
        { id: "service-catalog", titleKey: "sidebar.serviceCatalogItem", url: PACKAGES_ALL, icon: Package2, module: "packages" },
        { id: "visa-stock", titleKey: "sidebar.visaStock", url: "/visa-stock", icon: Ticket, module: "bookings" },
      ],
    },

    // 4 — Booking
    {
      id: "booking",
      label: "Booking",
      icon: Plane,
      items: [
        { id: "bookings", titleKey: "sidebar.bookings", url: "/bookings", icon: Plane, module: "bookings" },
        { id: "ticket-transactions", titleKey: "sidebar.ticketTransactions", url: "/ticket-transactions", icon: RefreshCw, module: "bookings", requiredServiceTypes: ["air_ticket"] },
        { id: "flight-reminders", titleKey: "sidebar.flightReminders", url: "/flight-reminders", icon: Bell, module: "bookings", requiredServiceTypes: ["air_ticket"] },
        { id: "group-tours", titleKey: "sidebar.groupTours", url: "/group-tours", icon: Users, module: "bookings", minPlan: "basic", requiredServiceTypes: ["tour_domestic", "tour_international", "mice_event"] },
        { id: "mice", titleKey: "sidebar.mice", url: "/mice", icon: Briefcase, module: "bookings", minPlan: "basic", requiredServiceTypes: ["mice_event"] },
        { id: "travel-approvals", titleKey: "sidebar.travelApprovals", url: "/travel-approvals", icon: BookOpen, module: "bookings", minPlan: "basic", requiredServiceTypes: ["corporate_travel", "mice_event"] },
        { id: "visa-tracker", titleKey: "sidebar.visaTracker", url: "/visa-tracker", icon: FileText, module: "bookings", minPlan: "basic", requiredServiceTypes: ["visa", "study_abroad"] },
      ],
    },

    // 5 — Travel Services (13 services; shown locked when the service isn't enabled)
    {
      id: "travelServices",
      label: "Travel Services",
      icon: Sparkles,
      items: TRAVEL_SERVICES,
    },

    // 6 — Finance & Accounts
    {
      id: "financeAccounts",
      labelKey: "sidebar.financeAccounts",
      icon: Wallet,
      items: [
        { id: "invoices", titleKey: "sidebar.invoices", url: "/invoices", icon: Receipt, module: "invoices" },
        { id: "payments", titleKey: "sidebar.payments", url: "/payments", icon: CreditCard, module: "invoices" },
        { id: "expenses", titleKey: "sidebar.expenses", url: "/expenses", icon: Banknote, module: "accounts", minPlan: "basic" },
        { id: "commissions", titleKey: "sidebar.commissions", url: "/commissions", icon: Percent, module: "agents", requiredServiceTypes: ["air_ticket", "b2b_agent", "tour_domestic", "tour_international", "hajj_umrah"] },
        { id: "accounts", titleKey: "sidebar.accountsLedger", url: "/accounts", icon: Wallet, module: "accounts", minPlan: "basic" },
      ],
    },

    // 7 — HR & Payroll
    {
      id: "hrPayroll",
      labelKey: "sidebar.hrPayroll",
      icon: UserCog2,
      items: [
        { id: "team", titleKey: "sidebar.team", url: "/team", icon: Users, module: "team" },
        { id: "hrm", titleKey: "sidebar.hrm", url: "/hrm", icon: CalendarClock, module: "team" },
        { id: "roles", titleKey: "sidebar.roles", url: "/roles", icon: UserCog2, module: "team" },
        { id: "recruitment", title: "Recruitment", url: "/recruitment", icon: BadgeCheck, module: "team", minPlan: "business" },
        ...(showActivityLog
          ? [{ id: "activity-log", titleKey: "sidebar.activityLog", url: "/activity-log", icon: Activity, module: "team" as Module }]
          : []),
        { id: "payroll", titleKey: "sidebar.payroll", url: "/payroll", icon: DollarSign, module: "team", minPlan: "basic" },
      ],
    },

    // 8 — Documents
    {
      id: "documents",
      labelKey: "sidebar.documents",
      icon: FolderOpen,
      items: [
        { id: "documents", titleKey: "sidebar.documents", url: "/documents", icon: FolderOpen, module: "clients" },
        { id: "tasks", titleKey: "sidebar.tasks", url: "/tasks", icon: ListTodo, module: "tasks" },
      ],
    },

    // 9 — Marketing
    {
      id: "marketing",
      label: "Marketing",
      icon: Megaphone,
      items: [
        { id: "campaigns", title: "Campaigns", url: "/campaigns", icon: Megaphone, module: "clients", minPlan: "business", requiredFeature: "hasMarketingTools" },
        { id: "loyalty", titleKey: "sidebar.loyalty", url: "/loyalty", icon: Star, module: "clients", minPlan: "enterprise" },
        { id: "referrals", titleKey: "sidebar.referrals", url: "/referrals", icon: Users, module: "clients", minPlan: "enterprise" },
      ],
    },

    // 10 — Website CMS
    {
      id: "websiteCms",
      labelKey: "sidebar.websiteCms",
      icon: Wand2,
      items: [
        { id: "website-home", titleKey: "sidebar.websiteHome", url: "/website", icon: Globe, module: "website", requiredFeature: "hasWebsiteTemplates", minPlan: "pro" },
        { id: "website-builder", titleKey: "sidebar.themeBuilder", url: "/website/builder", icon: Wand2, module: "website", requiredFeature: "hasWebsiteTemplates", minPlan: "pro" },
        { id: "website-blog", titleKey: "sidebar.websiteBlog", url: "/website/blog", icon: Newspaper, module: "website", requiredFeature: "hasWebsiteTemplates", minPlan: "pro" },
        { id: "website-publish", titleKey: "sidebar.publishDomain", url: "/website/publish", icon: UploadCloud, module: "website", requiredFeature: "hasWebsiteTemplates", minPlan: "pro" },
        { id: "website-seo", titleKey: "sidebar.websiteSeo", url: "/website/seo", icon: Search, module: "website", requiredFeature: "hasWebsiteTemplates", minPlan: "pro" },
      ],
    },

    // 11 — Reports
    {
      id: "reports",
      label: "Reports",
      icon: BarChart3,
      items: [
        { id: "reports", titleKey: "sidebar.financialReports", url: "/reports", icon: BarChart3, module: "reports", minPlan: "basic" },
        { id: "sales-analytics", title: "Sales Analytics", url: "/sales-analytics", icon: BarChart3, module: "reports", minPlan: "business", requiredFeature: "hasAdvancedAnalytics" },
        { id: "financial-statements", title: "Financial Statements", url: "/financial-statements", icon: FileText, module: "reports", minPlan: "basic" },
      ],
    },

    // 12 — Automation
    {
      id: "automation",
      label: "Automation",
      icon: Zap,
      items: [
        { id: "notifications", titleKey: "sidebar.notifications", url: "/notifications", icon: Bell, module: "reports" },
        { id: "finance-reminders", title: "Reminders", url: "/finance/reminders", icon: CalendarClock, module: "reports" },
      ],
    },

    // 13 — Integrations
    {
      id: "integrations",
      label: "Integrations",
      icon: Plug,
      items: [
        { id: "integrations", title: "Payment & Messaging", url: "/settings", icon: Plug, module: "settings", minPlan: "pro" },
      ],
    },

    // 14 — Settings
    {
      id: "settings",
      labelKey: "sidebar.settings",
      icon: Settings,
      items: [
        { id: "settings", titleKey: "sidebar.settings", url: "/settings", icon: Settings, module: "settings" },
        { id: "organization", titleKey: "sidebar.organization", url: "/organization", icon: Building2, module: "organization" },
        { id: "tax", title: "Tax Rules", url: "/settings/tax", icon: Percent, module: "settings", minPlan: "basic" },
        { id: "userGuide", titleKey: "sidebar.userGuide", url: "/user-guide", icon: BookOpen, module: "dashboard" },
      ],
    },

    // 15 — Subscription
    {
      id: "subscription",
      labelKey: "sidebar.subscription",
      icon: Crown,
      items: [
        { id: "subscription", titleKey: "sidebar.subscription", url: "/subscription", icon: Crown, module: "subscription" },
        { id: "billing", title: "Billing", url: "/settings/billing", icon: CreditCard, module: "subscription" },
      ],
    },
  ];
}

/** @deprecated Use getNavigationGroups() — kept for tests and gradual migration. */
export const navigationGroups = getNavigationGroups();

/** Default packages landing — catalog shows all types with in-page tabs. */
export const packagesDefaultPath = PACKAGES_ALL;
