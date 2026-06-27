import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebsite } from "@/contexts/WebsiteContext";
import type { WebsiteConfig } from "@/lib/websiteApi";
import {
  Moon, Star, Plane, Shield, MapPin, Hotel, ChevronDown, Quote,
  Phone, Mail, Clock, Users, Globe, Award, Heart, CheckCircle2,
  ArrowRight, MessageCircle,
} from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, React.ElementType> = {
  Moon, Star, Plane, Shield, MapPin, Hotel, Phone, Mail, Clock,
  Users, Globe, Award, Heart, CheckCircle2,
};

export default function HajjUmrahTemplate({ config }: { config: WebsiteConfig }) {
  const { tenant, packages } = useWebsite();
  const featured = packages.slice(0, 6);
  const c = config.colors;
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ backgroundColor: `hsl(${c.background})`, color: `hsl(${c.text})` }}>
      {/* Hero — Full-bleed banner */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center" style={{ color: "white" }}>
        {/* Background image */}
        {config.content.heroImage ? (
          <div className="absolute inset-0">
            <img src={config.content.heroImage} alt="Banner" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.25) 100%)" }} />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(160 30% 8%), hsl(160 20% 15%))" }} />
        )}
        {/* Decorative gold line */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, hsl(${c.accent}), transparent)` }} />
        <div className="container mx-auto px-4 py-24 md:py-36 relative z-10">
          <div className="max-w-3xl">
            {config.content.heroBadge && (
              <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border text-sm font-semibold backdrop-blur-sm" style={{ borderColor: `hsl(${c.accent} / 0.5)`, backgroundColor: `hsl(${c.accent} / 0.12)`, color: `hsl(${c.accent})` }}>
                {config.content.heroBadge}
              </div>
            )}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1] drop-shadow-lg">
              {config.content.heroTitle}
            </h1>
            <p className="text-xl md:text-2xl max-w-2xl mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.80)" }}>{config.content.heroSubtitle}</p>
            <div className="flex gap-4 flex-wrap mb-12">
              <Link to="/site/packages">
                <Button size="lg" className="gap-2 h-14 px-8 text-base font-semibold shadow-xl hover:scale-105 transition-transform" style={{ backgroundColor: `hsl(${c.accent})`, color: "hsl(160 30% 8%)" }}>
                  সব প্যাকেজ দেখুন <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/site/contact">
                <Button size="lg" variant="outline" className="h-14 px-8 text-base font-semibold border-2 hover:bg-white/10 transition-all" style={{ borderColor: "rgba(255,255,255,0.4)", color: "white" }}>
                  <Phone className="h-4 w-4 mr-2" /> যোগাযোগ করুন
                </Button>
              </Link>
            </div>
            {/* Stats bar */}
            {config.content.stats && config.content.stats.length > 0 && (
              <div className="flex flex-wrap gap-6">
                {config.content.stats.map((stat, i) => (
                  <div key={i} className="text-center backdrop-blur-sm rounded-xl px-5 py-3 border" style={{ borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.08)" }}>
                    <div className="text-2xl font-extrabold" style={{ color: `hsl(${c.accent})` }}>{stat.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
            {config.socialLinks && (
              <div className="flex items-center gap-3 mt-8">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.40)" }}>Follow:</span>
                {config.socialLinks.facebook && <a href={config.socialLinks.facebook} target="_blank" rel="noreferrer" className="hover:opacity-100 transition-opacity text-xs font-semibold border border-white/20 rounded-full w-9 h-9 flex items-center justify-center backdrop-blur-sm" style={{ opacity: 0.55, backgroundColor: "rgba(255,255,255,0.08)" }}>f</a>}
                {config.socialLinks.instagram && <a href={config.socialLinks.instagram} target="_blank" rel="noreferrer" className="hover:opacity-100 transition-opacity text-xs font-semibold border border-white/20 rounded-full w-9 h-9 flex items-center justify-center backdrop-blur-sm" style={{ opacity: 0.55, backgroundColor: "rgba(255,255,255,0.08)" }}>ig</a>}
                {config.socialLinks.youtube && <a href={config.socialLinks.youtube} target="_blank" rel="noreferrer" className="hover:opacity-100 transition-opacity text-xs font-semibold border border-white/20 rounded-full w-9 h-9 flex items-center justify-center backdrop-blur-sm" style={{ opacity: 0.55, backgroundColor: "rgba(255,255,255,0.08)" }}>yt</a>}
                {config.socialLinks.whatsapp && <a href={config.socialLinks.whatsapp} target="_blank" rel="noreferrer" className="hover:opacity-100 transition-opacity text-xs font-semibold border border-white/20 rounded-full w-9 h-9 flex items-center justify-center backdrop-blur-sm" style={{ opacity: 0.55, backgroundColor: "rgba(255,255,255,0.08)" }}>wa</a>}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              {config.content.aboutImage ? (
                <img src={config.content.aboutImage} alt="About" className="rounded-2xl shadow-lg w-full object-cover max-h-[400px]" />
              ) : (
                <div className="rounded-2xl h-[350px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${c.primary} / 0.1), hsl(${c.accent} / 0.1))` }}>
                  <Moon className="h-20 w-20" style={{ color: `hsl(${c.primary} / 0.3)` }} />
                </div>
              )}
            </div>
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>আমাদের সম্পর্কে</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6">{config.content.aboutTitle}</h2>
              <p className="opacity-70 leading-relaxed mb-6">{config.content.aboutText}</p>
              {config.content.stats && (
                <div className="grid grid-cols-2 gap-4">
                  {config.content.stats.map((stat, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ backgroundColor: `hsl(${c.primary} / 0.05)` }}>
                      <div className="text-2xl font-bold" style={{ color: `hsl(${c.primary})` }}>{stat.value}</div>
                      <div className="text-sm opacity-60">{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20" style={{ backgroundColor: `hsl(${c.secondary})` }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>আমাদের সেবা</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2">Our Services</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {config.content.services.map((s, i) => {
              const Icon = iconMap[s.icon] || Moon;
              return (
                <Card key={i} className="text-center hover:shadow-lg transition-all hover:-translate-y-1 border-none shadow-md">
                  <CardContent className="pt-8 pb-6">
                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `hsl(${c.primary} / 0.1)` }}>
                      <Icon className="h-8 w-8" style={{ color: `hsl(${c.primary})` }} />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                    <p className="text-sm opacity-60 leading-relaxed">{s.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Packages */}
      {featured.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Badge className="mb-3 px-4 py-1.5 text-sm border-0" style={{ backgroundColor: `hsl(${c.primary} / 0.1)`, color: `hsl(${c.primary})` }}>
                {config.content.packagesBadge || "আমাদের প্যাকেজ"}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">{config.content.packagesTitle || "Featured Packages"}</h2>
              {config.content.packagesSubtitle && <p className="mt-2 opacity-60">{config.content.packagesSubtitle}</p>}
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((pkg) => (
                <Card key={pkg.id} className="overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group border-0 shadow-md">
                  <div className="h-52 flex items-center justify-center relative overflow-hidden">
                    {pkg.image ? (
                      <>
                        <img src={pkg.image} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)" }} />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${c.primary} / 0.15), hsl(${c.accent} / 0.15))` }}>
                        <Moon className="h-16 w-16" style={{ color: `hsl(${c.primary} / 0.3)` }} />
                      </div>
                    )}
                    <Badge className="absolute top-3 left-3 border-0 shadow-md" style={{ backgroundColor: `hsl(${c.accent})`, color: "hsl(160 30% 8%)" }}>{pkg.type}</Badge>
                    {pkg.duration && (
                      <span className="absolute top-3 right-3 text-xs font-semibold bg-black/50 text-white px-2 py-1 rounded-full backdrop-blur-sm">{pkg.duration}</span>
                    )}
                    {pkg.price > 0 && (
                      <div className="absolute bottom-3 left-3">
                        <span className="text-lg font-extrabold text-white drop-shadow-lg">৳{pkg.price.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <h3 className="font-bold text-base mb-1 line-clamp-1">{pkg.name}</h3>
                    <p className="text-sm opacity-60 mb-4 line-clamp-2 leading-relaxed">{pkg.description}</p>
                    {pkg.highlights && pkg.highlights.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {pkg.highlights.slice(0, 3).map((h, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `hsl(${c.primary} / 0.08)`, color: `hsl(${c.primary})` }}>{h}</span>
                        ))}
                      </div>
                    )}
                    <Link to="/site/contact" className="block">
                      <Button className="w-full gap-2 font-semibold" style={{ backgroundColor: `hsl(${c.primary})`, color: "white" }}>
                        {config.content.packagePrimaryButtonText || "Book Now"} <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/site/packages">
                <Button variant="outline" size="lg" style={{ borderColor: `hsl(${c.primary})`, color: `hsl(${c.primary})` }}>
                  {config.content.packageSecondaryButtonText || "View All Packages"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Why Choose Us */}
      {config.content.whyChooseUs && config.content.whyChooseUs.length > 0 && (
        <section className="py-20" style={{ backgroundColor: `hsl(${c.secondary})` }}>
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>কেন আমাদের বেছে নেবেন</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">Why Choose Us</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {config.content.whyChooseUs.map((item, i) => (
                <div key={i} className="flex gap-3 p-5 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: `hsl(${c.primary})` }} />
                  <span className="font-medium text-sm leading-relaxed">{typeof item === "string" ? item : item.title}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {config.content.testimonials && config.content.testimonials.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>প্রশংসাপত্র</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">What Our Pilgrims Say</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {config.content.testimonials.map((t, i) => (
                <Card key={i} className="border-none shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: t.rating || 5 }).map((_, si) => (
                        <Star key={si} className="h-4 w-4 fill-current" style={{ color: `hsl(${c.accent})` }} />
                      ))}
                    </div>
                    <p className="opacity-75 mb-4 italic leading-relaxed text-sm">"{t.text}"</p>
                    <div className="flex items-center gap-3 pt-3 border-t">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: `hsl(${c.primary})` }}>
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{t.name}</div>
                        {t.role && <div className="text-xs opacity-50">{t.role}</div>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Team */}
      {config.content.team && config.content.team.length > 0 && (
        <section className="py-20" style={{ backgroundColor: `hsl(${c.secondary})` }}>
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>আমাদের টিম</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">Our Team</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {config.content.team.map((member, i) => (
                <Card key={i} className="text-center hover:shadow-lg transition-shadow border-none shadow-md">
                  <CardContent className="pt-8 pb-6">
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: `hsl(${c.primary})` }}>
                      {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <h3 className="font-bold text-lg">{member.name}</h3>
                    <p className="text-sm font-medium mb-2" style={{ color: `hsl(${c.primary})` }}>{member.role}</p>
                    {member.desc && <p className="text-sm opacity-60">{member.desc}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {config.content.faq && config.content.faq.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>সচরাচর জিজ্ঞাসা</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {config.content.faq.map((item, i) => (
                <div key={i} className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: `hsl(${c.secondary})` }}>
                  <button
                    className="w-full text-left p-5 font-semibold flex justify-between items-center gap-4 hover:opacity-80 transition-opacity"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span>{item.question}</span>
                    <ChevronDown className={`h-5 w-5 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} style={{ color: `hsl(${c.primary})` }} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-sm opacity-70 leading-relaxed border-t pt-4">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {config.content.ctaTitle && (
        <section className="py-20" style={{ backgroundColor: "hsl(160 30% 8%)", color: "white" }}>
          <div className="container mx-auto px-4 text-center">
            <Moon className="h-12 w-12 mx-auto mb-6" style={{ color: `hsl(${c.accent})` }} />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{config.content.ctaTitle}</h2>
            {config.content.ctaSubtitle && <p className="text-lg opacity-60 mb-8 max-w-2xl mx-auto">{config.content.ctaSubtitle}</p>}
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to="/site/packages">
                <Button size="lg" className="gap-2" style={{ backgroundColor: `hsl(${c.primary})`, color: "white" }}>
                  Browse Packages <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/site/contact">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Contact Us
                </Button>
              </Link>
            </div>
            {config.socialLinks?.whatsapp && (
              <a href={config.socialLinks.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-6 text-white/60 hover:text-white transition-colors text-sm">
                <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
