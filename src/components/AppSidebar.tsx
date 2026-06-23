import { useEffect } from "react";
import { LogOut, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getRoleMeta } from "@/lib/permissions";
import { getNavigationGroups } from "@/config/navigation";
import { AppSidebarNavGroup } from "@/components/AppSidebarNav";
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout, currentPlan, appRole, tenant } = useAuth();
  const { canAccessAdmin } = usePermissions();
  const roleMeta = getRoleMeta(appRole);
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const navigationGroups = getNavigationGroups({
    enableHajjUmrahModule: tenant?.enableHajjUmrahModule !== false,
    enableBdOperationsModule: tenant?.enableBdOperationsModule === true,
    enabledServiceTypes: tenant?.enabledServiceTypes,
    enabledSubcategories: tenant?.enabledSubcategories,
    showActivityLog: appRole === "tenant_owner" || appRole === "owner" || appRole === "manager",
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = document.querySelector('[data-sidebar="content"]');
      if (!container) return;
      const active =
        container.querySelector('[data-sidebar="menu-button"][data-active="true"]') ??
        container.querySelector('[data-sidebar="menu-sub-button"][data-active="true"]');
      active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-3">
          {!collapsed && <span className="text-sm font-bold tracking-tight">{t("common.brand")}</span>}
        </div>
        {navigationGroups.map((group) => (
          <AppSidebarNavGroup key={group.id} group={group} collapsed={collapsed} currentPlan={currentPlan} />
        ))}
        {canAccessAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{!collapsed ? t("sidebar.admin") : ""}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className="hover:bg-sidebar-accent/50 text-destructive"
                      activeClassName="bg-sidebar-accent font-medium"
                    >
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
