import { useState } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import type { PlanType, PlanConfig } from "@/lib/plans";
import type { Module } from "@/lib/permissions";
import type { ServiceType } from "@/lib/serviceTypes";
import type { NavGroupConfig, NavItemConfig } from "@/config/navigation";
import { navItemIsActive } from "@/lib/navActive";
import { isNavItemModuleEnabled } from "@/lib/moduleAccess";
import { isServiceTypeEnabled, normalizeEnabledServiceTypes } from "@/lib/enabledServiceTypes";
import { UpgradePlanDialog, type LockReason } from "@/components/UpgradePlanDialog";
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

function titleFor(item: NavItemConfig, t: (k: string) => string): string {
  return item.titleKey ? t(item.titleKey) : item.title ?? item.id;
}

function planLabel(p?: PlanType | null): string | null {
  if (!p) return null;
  return p.charAt(0).toUpperCase() + p.slice(1);
}

// ── Lock resolution (config-driven; no hardcoded plan/permission logic) ──────
interface LockInfo {
  locked: boolean;
  reason?: LockReason;
  requiredPlan?: PlanType | null;
}

/**
 * Resolve whether an item is LOCKED (shown greyed with 🔒 + upgrade), given the
 * tenant's plan, enabled advanced modules, and enabled service focus. RBAC is
 * handled separately (it hides). Order: plan floor → feature flag → service
 * focus → advanced-module bundle.
 */
function resolveLock(
  item: NavItemConfig,
  currentPlan: PlanType,
  enabledModules: string[] | null | undefined,
  serviceEnabled: (type: ServiceType) => boolean,
  access: ReturnType<typeof usePlanAccess>,
): LockInfo {
  if (!isPlanSufficient(item.minPlan, currentPlan)) {
    return { locked: true, reason: "plan", requiredPlan: item.minPlan ?? null };
  }
  if (item.requiredFeature && !access.hasFeature(item.requiredFeature as keyof PlanConfig)) {
    return { locked: true, reason: "feature", requiredPlan: access.getUpgradePlan(item.requiredFeature as keyof PlanConfig) };
  }
  if (item.requiredServiceTypes?.length && !item.requiredServiceTypes.some((s) => serviceEnabled(s))) {
    return { locked: true, reason: "service", requiredPlan: null };
  }
  if (!isNavItemModuleEnabled(item.id, currentPlan, enabledModules)) {
    return { locked: true, reason: "module", requiredPlan: "business" };
  }
  return { locked: false };
}

// ── Locked item row (🔒 + upgrade badge + tooltip + click → upgrade dialog) ──
function LockedNavRow({ item, title, lock }: { item: NavItemConfig; title: string; lock: LockInfo }) {
  const [open, setOpen] = useState(false);
  const label = planLabel(lock.requiredPlan);
  const tooltip =
    lock.reason === "service"
      ? `${title} isn't enabled for your agency — click to enable or upgrade`
      : `This feature is available in the ${label ?? "a higher"} plan.`;

  return (
    <SidebarMenuItem>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-muted-foreground/50 transition-colors hover:bg-muted/40 hover:text-muted-foreground"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-sm">{title}</span>
              {label && lock.reason !== "service" && (
                <span className="rounded-sm bg-primary/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                  {label}
                </span>
              )}
              <Lock className="h-3 w-3 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <UpgradePlanDialog
        open={open}
        onOpenChange={setOpen}
        moduleName={title}
        requiredPlanLabel={label}
        reason={lock.reason ?? "plan"}
      />
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
          className="hover:bg-primary/15 hover:text-primary rounded-md transition-colors text-sm text-foreground/80"
          activeClassName="bg-primary text-white font-bold shadow-md border-l-4 border-white/40"
        >
          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-muted-foreground"}`} />
          <span className="truncate">{title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ── Nav item ─────────────────────────────────────────────────────────────────
function SidebarNavItem({
  item,
  currentPlan,
  enabledModules,
  serviceEnabled,
  access,
  pathname,
}: {
  item: NavItemConfig;
  currentPlan: PlanType;
  enabledModules?: string[] | null;
  serviceEnabled: (type: ServiceType) => boolean;
  access: ReturnType<typeof usePlanAccess>;
  pathname: string;
}) {
  const { t } = useTranslation();
  const title = titleFor(item, t);
  const lock = resolveLock(item, currentPlan, enabledModules, serviceEnabled, access);

  if (lock.locked) return <LockedNavRow item={item} title={title} lock={lock} />;
  return <SidebarNavLeaf item={item} title={title} pathname={pathname} />;
}

// ── Group — always expanded, label is a plain section header ─────────────────
export function AppSidebarNavGroup({
  group,
  currentPlan,
  enabledModules,
  enabledServiceTypes,
  enabledSubcategories,
}: {
  group: NavGroupConfig;
  currentPlan: PlanType;
  enabledModules?: string[] | null;
  enabledServiceTypes?: string[] | null;
  enabledSubcategories?: string[] | null;
}) {
  const { t } = useTranslation();
  const { canAccess } = usePermissions();
  const { pathname } = useLocation();
  const access = usePlanAccess(currentPlan);

  // RBAC is the only gate that HIDES an item; everything else shows it locked.
  const visibleItems = group.items.filter((item) => canAccess(item.module));
  if (visibleItems.length === 0) return null;

  const normalizedTypes = normalizeEnabledServiceTypes(enabledServiceTypes);
  const serviceEnabled = (type: ServiceType) => isServiceTypeEnabled(type, normalizedTypes, enabledSubcategories);

  const GroupIcon = group.icon;
  const label = group.labelKey ? t(group.labelKey) : group.label ?? group.id;

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
            <SidebarNavItem
              key={item.id}
              item={item}
              currentPlan={currentPlan}
              enabledModules={enabledModules}
              serviceEnabled={serviceEnabled}
              access={access}
              pathname={pathname}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
