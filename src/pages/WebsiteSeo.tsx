import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, ExternalLink, Globe, Search, FileText } from "lucide-react";
import { tenantApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function WebsiteSeo() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [tenantSlug, setTenantSlug] = useState("");

  const [form, setForm] = useState({
    siteTitle: "",
    siteDescription: "",
    siteKeywords: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    googleVerification: "",
    bingVerification: "",
  });

  useEffect(() => {
    tenantApi.get().then((t) => {
      setTenantSlug(t.slug || "");
      // Parse SEO settings from notes if stored there, or use defaults
      try {
        const notes = JSON.parse((t as unknown as { notes?: string }).notes || "{}");
        if (notes.seo) setForm({ ...form, ...notes.seo });
      } catch {}
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      // Store SEO settings as JSON in tenant notes under a "seo" key
      const current = await tenantApi.get();
      let notes: Record<string, unknown> = {};
      try { notes = JSON.parse((current as unknown as { notes?: string }).notes || "{}"); } catch {}
      notes.seo = form;
      await tenantApi.update({ notes: JSON.stringify(notes) } as Parameters<typeof tenantApi.update>[0]);
      toast({ title: "SEO settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  }

  const sitemapUrl = tenantSlug ? `${import.meta.env.VITE_API_URL || ""}/public/sitemap/${tenantSlug}` : "";

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Website SEO Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">Configure meta tags, sitemap, and search engine settings</p>
          </div>
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />{saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <Tabs defaultValue="meta">
          <TabsList>
            <TabsTrigger value="meta"><Search className="w-4 h-4 mr-1.5" />Meta Tags</TabsTrigger>
            <TabsTrigger value="social"><Globe className="w-4 h-4 mr-1.5" />Social / OG</TabsTrigger>
            <TabsTrigger value="sitemap"><FileText className="w-4 h-4 mr-1.5" />Sitemap</TabsTrigger>
          </TabsList>

          <TabsContent value="meta" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Search Engine Meta Tags</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Site Title</Label>
                  <Input value={form.siteTitle} onChange={(e) => setForm({ ...form, siteTitle: e.target.value })} placeholder="Your Agency Name — Best Travel Agency in Bangladesh" />
                  <p className="text-xs text-muted-foreground">Shown as browser tab title and in Google results. Aim for 50–60 characters.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Site Description</Label>
                  <Textarea rows={3} value={form.siteDescription} onChange={(e) => setForm({ ...form, siteDescription: e.target.value })} placeholder="We offer the best Hajj, Umrah, and international tour packages..." />
                  <p className="text-xs text-muted-foreground">Shown under your URL in Google. Aim for 150–160 characters.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Keywords (comma-separated)</Label>
                  <Input value={form.siteKeywords} onChange={(e) => setForm({ ...form, siteKeywords: e.target.value })} placeholder="travel agency, hajj package, umrah package, tour bangladesh" />
                </div>
                <div className="space-y-1.5">
                  <Label>Google Site Verification (optional)</Label>
                  <Input value={form.googleVerification} onChange={(e) => setForm({ ...form, googleVerification: e.target.value })} placeholder="Google Search Console verification token" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bing Webmaster Verification (optional)</Label>
                  <Input value={form.bingVerification} onChange={(e) => setForm({ ...form, bingVerification: e.target.value })} placeholder="Bing Webmaster verification token" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Open Graph (Facebook, WhatsApp, LinkedIn Share Preview)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>OG Title</Label>
                  <Input value={form.ogTitle} onChange={(e) => setForm({ ...form, ogTitle: e.target.value })} placeholder="Title shown when your link is shared on social media" />
                </div>
                <div className="space-y-1.5">
                  <Label>OG Description</Label>
                  <Textarea rows={3} value={form.ogDescription} onChange={(e) => setForm({ ...form, ogDescription: e.target.value })} placeholder="Description shown in social media link previews" />
                </div>
                <div className="space-y-1.5">
                  <Label>OG Image URL</Label>
                  <Input value={form.ogImage} onChange={(e) => setForm({ ...form, ogImage: e.target.value })} placeholder="https://... (1200×630px recommended)" />
                  <p className="text-xs text-muted-foreground">This image appears when your homepage link is shared. Must be a public URL.</p>
                </div>
                {form.ogImage && (
                  <div className="rounded-lg border overflow-hidden w-full max-w-xs">
                    <img src={form.ogImage} alt="OG preview" className="w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sitemap" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Auto-Generated Sitemap</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Your sitemap is automatically generated from all published packages and blog posts. Submit it to Google Search Console to speed up indexing.</p>
                {tenantSlug ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/40 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Sitemap URL</p>
                        <p className="text-sm font-mono">{sitemapUrl}</p>
                      </div>
                      <a href={sitemapUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open</Button>
                      </a>
                    </div>
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium">Submit to Google</p>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Go to <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-primary underline">Google Search Console</a></li>
                        <li>Select your property (add it if not yet)</li>
                        <li>Go to Sitemaps in the left menu</li>
                        <li>Paste: <code className="bg-muted px-1 rounded text-xs">{sitemapUrl}</code></li>
                        <li>Click Submit</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <Badge variant="secondary">Configure your tenant slug first in Organization Settings</Badge>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
