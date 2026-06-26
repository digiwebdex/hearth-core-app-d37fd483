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
    // Hajj/BD operations desks now derive automatically from the selected services.
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
      {/* Brand header */}
      <div className={`flex items-center gap-2 border-b px-3 py-3 shrink-0 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
          H
        </div>
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight truncate">{t("common.brand")}</span>
        )}
      </div>

      <SidebarContent className="gap-0">
        {navigationGroups.map((group) => (
          <AppSidebarNavGroup
            key={group.id}
            group={group}
            collapsed={collapsed}
            currentPlan={currentPlan}
          />
        ))}

        {/* Admin panel */}
        {canAccessAdmin && (
          <SidebarGroup className="py-0.5 px-2">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className="hover:bg-destructive/10 text-destructive"
                      activeClassName="bg-destructive/10 font-medium"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{t("sidebar.adminPanel")}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!collapsed && user && (
          <div className="px-3 pt-2 pb-1 space-y-1">
            <p className="text-xs font-medium truncate">{user.name || user.email}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 pt-0.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{currentPlan}</Badge>
              <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${roleMeta.color}`}>
                {roleMeta.label}
              </span>
            </div>
          </div>
        )}
        <Button variant="ghost" size="sm" className={`w-full ${collapsed ? "justify-center" : "justify-start"}`} onClick={logout}>
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">{t("common.logout")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
