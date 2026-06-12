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
  MapPin,
  Ticket,
  Hotel,
  Stamp,
  GraduationCap,
  HardHat,
  ListTodo,
  Receipt,
  CreditCard,
  Wallet,
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
import { DEFAULT_PACKAGE_PRESET, type PackagePresetId } from "@/lib/packageRoutePresets";
import { type BookingPresetId } from "@/lib/bookingRoutePresets";

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

const PACKAGE_CHILD_ICONS: Record<PackagePresetId, LucideIcon> = {
  all: Package2,
  tour: MapPin,
  hajj: Moon,
  umrah: Moon,
  visa: Stamp,
  hotel: Hotel,
  student: GraduationCap,
  manpower: HardHat,
};

function packageChild(id: PackagePresetId, titleKey: string): NavItemConfig {
  return {
    id: `packages-${id}`,
    titleKey,
    url: id === "all" ? `/packages/all` : `/packages/${id}`,
    icon: PACKAGE_CHILD_ICONS[id],
    module: "packages",
  };
}

function bookingChild(id: BookingPresetId, titleKey: string, icon: LucideIcon): NavItemConfig {
  return {
    id: `bookings-${id}`,
    titleKey,
    url: id === "all" ? "/bookings" : `/bookings/${id}`,
    icon,
    module: "bookings",
  };
}

export const navigationGroups: NavGroupConfig[] = [
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
      { id: "clients", titleKey: "sidebar.clients", url: "/clients", icon: UserCheck, module: "clients" },
      { id: "agents", titleKey: "sidebar.agents", url: "/agents", icon: UserCog, module: "agents" },
      { id: "vendors", titleKey: "sidebar.vendors", url: "/vendors", icon: Store, module: "vendors" },
      { id: "quotations", titleKey: "sidebar.quotations", url: "/quotations", icon: FileText, module: "quotations" },
    ],
  },
  {
    id: "packageManagement",
    labelKey: "sidebar.packageManagement",
    items: [
      packageChild("tour", "sidebar.packages.tour"),
      packageChild("hajj", "sidebar.packages.hajj"),
      packageChild("umrah", "sidebar.packages.umrah"),
      packageChild("visa", "sidebar.packages.visa"),
      packageChild("hotel", "sidebar.packages.hotel"),
      packageChild("student", "sidebar.packages.student"),
      packageChild("manpower", "sidebar.packages.manpower"),
      {
        id: "hajj-operations",
        titleKey: "sidebar.hajjUmrahOperations",
        url: "/hajj-umrah",
        icon: Moon,
        module: "hajj_umrah",
      },
    ],
  },
  {
    id: "bookings",
    labelKey: "sidebar.bookingsGroup",
    items: [
      bookingChild("all", "bookingsForm.categories.all", Plane),
      bookingChild("tour", "bookingsForm.categories.tour", MapPin),
      bookingChild("flight", "bookingsForm.categories.flight", Ticket),
      bookingChild("hotel", "bookingsForm.categories.hotel", Hotel),
      bookingChild("hajj", "bookingsForm.categories.hajj", Moon),
      bookingChild("umrah", "bookingsForm.categories.umrah", Moon),
      bookingChild("visa", "bookingsForm.categories.visa", Stamp),
      bookingChild("student", "bookingsForm.categories.student", GraduationCap),
      bookingChild("manpower", "bookingsForm.categories.manpower", HardHat),
    ],
  },
  {
    id: "support",
    labelKey: "sidebar.support",
    items: [
      { id: "tasks", titleKey: "sidebar.tasks", url: "/tasks", icon: ListTodo, module: "tasks" },
    ],
  },
  {
    id: "finance",
    labelKey: "sidebar.finance",
    items: [
      { id: "invoices", titleKey: "sidebar.invoices", url: "/invoices", icon: Receipt, module: "invoices" },
      { id: "payments", titleKey: "sidebar.payments", url: "/payments", icon: CreditCard, module: "invoices" },
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

/** Default packages landing when no preset in URL. */
export const packagesDefaultPath = `/packages/${DEFAULT_PACKAGE_PRESET}`;
