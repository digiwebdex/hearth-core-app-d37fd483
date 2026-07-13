import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Plane, Phone, Mail, MapPin, ArrowUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface Props {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

const BRAND = "TravelAgencyWeb";
const BRAND_FULL = "Travel Agency Website & Software Solution";
const DOMAIN = "travelagencyweb.com";
const PUBLISHED_DOMAIN = "travelagencyweb.com";

const MarketingLayout = ({ children, title, description }: Props) => {
  const location = useLocation();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Features", path: "/features" },
    { label: "Pricing", path: "/pricing" },
    { label: "About", path: "/about" },
    { label: "Contact", path: "/contact-us" },
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
        const el = document.querySelector(sel);
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
    return () => { document.title = `${BRAND_FULL} — Complete Travel Agency Management`; };
  }, [title, description, location.pathname]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              <Plane className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Travel<span className="text-primary">Agency</span>Web
            </span>
          </Link>

          {/* Desktop */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                  isActive(link.path)
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher className="text-slate-600 hover:text-slate-900" />
            <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              Log in
            </Link>
            <Link to="/register">
              <Button size="sm" className="shadow-sm shadow-primary/30">
                Start Free Trial
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden text-slate-700" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pb-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive(link.path) ? "bg-primary/10 text-primary" : "text-slate-600"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="py-2.5"><LanguageSwitcher className="text-slate-600" /></div>
            <Link to="/login" className="block py-2 text-sm font-medium text-slate-700">Log in</Link>
            <Link to="/register" className="block pt-2">
              <Button size="sm" className="w-full">Start Free Trial</Button>
            </Link>
          </div>
        )}
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Plane className="h-5 w-5" />
                </span>
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  Travel<span className="text-primary">Agency</span>Web
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Run your entire travel agency from one platform — tours, visas, air tickets, hotels,
                accounting, Hajj &amp; Umrah, in English and Bangla.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-slate-900">Product</h4>
              <div className="space-y-2.5 text-sm text-slate-500">
                <Link to="/features" className="block hover:text-primary">Features</Link>
                <Link to="/pricing" className="block hover:text-primary">Pricing</Link>
                <Link to="/demo" className="block hover:text-primary">Book a Demo</Link>
                <Link to="/faq" className="block hover:text-primary">FAQ</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-slate-900">Company</h4>
              <div className="space-y-2.5 text-sm text-slate-500">
                <Link to="/about" className="block hover:text-primary">About</Link>
                <Link to="/contact-us" className="block hover:text-primary">Contact Us</Link>
                <Link to="/privacy" className="block hover:text-primary">Privacy Policy</Link>
                <Link to="/terms" className="block hover:text-primary">Terms of Service</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-slate-900">Contact</h4>
              <div className="space-y-3 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>+880 1674-533303</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>support@travelagencyweb.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Dhaka, Bangladesh</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} {BRAND}. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-400">
              <Link to="/privacy" className="hover:text-primary">Privacy</Link>
              <Link to="/terms" className="hover:text-primary">Terms</Link>
              <Link to="/contact-us" className="hover:text-primary">Support</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href="https://wa.me/8801674533303"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105"
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
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default MarketingLayout;
