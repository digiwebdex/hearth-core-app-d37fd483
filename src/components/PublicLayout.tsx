import { Link, useLocation } from "react-router-dom";
import { useWebsite } from "@/contexts/WebsiteContext";
import { Menu, X, Plane } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import SiteFloatingButtons from "@/components/site/SiteFloatingButtons";

const previewNavLinks = [
  { label: "Home", path: "/site" },
  { label: "About", path: "/site/about" },
  { label: "Packages", path: "/site/packages" },
  { label: "Blog", path: "/site/blog" },
  { label: "Pricing", path: "/site/pricing" },
  { label: "Contact", path: "/site/contact" },
];

const tenantNavLinks = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about" },
  { label: "Packages", path: "/packages" },
  { label: "Blog", path: "/blog" },
  { label: "Contact", path: "/contact" },
];

const PublicLayout = ({ children }: { children: React.ReactNode }) => {
  const { tenant, domainResolution } = useWebsite();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isTenantHost = domainResolution?.type === "slug" || domainResolution?.type === "custom-domain";
  const navLinks = isTenantHost ? tenantNavLinks : previewNavLinks;
  const homePath = isTenantHost ? "/" : "/site";
  const loginHref = isTenantHost && import.meta.env.VITE_APP_DOMAIN
    ? `https://app.${import.meta.env.VITE_APP_DOMAIN}/login`
    : "/login";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to={homePath} className="flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">{tenant.name}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === link.path ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a href={loginHref}>
              <Button size="sm">Login</Button>
            </a>
          </nav>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {menuOpen && (
          <div className="md:hidden border-t bg-card px-4 pb-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className={`block py-2 text-sm font-medium ${
                  location.pathname === link.path ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a href={loginHref} onClick={() => setMenuOpen(false)}>
              <Button size="sm" className="mt-2 w-full">Login</Button>
            </a>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="font-bold mb-2 flex items-center gap-2"><Plane className="h-4 w-4 text-primary" />{tenant.name}</h3>
              <p className="text-sm text-muted-foreground">{tenant.description?.slice(0, 120)}…</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Quick Links</h4>
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link key={link.path} to={link.path} className="block text-sm text-muted-foreground hover:text-primary">{link.label}</Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Contact</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                {tenant.phone && <p>📞 {tenant.phone}</p>}
                {tenant.email && <p>✉️ {tenant.email}</p>}
                {tenant.address && <p>📍 {tenant.address}</p>}
              </div>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} {tenant.name}. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Floating support + back-to-top buttons */}
      <SiteFloatingButtons />
    </div>
  );
};

export default PublicLayout;
