import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Mail, MapPin, ArrowUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import logoImg from "@/assets/logo-icon.png";

interface Props {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

const BRAND = "Travel Agency Website & Software Solution";
const BRAND_SHORT = "TAWSS";
const DOMAIN = "travelagencyweb.com";
const PUBLISHED_DOMAIN = "travelagencyweb.com";

const MarketingLayout = ({ children, title, description }: Props) => {
  const location = useLocation();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const navLinks = [
    { label: t("nav.features"), path: "/features" },
    { label: t("nav.solutions", { defaultValue: "Solutions" }), path: "/solutions" },
    { label: t("nav.modules", { defaultValue: "Modules" }), path: "/modules" },
    { label: t("nav.pricing"), path: "/pricing" },
    { label: t("nav.faq"), path: "/faq" },
    { label: t("nav.contact"), path: "/contact-us" },
  ];

  useEffect(() => {
    if (title) document.title = title;
    const pageUrl = `https://${DOMAIN}${location.pathname === "/" ? "" : location.pathname}`;
    const ogImage = `https://${PUBLISHED_DOMAIN}/images/og-share-v2.png`;
    if (description) {
      const setMeta = (sel: string, attr: string, val: string) => {
        let el = document.querySelector(sel);
        if (!el) { el = document.createElement("meta"); const a = sel.match(/\[(\w+)="([^"]+)"\]/); if (a) el.setAttribute(a[1], a[2]); document.head.appendChild(el); }
        el.setAttribute(attr, val);
      };
      setMeta('meta[name="description"]', "content", description);
      setMeta('meta[property="og:description"]', "content", description);
      setMeta('meta[name="twitter:description"]', "content", description);
    }
    if (title) {
      const setMeta = (sel: string, attr: string, val: string) => {
        let el = document.querySelector(sel);
        if (el) el.setAttribute(attr, val);
      };
      setMeta('meta[property="og:title"]', "content", title);
      setMeta('meta[name="twitter:title"]', "content", title);
    }
    const updateAttr = (sel: string, attr: string, val: string) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
    updateAttr('link[rel="canonical"]', "href", pageUrl);
    updateAttr('meta[property="og:url"]', "content", pageUrl);
    updateAttr('meta[property="og:image"]', "content", ogImage);
    updateAttr('meta[name="twitter:image"]', "content", ogImage);
    return () => { document.title = `${BRAND} — Complete Travel Agency Management`; };
  }, [title, description, location.pathname]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0c1222] text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0c1222]/95 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImg} alt={BRAND} className="h-10 w-10 object-contain" />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-sm font-bold text-white tracking-wide">Travel Agency</span>
              <span className="text-[10px] text-white/50 tracking-wider uppercase">Website & Software Solution</span>
            </div>
          </Link>

          {/* Desktop */}
          <nav className="hidden md:flex items-center gap-7 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`transition-colors hover:text-white ${
                  location.pathname === link.path ? "text-amber-400 font-medium" : "text-white/55"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <LanguageSwitcher className="text-white/70 hover:text-white" />
            <Link to="/pricing">
              <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                {t("common.getStarted")}
              </Button>
            </Link>
          </nav>

          {/* Mobile toggle */}
          <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/8 bg-[#0c1222] px-4 pb-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`block py-2.5 text-sm ${
                  location.pathname === link.path ? "text-amber-400 font-medium" : "text-white/55"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="py-2.5"><LanguageSwitcher className="text-white/70" /></div>
            <Link to="/pricing" className="block py-2.5">
              <Button size="sm" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">{t("common.getStarted")}</Button>
            </Link>
          </div>
        )}
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-white/8 pt-16 pb-8 bg-[#080e1a]">
        <div className="container mx-auto px-4">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={logoImg} alt={BRAND} className="h-10 w-10 object-contain" />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-bold text-white tracking-wide">Travel Agency</span>
                  <span className="text-[10px] text-white/50 tracking-wider uppercase">Website & Software Solution</span>
                </div>
              </div>
              <p className="text-sm text-white/35 leading-relaxed">
                {BRAND}. From inquiry to trip completion — manage leads, quotations, bookings, invoices, and vendors in one place.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white/90">Product</h4>
              <div className="space-y-2.5 text-sm text-white/35">
                <Link to="/features" className="block hover:text-white/60">Features</Link>
                <Link to="/solutions" className="block hover:text-white/60">Solutions</Link>
                <Link to="/modules" className="block hover:text-white/60">Modules</Link>
                <Link to="/pricing" className="block hover:text-white/60">Pricing</Link>
                <Link to="/demo" className="block hover:text-white/60">Book a Demo</Link>
                <Link to="/faq" className="block hover:text-white/60">FAQ</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white/90">Company</h4>
              <div className="space-y-2.5 text-sm text-white/35">
                <Link to="/contact-us" className="block hover:text-white/60">Contact Us</Link>
                <Link to="/privacy" className="block hover:text-white/60">Privacy Policy</Link>
                <Link to="/terms" className="block hover:text-white/60">Terms of Service</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white/90">Contact</h4>
              <div className="space-y-3 text-sm text-white/35">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-amber-400/50" />
                  <span>+880 1234-567890</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-amber-400/50" />
                  <span>support@travelagencyweb.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-400/50" />
                  <span>Dhaka, Bangladesh</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-white/8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/25">
              © {new Date().getFullYear()} {BRAND}. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-white/25">
              <Link to="/privacy" className="hover:text-white/45">Privacy</Link>
              <Link to="/terms" className="hover:text-white/45">Terms</Link>
              <Link to="/contact-us" className="hover:text-white/45">Support</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href="https://wa.me/8801674533303"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg shadow-black/30 transition-transform hover:scale-105"
        aria-label="Chat on WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="text-sm font-semibold">WhatsApp</span>
      </a>

      {/* Back to Top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-black/30 transition-transform hover:scale-105"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default MarketingLayout;
