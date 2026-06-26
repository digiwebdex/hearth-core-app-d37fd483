import { useEffect, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { usePermissions } from "@/hooks/usePermissions";
import type { PlanType } from "@/lib/plans";
import type { Module } from "@/lib/permissions";
import type { NavGroupConfig, NavItemConfig } from "@/config/navigation";
import { navGroupHasActiveItem, navItemIsActive } from "@/lib/navActive";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const planOrder: PlanType[] = ["free", "basic", "pro", "business", "enterprise"];

function isPlanSufficient(minPlan: PlanType | undefined, currentPlan: PlanType): boolean {
  if (!minPlan) return true;
  return planOrder.indexOf(minPlan) <= planOrder.indexOf(currentPlan);
}

function pathMatches(url: string, pathname: string): boolean {
  return navItemIsActive(url, pathname);
}

function itemOrChildActive(item: NavItemConfig, pathname: string): boolean {
  if (item.url && pathMatches(item.url, pathname)) return true;
  return item.children?.some((child) => child.url && pathMatches(child.url, pathname)) ?? false;
}

// ── Locked item row ──────────────────────────────────────────────────────────
function LockedNavRow({ item, title, collapsed, minPlan }: { item: NavItemConfig; title: string; collapsed: boolean; minPlan?: PlanType }) {
  const { t } = useTranslation();
  return (
    <SidebarMenuItem>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground/40 cursor-not-allowed select-none rounded-md">
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-xs">{title}</span>
                  <Lock className="h-3 w-3 shrink-0" />
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{t("sidebar.upgradeTo")} {minPlan?.charAt(0).toUpperCase()}{minPlan?.slice(1)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </SidebarMenuItem>
  );
}

// ── Leaf nav item (no children) ───────────────────────────────────────────────
function SidebarNavLeaf({ item, title, collapsed, pathname, sub = false }: { item: NavItemConfig; title: string; collapsed: boolean; pathname: string; sub?: boolean }) {
  if (!item.url) return null;
  const activeMatcher = (path: string) => navItemIsActive(item.url!, path);

  if (sub) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild data-active={activeMatcher(pathname) ? true : undefined}>
          <NavLink
            to={item.url}
            end
            isActiveOverride={activeMatcher}
            className="hover:bg-sidebar-accent/50"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            <span>{title}</span>
          </NavLink>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton asChild data-active={activeMatcher(pathname) ? true : undefined}>
                <NavLink
                  to={item.url}
                  end
                  isActiveOverride={activeMatcher}
                  className="hover:bg-sidebar-accent/50 justify-center"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                >
                  <item.icon className="h-4 w-4" />
                </NavLink>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right">{title}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild data-active={activeMatcher(pathname) ? true : undefined}>
        <NavLink
          to={item.url}
          end
          isActiveOverride={activeMatcher}
          className="hover:bg-sidebar-accent/50"
          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ── Individual nav item (may have nested children) ────────────────────────────
function SidebarNavItem({ item, collapsed, currentPlan, pathname }: { item: NavItemConfig; collapsed: boolean; currentPlan: PlanType; pathname: string }) {
  const { t } = useTranslation();
  const title = t(item.titleKey);
  const planOk = isPlanSufficient(item.minPlan, currentPlan);
  const hasChildren = Boolean(item.children?.length);
  const childActive = hasChildren ? itemOrChildActive(item, pathname) : false;
  const [expanded, setExpanded] = useState(childActive);

  useEffect(() => {
    if (childActive) setExpanded(true);
  }, [childActive]);

  if (!planOk) {
    return <LockedNavRow item={item} title={title} collapsed={collapsed} minPlan={item.minPlan} />;
  }

  if (hasChildren && item.children) {
    if (collapsed) {
      return (
        <>
          {item.children.map((child) => (
            <SidebarNavItem key={child.id} item={child} collapsed={collapsed} currentPlan={currentPlan} pathname={pathname} />
          ))}
        </>
      );
    }

    return (
      <Collapsible open={expanded} onOpenChange={setExpanded} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="hover:bg-sidebar-accent/50">
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{title}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child) => {
                const childPlanOk = isPlanSufficient(child.minPlan, currentPlan);
                const childTitle = t(child.titleKey);
                if (!childPlanOk) {
                  return (
                    <SidebarMenuSubItem key={child.id}>
                      <div className="flex h-7 items-center gap-2 px-2 text-xs text-muted-foreground/40">
                        <child.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{childTitle}</span>
                        <Lock className="h-3 w-3 shrink-0" />
                      </div>
                    </SidebarMenuSubItem>
                  );
                }
                return <SidebarNavLeaf key={child.id} item={child} title={childTitle} collapsed={collapsed} pathname={pathname} sub />;
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return <SidebarNavLeaf item={item} title={title} collapsed={collapsed} pathname={pathname} />;
}

function filterVisibleItems(items: NavItemConfig[], canAccess: (module: Module) => boolean): NavItemConfig[] {
  return items
    .map((item) => {
      if (!canAccess(item.module)) return null;
      if (item.children) {
        const children = item.children.filter((c) => canAccess(c.module));
        if (children.length === 0) return null;
        return { ...item, children };
      }
      return item;
    })
    .filter(Boolean) as NavItemConfig[];
}

// ── Group rendered as a collapsible section ───────────────────────────────────
export function AppSidebarNavGroup({ group, collapsed, currentPlan }: { group: NavGroupConfig; collapsed: boolean; currentPlan: PlanType }) {
  const { t } = useTranslation();
  const { canAccess } = usePermissions();
  const { pathname } = useLocation();

  const visibleItems = filterVisibleItems(group.items, canAccess);
  if (visibleItems.length === 0) return null;

  const groupActive = navGroupHasActiveItem(visibleItems, pathname);
  const [open, setOpen] = useState(groupActive);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  const GroupIcon = group.icon;

  // ── Icon-only (collapsed sidebar) — show icons without group header ──────
  if (collapsed) {
    return (
      <SidebarGroup className="py-0.5">
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleItems.map((item) => (
              <SidebarNavItem key={item.id} item={item} collapsed={collapsed} currentPlan={currentPlan} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // ── Expanded sidebar — group header is the collapse toggle ────────────────
  const label = t(group.labelKey);

  return (
    <SidebarGroup className="py-0.5 px-2">
      <Collapsible open={open} onOpenChange={setOpen} className="group/section">
        {/* Group header row */}
        <CollapsibleTrigger asChild>
          <button
            className={`
              w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider
              transition-colors duration-150 cursor-pointer select-none
              ${groupActive
                ? "text-primary bg-primary/8"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40"
              }
            `}
          >
            <GroupIcon className={`h-3.5 w-3.5 shrink-0 ${groupActive ? "text-primary" : ""}`} />
            <span className="flex-1 truncate text-left">{label}</span>
            <ChevronRight
              className={`h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/section:rotate-90 ${groupActive ? "text-primary" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        {/* Group items */}
        <CollapsibleContent>
          <SidebarGroupContent className="pt-0.5 pb-1">
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarNavItem key={item.id} item={item} collapsed={collapsed} currentPlan={currentPlan} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}
