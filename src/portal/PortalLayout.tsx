import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bell, Briefcase, CreditCard, FileText, LayoutDashboard, LifeBuoy, LogOut,
  Menu, Percent, Plane, Settings as SettingsIcon, Stamp, User, X, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clearPortalToken, portalApi, type PortalRole } from "@/lib/portalApi";

interface NavItem { to: string; icon: LucideIcon; label: string; }

function navClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
    isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
  }`;
}

export default function PortalLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: session } = useQuery({ queryKey: ["portal-me"], queryFn: portalApi.me });
  const roles: PortalRole[] = session?.roles || [];
  const isCustomer = roles.includes("customer");

  // Bell badge — reuses the notifications list the customer already reads.
  const { data: notifications } = useQuery({
    queryKey: ["portal-notif-count"],
    queryFn: portalApi.notifications,
    enabled: isCustomer,
    staleTime: 60_000,
  });
  const notifCount = notifications?.length || 0;

  const primaryNav: NavItem[] = [];
  if (isCustomer) {
    primaryNav.push(
      { to: "/dashboard", icon: LayoutDashboard, label: t("portal.dashboard", { defaultValue: "Dashboard" }) },
      { to: "/bookings", icon: Briefcase, label: t("portal.myBookings") },
      { to: "/visa", icon: Stamp, label: t("portal.visa", { defaultValue: "Visa" }) },
      { to: "/payments", icon: CreditCard, label: t("portal.payments", { defaultValue: "Payments" }) },
      { to: "/support", icon: LifeBuoy, label: t("portal.support", { defaultValue: "Support" }) },
    );
  }
  if (roles.includes("agent")) primaryNav.push({ to: "/agent", icon: Percent, label: t("portal.agentNav") });
  if (roles.includes("supplier")) primaryNav.push({ to: "/purchase-orders", icon: FileText, label: t("portal.purchaseOrders") });

  const accountNav: NavItem[] = isCustomer
    ? [
        { to: "/profile", icon: User, label: t("portal.profile", { defaultValue: "Profile" }) },
        { to: "/settings", icon: SettingsIcon, label: t("portal.settings", { defaultValue: "Settings" }) },
      ]
    : [];

  const logout = () => { clearPortalToken(); navigate("/login"); };
  const toggleLang = () => i18n.changeLanguage(i18n.language?.startsWith("bn") ? "en" : "bn");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold shrink-0" onClick={() => setMenuOpen(false)}>
            <Plane className="h-5 w-5 text-primary" />
            <span>{t("portal.title")}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {primaryNav.map((it) => (
              <NavLink key={it.to} to={it.to} className={({ isActive }) => navClass(isActive)}>
                <it.icon className="h-4 w-4" /> {it.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            {isCustomer && (
              <NavLink to="/notifications" className="relative rounded-md p-2 hover:bg-muted" aria-label={t("portal.notifications", { defaultValue: "Notifications" })}>
                <Bell className="h-5 w-5" />
                {notifCount > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]">
                    {notifCount > 9 ? "9+" : notifCount}
                  </Badge>
                )}
              </NavLink>
            )}
            {/* Account (desktop) */}
            {accountNav.map((it) => (
              <NavLink key={it.to} to={it.to} className="hidden rounded-md p-2 hover:bg-muted md:inline-flex" aria-label={it.label} title={it.label}>
                <it.icon className="h-5 w-5" />
              </NavLink>
            ))}
            <Button variant="ghost" size="sm" onClick={toggleLang} className="hidden md:inline-flex">
              {i18n.language?.startsWith("bn") ? "EN" : "বাং"}
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} className="hidden md:inline-flex" aria-label={t("portal.signOut", { defaultValue: "Sign out" })}>
              <LogOut className="h-4 w-4" />
            </Button>
            {/* Mobile toggle */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="border-t border-border bg-card px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {[...primaryNav, ...accountNav].map((it) => (
                <NavLink key={it.to} to={it.to} className={({ isActive }) => navClass(isActive)} onClick={() => setMenuOpen(false)}>
                  <it.icon className="h-4 w-4" /> {it.label}
                </NavLink>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <Button variant="ghost" size="sm" onClick={toggleLang}>
                  {i18n.language?.startsWith("bn") ? "English" : "বাংলা"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setMenuOpen(false); logout(); }}>
                  <LogOut className="mr-2 h-4 w-4" /> {t("portal.signOut", { defaultValue: "Sign out" })}
                </Button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
