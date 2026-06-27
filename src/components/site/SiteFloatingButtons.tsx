import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle } from "lucide-react";
import { useWebsite } from "@/contexts/WebsiteContext";
import { resolveButtons } from "@/lib/websiteApi";

// Normalize a WhatsApp value (raw number or wa.me link) into a chat URL.
function buildWhatsAppHref(raw?: string, phone?: string): string | null {
  const value = (raw || "").trim();
  if (value) {
    if (value.startsWith("http")) return value;
    const digits = value.replace(/[^\d]/g, "");
    if (digits) return `https://wa.me/${digits}`;
  }
  const phoneDigits = (phone || "").replace(/[^\d]/g, "");
  return phoneDigits ? `https://wa.me/${phoneDigits}` : null;
}

const SiteFloatingButtons = () => {
  const { websiteConfig, tenant } = useWebsite();
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const btn = resolveButtons(websiteConfig);
  const waHref = buildWhatsAppHref(websiteConfig.socialLinks?.whatsapp, websiteConfig.contactInfo?.phone || tenant?.phone);

  return (
    <>
      {/* Left-side WhatsApp support button */}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat on WhatsApp"
          className="fixed left-4 bottom-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-white shadow-xl transition-transform hover:scale-105"
          style={{ backgroundColor: `hsl(${btn.whatsapp})` }}
        >
          <MessageCircle className="h-6 w-6" />
          <span className="hidden sm:inline text-sm font-semibold pr-1">Chat with us</span>
        </a>
      )}

      {/* Back-to-top button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed right-4 bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 hover:scale-105 ${
          showTop ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ backgroundColor: `hsl(${btn.backToTop})` }}
      >
        <ArrowUp className="h-6 w-6" />
      </button>
    </>
  );
};

export default SiteFloatingButtons;
