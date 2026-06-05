import { useState, useMemo } from "react";
import PublicLayout from "@/components/PublicLayout";
import { useWebsite } from "@/contexts/WebsiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Plane, Search, Check, Pencil, Settings } from "lucide-react";

const typeLabels: Record<string, string> = {
  tour: "Tour",
  "domestic tour": "Domestic Tour",
  "international tour": "International Tour",
  ticket: "Ticket",
  "air ticket": "Air Ticket",
  hotel: "Hotel",
  visa: "Visa",
  transport: "Transport",
  hajj: "Hajj",
  umrah: "Umrah",
  "hajj / umrah": "Hajj / Umrah",
  custom: "Custom",
};

const SitePackages = () => {
  const { packages, websiteConfig } = useWebsite();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<string>("all");

  const types = useMemo(() => {
    const set = new Set(packages.map((p) => p.type));
    return ["all", ...Array.from(set)];
  }, [packages]);

  const filtered = useMemo(() => {
    return packages.filter((p) => {
      const matchType = activeType === "all" || p.type === activeType;
      const haystack = `${p.name} ${p.description} ${p.highlights.join(" ")}`.toLowerCase();
      const matchSearch = haystack.includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [packages, activeType, search]);

  const pageTitle = websiteConfig.content.packagePageTitle || websiteConfig.content.packagesTitle || "Our Packages";
  const pageSubtitle = websiteConfig.content.packagePageSubtitle || websiteConfig.content.packagesSubtitle || "Browse our curated travel packages for every budget and destination.";
  const primaryButtonText = websiteConfig.content.packagePrimaryButtonText || "Book Now";

  return (
    <PublicLayout>
      <section className="bg-primary/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">{pageTitle}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{pageSubtitle}</p>
          {user && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/travel-packages">
                <Button>
                  <Pencil className="mr-2 h-4 w-4" />
                  Manage packages
                </Button>
              </Link>
              <Link to="/website">
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  Edit package section
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="py-10">
        <div className="container mx-auto px-4">
          {user && (
            <div className="mb-6 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              Package data is edited from the dashboard package manager. This public page shows published travel packages and active Hajj/Umrah packages for visitors.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search packages…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {types.map((t) => (
                <Button
                  key={t}
                  variant={activeType === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveType(t)}
                  className="capitalize"
                >
                  {t === "all" ? "All" : typeLabels[t] || t}
                </Button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-4">
              <p>No packages found.</p>
              {user && (
                <Link to="/travel-packages">
                  <Button>
                    <Pencil className="mr-2 h-4 w-4" />
                    Add your first package
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((pkg) => (
                <Card key={pkg.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                  <div className="h-44 bg-primary/10 flex items-center justify-center overflow-hidden">
                    {pkg.image ? (
                      <img src={pkg.image} alt={pkg.name} className="w-full h-full object-cover" />
                    ) : (
                      <Plane className="h-14 w-14 text-primary/30" />
                    )}
                  </div>
                  <CardContent className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <Badge variant="secondary" className="capitalize">{typeLabels[pkg.type] || pkg.type}</Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{pkg.duration}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-1">{pkg.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 flex-1">{pkg.description}</p>
                    {pkg.highlights.length > 0 && (
                      <ul className="space-y-1 mb-4">
                        {pkg.highlights.map((h) => (
                          <li key={h} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-green-600 shrink-0" />
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xl font-bold text-primary">৳{pkg.price.toLocaleString()}</span>
                      <Link to="/site/contact"><Button size="sm">{primaryButtonText}</Button></Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
};

export default SitePackages;
