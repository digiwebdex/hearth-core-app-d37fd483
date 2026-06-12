import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Briefcase, FileText, LogOut, Percent, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearPortalToken, portalApi, type PortalRole } from "@/lib/portalApi";

function navClass(isActive: boolean) {
  return `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
    isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
  }`;
}

export default function PortalLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = useQuery({
    queryKey: ["portal-me"],
    queryFn: portalApi.me,
  });
  const roles: PortalRole[] = session?.roles || [];

  const logout = () => {
    clearPortalToken();
    navigate("/login");
  };

  const toggleLang = () => {
    const next = i18n.language?.startsWith("bn") ? "en" : "bn";
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Plane className="h-5 w-5 text-primary" />
            <span>{t("portal.title")}</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {roles.includes("customer") && (
              <NavLink to="/bookings" className={({ isActive }) => navClass(isActive)}>
                <Briefcase className="h-4 w-4" /> {t("portal.myBookings")}
              </NavLink>
            )}
            {roles.includes("agent") && (
              <NavLink to="/agent" className={({ isActive }) => navClass(isActive)}>
                <Percent className="h-4 w-4" /> {t("portal.agentNav")}
              </NavLink>
            )}
            {roles.includes("supplier") && (
              <NavLink to="/purchase-orders" className={({ isActive }) => navClass(isActive)}>
                <FileText className="h-4 w-4" /> {t("portal.purchaseOrders")}
              </NavLink>
            )}
            <Button variant="ghost" size="sm" onClick={toggleLang}>
              {i18n.language?.startsWith("bn") ? "EN" : "বাং"}
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
