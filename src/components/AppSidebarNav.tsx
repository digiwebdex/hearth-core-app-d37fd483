import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { usePermissions } from "@/hooks/usePermissions";
import type { PlanType } from "@/lib/plans";
import type { Module } from "@/lib/permissions";
import type { NavGroupConfig, NavItemConfig } from "@/config/navigation";
import { navItemIsActive } from "@/lib/navActive";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const planOrder: PlanType[] = ["free", "basic", "pro", "business", "enterprise"];

function isPlanSufficient(minPlan: PlanType | undefined, currentPlan: PlanType): boolean {
  if (!minPlan) return true;
  return planOrder.indexOf(minPlan) <= planOrder.indexOf(currentPlan);
}

// ── Locked item row ──────────────────────────────────────────────────────────
function LockedNavRow({ item, title, minPlan }: { item: NavItemConfig; title: string; minPlan?: PlanType }) {
  const { t } = useTranslation();
  return (
    <SidebarMenuItem>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground/40 cursor-not-allowed select-none rounded-md">
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-xs">{title}</span>
              <Lock className="h-3 w-3 shrink-0" />
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

// ── Single nav item (leaf — no children) ─────────────────────────────────────
function SidebarNavLeaf({ item, title, pathname }: { item: NavItemConfig; title: string; pathname: string }) {
  if (!item.url) return null;
  const activeMatcher = (path: string) => navItemIsActive(item.url!, path);
  const isActive = activeMatcher(pathname);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild data-active={isActive ? true : undefined}>
        <NavLink
          to={item.url}
          end
          isActiveOverride={activeMatcher}
          className="hover:bg-primary/8 hover:text-primary rounded-md transition-colors"
          activeClassName="bg-primary/12 text-primary font-semibold"
        >
          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
          <span className="truncate">{title}</span>
          {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ── Nav item ─────────────────────────────────────────────────────────────────
function SidebarNavItem({ item, currentPlan, pathname }: { item: NavItemConfig; currentPlan: PlanType; pathname: string }) {
  const { t } = useTranslation();
  const title = t(item.titleKey);
  const planOk = isPlanSufficient(item.minPlan, currentPlan);

  if (!planOk) return <LockedNavRow item={item} title={title} minPlan={item.minPlan} />;
  return <SidebarNavLeaf item={item} title={title} pathname={pathname} />;
}

function filterVisibleItems(items: NavItemConfig[], canAccess: (module: Module) => boolean): NavItemConfig[] {
  return items.filter((item) => canAccess(item.module));
}

// ── Group — always expanded, label is a plain section header ─────────────────
export function AppSidebarNavGroup({ group, currentPlan }: { group: NavGroupConfig; currentPlan: PlanType }) {
  const { t } = useTranslation();
  const { canAccess } = usePermissions();
  const { pathname } = useLocation();

  const visibleItems = filterVisibleItems(group.items, canAccess);
  if (visibleItems.length === 0) return null;

  const GroupIcon = group.icon;
  const label = t(group.labelKey);

  return (
    <SidebarGroup className="py-0 px-2 mt-1">
      {/* Section label — not clickable, just a visual divider */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <GroupIcon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 truncate">
          {label}
        </span>
      </div>

      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => (
            <SidebarNavItem key={item.id} item={item} currentPlan={currentPlan} pathname={pathname} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
