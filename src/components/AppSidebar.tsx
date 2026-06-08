import { LayoutDashboard, Users, Settings, Building2, LogOut, UserCheck, UserCog, Store, Target, ListTodo, Plane, Receipt, Wallet, Crown, Shield, BarChart3, Globe, Lock, UserCog2, FileText, Bell, BookOpen, Package2, CreditCard, UploadCloud, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getRoleMeta } from "@/lib/permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { PlanType } from "@/lib/plans";
import type { Module } from "@/lib/permissions";

interface MenuItem {
  titleKey?: string;
  title?: { bn: string; en: string };
  url: string;
  icon: any;
  module: Module;
  requiredFeature?: string;
  minPlan?: PlanType;
}

const overviewItems: MenuItem[] = [
  { titleKey: "sidebar.dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
];

const salesItems: MenuItem[] = [
  { titleKey: "sidebar.leads", url: "/leads", icon: Target, module: "leads" },
  { titleKey: "sidebar.clients", url: "/clients", icon: UserCheck, module: "clients" },
  { titleKey: "sidebar.agents", url: "/agents", icon: UserCog, module: "agents" },
  { titleKey: "sidebar.vendors", url: "/vendors", icon: Store, module: "vendors" },
  { titleKey: "sidebar.quotations", url: "/quotations", icon: FileText, module: "quotations" },
];

const operationItems: MenuItem[] = [
  {
    title: { bn: "প্যাকেজ ও সার্ভিসেস", en: "Packages & Services" },
    url: "/travel-packages",
    icon: Package2,
    module: "packages",
  },
  { titleKey: "sidebar.bookings", url: "/bookings", icon: Plane, module: "bookings" },
  { titleKey: "sidebar.tasks", url: "/tasks", icon: ListTodo, module: "tasks" },
];

const financeItems: MenuItem[] = [
  { titleKey: "sidebar.invoices", url: "/invoices", icon: Receipt, module: "invoices" },
  {
    title: { bn: "পেমেন্টস", en: "Payments" },
    url: "/payments",
    icon: CreditCard,
    module: "invoices",
  },
  { titleKey: "sidebar.accounts", url: "/accounts", icon: Wallet, module: "accounts", minPlan: "basic" },
  { titleKey: "sidebar.reports", url: "/reports", icon: BarChart3, module: "reports", requiredFeature: "hasAdvancedAnalytics", minPlan: "business" },
];

const websiteItems: MenuItem[] = [
  {
    title: { bn: "ওয়েবসাইট সেন্টার", en: "Website Center" },
    url: "/website",
    icon: Globe,
    module: "website",
    requiredFeature: "hasWebsiteTemplates",
    minPlan: "pro",
  },
  {
    title: { bn: "থিম বিল্ডার", en: "Theme Builder" },
    url: "/website/builder",
    icon: Wand2,
    module: "website",
    requiredFeature: "hasWebsiteTemplates",
    minPlan: "pro",
  },
  {
    title: { bn: "পাবলিশ ও ডোমেইন", en: "Publish & Domain" },
    url: "/website/publish",
    icon: UploadCloud,
    module: "website",
    requiredFeature: "hasWebsiteTemplates",
    minPlan: "pro",
  },
];

const managementItems: MenuItem[] = [
  { titleKey: "sidebar.team", url: "/team", icon: Users, module: "team" },
  { titleKey: "sidebar.roles", url: "/roles", icon: UserCog2, module: "team" },
  { titleKey: "sidebar.organization", url: "/organization", icon: Building2, module: "organization" },
  { titleKey: "sidebar.subscription", url: "/subscription", icon: Crown, module: "subscription" },
  { titleKey: "sidebar.notifications", url: "/notifications", icon: Bell, module: "reports" },
  { titleKey: "sidebar.settings", url: "/settings", icon: Settings, module: "settings" },
  { titleKey: "sidebar.userGuide", url: "/user-guide", icon: BookOpen, module: "dashboard" },
];

const planOrder: PlanType[] = ["free", "basic", "pro", "business", "enterprise"];

function isPlanSufficient(minPlan: PlanType | undefined, currentPlan: PlanType): boolean {
  if (!minPlan) return true;
  return planOrder.indexOf(minPlan) <= planOrder.indexOf(currentPlan);
}

function NavGroup({ label, items, collapsed, currentPlan, isBn }: { label: string; items: MenuItem[]; collapsed: boolean; currentPlan: PlanType; isBn: boolean }) {
  const { canAccess } = usePermissions();
  const { t } = useTranslation();

  const visibleItems = items.filter((item) => canAccess(item.module));

  if (visibleItems.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{!collapsed ? label : ""}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => {
            const planOk = isPlanSufficient(item.minPlan, currentPlan);
            const title = item.title ? (isBn ? item.title.bn : item.title.en) : item.titleKey?.includes(".") ? t(item.titleKey) : item.titleKey || "";

            if (!planOk) {
              return (
                <SidebarMenuItem key={`${item.url}-${title}`}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground/50 cursor-not-allowed select-none">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && (
                            <>
                              <span className="flex-1">{title}</span>
                              <Lock className="h-3 w-3" />
                            </>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{t("sidebar.upgradeTo")} {item.minPlan?.charAt(0).toUpperCase()}{item.minPlan?.slice(1)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem key={`${item.url}-${title}`}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end
                    className="hover:bg-sidebar-accent/50"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {!collapsed && <span>{title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout, currentPlan, appRole } = useAuth();
  const { canAccessAdmin } = usePermissions();
  const roleMeta = getRoleMeta(appRole);
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const sectionLabels = {
    overview: isBn ? "সংক্ষিপ্ত বিবরণ" : "Overview",
    sales: isBn ? "সেলস / সিআরএম" : "Sales / CRM",
    operations: isBn ? "সার্ভিস ও অপারেশনস" : "Services & Operations",
    finance: isBn ? "ফাইন্যান্স" : "Finance",
    website: isBn ? "ওয়েবসাইট ও পাবলিশ" : "Website & Publish",
    management: isBn ? "ব্যবস্থাপনা" : "Management",
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-3">
          {!collapsed && <span className="text-sm font-bold tracking-tight">{t("common.brand")}</span>}
        </div>
        <NavGroup label={sectionLabels.overview} items={overviewItems} collapsed={collapsed} currentPlan={currentPlan} isBn={isBn} />
        <NavGroup label={sectionLabels.sales} items={salesItems} collapsed={collapsed} currentPlan={currentPlan} isBn={isBn} />
        <NavGroup label={sectionLabels.operations} items={operationItems} collapsed={collapsed} currentPlan={currentPlan} isBn={isBn} />
        <NavGroup label={sectionLabels.finance} items={financeItems} collapsed={collapsed} currentPlan={currentPlan} isBn={isBn} />
        <NavGroup label={sectionLabels.website} items={websiteItems} collapsed={collapsed} currentPlan={currentPlan} isBn={isBn} />
        <NavGroup label={sectionLabels.management} items={managementItems} collapsed={collapsed} currentPlan={currentPlan} isBn={isBn} />
        {canAccessAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{!collapsed ? t("sidebar.admin") : ""}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" className="hover:bg-sidebar-accent/50 text-destructive" activeClassName="bg-sidebar-accent font-medium">
                      <Shield className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{t("sidebar.adminPanel")}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && user && (
          <div className="px-3 pb-1 space-y-1">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{currentPlan}</Badge>
              <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${roleMeta.color}`}>
                {roleMeta.label}
              </span>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && t("common.logout")}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
