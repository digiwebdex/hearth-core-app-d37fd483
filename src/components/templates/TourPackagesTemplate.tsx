import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebsite } from "@/contexts/WebsiteContext";
import { resolveButtons, type WebsiteConfig } from "@/lib/websiteApi";
import {
  Mountain, Palmtree, Building, Camera, Plane, MapPin, Star, Shield, Hotel,
  ChevronDown, Quote, CheckCircle2, ArrowRight,
  MessageCircle, Globe, Users, Heart, Award,
} from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, React.ElementType> = {
  Mountain, Palmtree, Building, Camera, Plane, MapPin, Star, Shield, Hotel,
  Users, Globe, Award, Heart, CheckCircle2,
};

export default function TourPackagesTemplate({ config }: { config: WebsiteConfig }) {
  const { tenant, packages } = useWebsite();
  const featured = packages.slice(0, 6);
  const c = config.colors;
  const btn = resolveButtons(config);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ backgroundColor: `hsl(${c.background})`, color: `hsl(${c.text})` }}>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, hsl(${c.primary} / 0.08), hsl(${c.accent} / 0.08))` }} />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              {config.content.heroBadge && (
                <Badge className="mb-4 px-4 py-1.5 text-sm font-medium border-0" style={{ backgroundColor: `hsl(${c.accent} / 0.15)`, color: `hsl(${c.accent})` }}>
                  {config.content.heroBadge}
                </Badge>
              )}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight">{config.content.heroTitle}</h1>
              <p className="text-lg max-w-xl mb-8 opacity-70 leading-relaxed">{config.content.heroSubtitle}</p>
              <div className="flex gap-3 flex-wrap">
                <Link to="/site/packages">
                  <Button size="lg" className="gap-2" style={{ backgroundColor: `hsl(${btn.primaryBg})`, color: `hsl(${btn.primaryText})` }}>Explore Tours <ArrowRight className="h-4 w-4" /></Button>
                </Link>
                <Link to="/site/contact">
                  <Button size="lg" variant="outline" style={{ borderColor: `hsl(${btn.outline})`, color: `hsl(${btn.outline})` }}>Plan My Trip</Button>
                </Link>
              </div>
              {config.socialLinks && (
                <div className="flex items-center gap-3 mt-6">
                  <span className="text-sm opacity-50">Follow us:</span>
                  {config.socialLinks.facebook && <a href={config.socialLinks.facebook} target="_blank" rel="noreferrer" className="opacity-50 hover:opacity-100 transition-opacity text-xs font-semibold border rounded-full w-8 h-8 flex items-center justify-center">f</a>}
                  {config.socialLinks.instagram && <a href={config.socialLinks.instagram} target="_blank" rel="noreferrer" className="opacity-50 hover:opacity-100 transition-opacity text-xs font-semibold border rounded-full w-8 h-8 flex items-center justify-center">ig</a>}
                  {config.socialLinks.youtube && <a href={config.socialLinks.youtube} target="_blank" rel="noreferrer" className="opacity-50 hover:opacity-100 transition-opacity text-xs font-semibold border rounded-full w-8 h-8 flex items-center justify-center">yt</a>}
                </div>
              )}
            </div>
            <div className="relative">
              {config.content.heroImage ? (
                <img src={config.content.heroImage} alt="Hero" className="rounded-2xl shadow-2xl w-full object-cover max-h-[450px]" />
              ) : (
                <div className="rounded-2xl h-[350px] md:h-[450px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${c.primary} / 0.15), hsl(${c.accent} / 0.15))` }}>
                  <Mountain className="h-24 w-24" style={{ color: `hsl(${c.primary} / 0.3)` }} />
                </div>
              )}
              {config.content.stats && config.content.stats.length > 0 && (
                <div className="absolute -bottom-6 left-4 right-4 bg-white/95 backdrop-blur rounded-xl shadow-xl p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    {config.content.stats.slice(0, 4).map((stat, i) => (
                      <div key={i}>
                        <div className="text-xl md:text-2xl font-bold" style={{ color: `hsl(${c.primary})` }}>{stat.value}</div>
                        <div className="text-xs opacity-60">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-20" style={{ backgroundColor: `hsl(${c.secondary})` }}>
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              {config.content.aboutImage ? (
                <img src={config.content.aboutImage} alt="About" className="rounded-2xl shadow-lg w-full object-cover max-h-[400px]" />
              ) : (
                <div className="rounded-2xl h-[350px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${c.primary} / 0.1), hsl(${c.accent} / 0.1))` }}>
                  <Globe className="h-20 w-20" style={{ color: `hsl(${c.primary} / 0.3)` }} />
                </div>
              )}
            </div>
            <div>
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>About Us</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6">{config.content.aboutTitle}</h2>
              <p className="opacity-70 leading-relaxed mb-6">{config.content.aboutText}</p>
              {config.content.stats && (
                <div className="grid grid-cols-2 gap-4">
                  {config.content.stats.slice(0, 4).map((stat, i) => (
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
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>What We Offer</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2">Our Services</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {config.content.services.map((s, i) => {
              const Icon = iconMap[s.icon] || Mountain;
              return (
                <Card key={i} className="text-center hover:shadow-lg transition-all hover:-translate-y-1 border-none shadow-md">
                  <CardContent className="pt-8 pb-6">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${c.primary}), hsl(${c.accent}))` }}>
                      <Icon className="h-8 w-8 text-white" />
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
        <section className="py-20" style={{ backgroundColor: `hsl(${c.secondary})` }}>
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>Popular Tours</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">Featured Tours</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((pkg) => (
                <Card key={pkg.id} className="overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className="h-48 flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, hsl(${c.primary} / 0.1), hsl(${c.accent} / 0.1))` }}>
                    {pkg.image ? <img src={pkg.image} alt={pkg.name} className="w-full h-full object-cover" /> : <Mountain className="h-16 w-16" style={{ color: `hsl(${c.primary} / 0.3)` }} />}
                    <Badge className="absolute top-3 left-3 border-0" style={{ backgroundColor: `hsl(${c.accent})`, color: "white" }}>{pkg.type}</Badge>
                  </div>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{pkg.name}</h3>
                      <span className="text-xs opacity-60 whitespace-nowrap ml-2">{pkg.duration}</span>
                    </div>
                    <p className="text-sm opacity-60 mb-3 line-clamp-2">{pkg.description}</p>
                    {pkg.highlights && pkg.highlights.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {pkg.highlights.slice(0, 3).map((h, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `hsl(${c.primary} / 0.1)`, color: `hsl(${c.primary})` }}>{h}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-xl font-bold" style={{ color: `hsl(${c.primary})` }}>৳{pkg.price.toLocaleString()}</span>
                      <Link to="/site/contact"><Button size="sm" className="gap-1" style={{ backgroundColor: `hsl(${btn.secondaryBg})`, color: `hsl(${btn.secondaryText})` }}>Book Now <ArrowRight className="h-3 w-3" /></Button></Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/site/packages"><Button variant="outline" size="lg" style={{ borderColor: `hsl(${btn.outline})`, color: `hsl(${btn.outline})` }}>View All Tours <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            </div>
          </div>
        </section>
      )}

      {/* Why Choose Us */}
      {config.content.whyChooseUs && config.content.whyChooseUs.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>Why Us</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">Why Choose Us</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {config.content.whyChooseUs.map((item, i) => (
                <div key={i} className="flex gap-4 p-5 rounded-xl" style={{ backgroundColor: `hsl(${c.primary} / 0.03)` }}>
                  <CheckCircle2 className="h-6 w-6 mt-0.5 flex-shrink-0" style={{ color: `hsl(${c.primary})` }} />
                  <div>
                    <h3 className="font-bold mb-1">{item.title}</h3>
                    <p className="text-sm opacity-60">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {config.content.testimonials && config.content.testimonials.length > 0 && (
        <section className="py-20" style={{ backgroundColor: `hsl(${c.secondary})` }}>
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>Testimonials</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">What Our Travelers Say</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {config.content.testimonials.map((t, i) => (
                <Card key={i} className="border-none shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <Quote className="h-8 w-8 mb-3" style={{ color: `hsl(${c.primary} / 0.3)` }} />
                    <p className="opacity-70 mb-4 italic leading-relaxed">"{t.text}"</p>
                    <div className="flex items-center gap-3 pt-3 border-t">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: `hsl(${c.primary})` }}>{t.name.charAt(0)}</div>
                      <div>
                        <div className="font-semibold text-sm">{t.name}</div>
                        {t.date && <div className="text-xs opacity-50">{t.date}</div>}
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
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>Our Team</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">Meet The Team</h2>
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
        <section className="py-20" style={{ backgroundColor: `hsl(${c.secondary})` }}>
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: `hsl(${c.primary})` }}>FAQ</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {config.content.faq.map((item, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button className="w-full text-left p-5 font-semibold flex justify-between items-center gap-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{item.question}</span>
                    <ChevronDown className={`h-5 w-5 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} style={{ color: `hsl(${c.primary})` }} />
                  </button>
                  {openFaq === i && <div className="px-5 pb-5 text-sm opacity-70 leading-relaxed border-t pt-4">{item.answer}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {config.content.ctaTitle && (
        <section className="py-20" style={{ background: `linear-gradient(135deg, hsl(${c.primary}), hsl(${c.accent}))` }}>
          <div className="container mx-auto px-4 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{config.content.ctaTitle}</h2>
            {config.content.ctaSubtitle && <p className="text-lg opacity-80 mb-8 max-w-2xl mx-auto">{config.content.ctaSubtitle}</p>}
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to="/site/packages"><Button size="lg" className="bg-white hover:bg-gray-100 gap-2" style={{ color: `hsl(${c.primary})` }}>Browse Tours <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/site/contact"><Button size="lg" variant="outline" className="hover:bg-white/10" style={{ borderColor: `hsl(${btn.contact})`, color: `hsl(${btn.contact})` }}>Contact Us</Button></Link>
            </div>
            {config.socialLinks?.whatsapp && (
              <a href={config.socialLinks.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-6 text-white/80 hover:text-white transition-colors text-sm">
                <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
