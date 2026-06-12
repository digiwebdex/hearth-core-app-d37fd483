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
  Moon,
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
} from "lucide-react";
import type { PlanType } from "@/lib/plans";
import type { Module } from "@/lib/permissions";

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
  items: NavItemConfig[];
}

export interface NavigationOptions {
  /** When false, hides Hajj/Umrah Operations from Operations group. Default true. */
  enableHajjUmrahModule?: boolean;
}

export function getNavigationGroups(options: NavigationOptions = {}): NavGroupConfig[] {
  const enableHajj = options.enableHajjUmrahModule !== false;

  const operationsItems: NavItemConfig[] = [
    { id: "documents", titleKey: "sidebar.documents", url: "/documents", icon: FolderOpen, module: "clients" },
    { id: "tasks", titleKey: "sidebar.tasks", url: "/tasks", icon: ListTodo, module: "tasks" },
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

  return [
    {
      id: "overview",
      labelKey: "sidebar.overview",
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
      items: [
        { id: "leads", titleKey: "sidebar.leads", url: "/leads", icon: Target, module: "leads" },
        { id: "follow-ups", titleKey: "sidebar.followUps", url: "/follow-ups", icon: Clock, module: "leads" },
        { id: "clients", titleKey: "sidebar.clients", url: "/clients", icon: UserCheck, module: "clients" },
        { id: "agents", titleKey: "sidebar.agents", url: "/agents", icon: UserCog, module: "agents" },
        { id: "vendors", titleKey: "sidebar.vendors", url: "/vendors", icon: Store, module: "vendors" },
      ],
    },
    {
      id: "sales",
      labelKey: "sidebar.sales",
      items: [
        { id: "quotations", titleKey: "sidebar.quotations", url: "/quotations", icon: FileText, module: "quotations" },
        { id: "bookings", titleKey: "sidebar.bookings", url: "/bookings", icon: Plane, module: "bookings" },
      ],
    },
    {
      id: "serviceCatalog",
      labelKey: "sidebar.serviceCatalog",
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
      id: "operations",
      labelKey: "sidebar.operations",
      items: operationsItems,
    },
    {
      id: "finance",
      labelKey: "sidebar.finance",
      items: [
        { id: "invoices", titleKey: "sidebar.invoices", url: "/invoices", icon: Receipt, module: "invoices" },
        { id: "payments", titleKey: "sidebar.payments", url: "/payments", icon: CreditCard, module: "invoices" },
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
      ],
    },
    {
      id: "websiteCms",
      labelKey: "sidebar.websiteCms",
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
          id: "website-publish",
          titleKey: "sidebar.publishDomain",
          url: "/website/publish",
          icon: UploadCloud,
          module: "website",
          requiredFeature: "hasWebsiteTemplates",
          minPlan: "pro",
        },
      ],
    },
    {
      id: "administration",
      labelKey: "sidebar.administration",
      items: [
        { id: "team", titleKey: "sidebar.team", url: "/team", icon: Users, module: "team" },
        { id: "roles", titleKey: "sidebar.roles", url: "/roles", icon: UserCog2, module: "team" },
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
