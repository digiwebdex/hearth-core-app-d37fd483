import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Upload, Save, Eye, ImageIcon, GripVertical } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL || "/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function fetchCms(): Promise<LandingCms> {
  const res = await fetch(`${BASE}/landing-cms`);
  if (!res.ok) return defaultCms();
  const data = await res.json();
  return mergeCms(data);
}

async function saveCms(data: LandingCms) {
  const res = await fetch(`${BASE}/landing-cms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Save failed");
}

async function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string;
        const res = await fetch(`${BASE}/landing-cms/upload`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ dataUrl, fileName: file.name }),
        });
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();
        // Prepend API base if relative
        const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/api$/, "");
        resolve(url.startsWith("http") ? url : `${apiBase}${url}`);
      } catch (err) { reject(err); }
    };
    reader.readAsDataURL(file);
  });
}

interface Stat { val: string; label: string; }
interface Step { label: string; sub: string; }
interface Feature { title: string; desc: string; }
interface Testimonial { name: string; role: string; text: string; }
interface FaqItem { q: string; a: string; }

interface LandingCms {
  hero: { badge: string; title1: string; title2: string; subtitle: string; ctaText: string; heroImage?: string; };
  stats: Stat[];
  workflow: { badge: string; title: string; subtitle: string; steps: Step[]; };
  features: { badge: string; title: string; subtitle: string; items: Feature[]; };
  testimonials: { badge: string; title: string; subtitle: string; items: Testimonial[]; };
  faq: { badge: string; title: string; items: FaqItem[]; };
  cta: { title: string; subtitle: string; };
}

function defaultCms(): LandingCms {
  return {
    hero: {
      badge: "🚀 #1 Travel Agency Software in Bangladesh",
      title1: "Run Your Entire Travel Agency",
      title2: "From One Platform",
      subtitle: "From the first phone call to the final boarding pass — manage leads, quotations, bookings, payments and vendors. Start your free trial today.",
      ctaText: "View Pricing & Start",
    },
    stats: [
      { val: "500+", label: "Travel Agencies" },
      { val: "50K+", label: "Bookings Managed" },
      { val: "99.9%", label: "Uptime" },
      { val: "24/7", label: "Support" },
    ],
    workflow: {
      badge: "How It Works",
      title: "From Inquiry to Trip — Simplified",
      subtitle: "A complete workflow that mirrors how travel agencies actually operate.",
      steps: [
        { label: "Capture Lead", sub: "From any source" },
        { label: "Send Quote", sub: "Professional PDF" },
        { label: "Win Client", sub: "Auto-convert" },
        { label: "Book Trip", sub: "All travel types" },
        { label: "Collect Payment", sub: "Multiple methods" },
        { label: "Manage Trip", sub: "Docs & operations" },
      ],
    },
    features: {
      badge: "Features",
      title: "Built for Travel Professionals",
      subtitle: "Every module is designed around how travel agencies actually work — not generic business software.",
      items: [
        { title: "Leads & CRM", desc: "Capture inquiries from any source and convert them into clients" },
        { title: "Quotations", desc: "Build professional travel quotations with PDF export" },
        { title: "Booking Management", desc: "Tours, flights, hotels, and visa bookings" },
        { title: "Invoices & Payments", desc: "Collect installments via bKash, SSLCommerz or bank" },
        { title: "Vendor Management", desc: "Track vendor costs, payables and profitability" },
        { title: "Team & Permissions", desc: "Role-based access for your whole team" },
        { title: "Reports & Analytics", desc: "Sales, leads, payments, vendor and staff reports" },
        { title: "Hajj & Umrah", desc: "Pilgrim management, rooms and installment plans" },
      ],
    },
    testimonials: {
      badge: "Testimonials",
      title: "Trusted by Travel Agencies",
      subtitle: "Hear from agencies already using our platform",
      items: [
        { name: "Rafiq Ahmed", role: "Owner, Al-Baraka Tours", text: "Before this platform, we managed everything on spreadsheets. Now our team handles 3x more bookings with less confusion." },
        { name: "Fatima Begum", role: "Operations Manager, Skyway Travel", text: "The vendor payable tracking is a game changer. Our profit margins are visible in real time." },
        { name: "Kamal Hossain", role: "Director, Noor Hajj Services", text: "The Hajj/Umrah module is exactly what we needed. Managing 500+ pilgrims is finally simple." },
      ],
    },
    faq: {
      badge: "FAQ",
      title: "Common Questions",
      items: [
        { q: "Who is this platform for?", a: "Travel agencies, tour operators, ticketing offices and Hajj/Umrah service providers." },
        { q: "What plans do you offer?", a: "Four simple plans — Starter, Professional, Business and Enterprise." },
        { q: "Do I need technical skills?", a: "No. If you can use WhatsApp, you can use our platform." },
        { q: "Can I change my plan later?", a: "Yes — upgrade or downgrade anytime from your dashboard." },
      ],
    },
    cta: {
      title: "Ready to Modernize Your Travel Agency?",
      subtitle: "Join hundreds of travel agencies already using our platform.",
    },
  };
}

function mergeCms(data: Partial<LandingCms>): LandingCms {
  const d = defaultCms();
  return {
    hero: { ...d.hero, ...data.hero },
    stats: data.stats?.length ? data.stats : d.stats,
    workflow: { ...d.workflow, ...data.workflow, steps: data.workflow?.steps?.length ? data.workflow.steps : d.workflow.steps },
    features: { ...d.features, ...data.features, items: data.features?.items?.length ? data.features.items : d.features.items },
    testimonials: { ...d.testimonials, ...data.testimonials, items: data.testimonials?.items?.length ? data.testimonials.items : d.testimonials.items },
    faq: { ...d.faq, ...data.faq, items: data.faq?.items?.length ? data.faq.items : d.faq.items },
    cta: { ...d.cta, ...data.cta },
  };
}

function Field({ label, value, onChange, multiline = false, placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {multiline
        ? <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="resize-none text-sm" rows={3} />
        : <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />}
    </div>
  );
}

function ImageUploader({ label, value, onChange }: { label: string; value?: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handle = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
      toast({ title: "Image uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-start gap-3">
        <div className="w-32 h-20 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
          {value ? <img src={value} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="h-6 w-6 text-muted-foreground/50" />}
        </div>
        <div className="space-y-2 flex-1">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}Upload
          </Button>
          <Input placeholder="Or paste image URL" value={value || ""} onChange={(e) => onChange(e.target.value)} className="text-xs" />
        </div>
      </div>
    </div>
  );
}

export default function AdminLandingCMS() {
  const [cms, setCms] = useState<LandingCms>(defaultCms());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCms().then((data) => { setCms(data); setLoading(false); });
  }, []);

  const update = (section: keyof LandingCms, key: string, value: unknown) => {
    setCms((prev) => ({ ...prev, [section]: { ...(prev[section] as object), [key]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCms(cms);
      toast({ title: "Saved", description: "Landing page updated. Changes are live." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <AdminLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Landing Page CMS</h1>
            <p className="text-sm text-muted-foreground mt-1">Edit content for <span className="font-medium text-foreground">travelagencyweb.com</span></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open("/", "_blank")}>
              <Eye className="mr-2 h-4 w-4" />Preview
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save & Publish
            </Button>
          </div>
        </div>

        <Tabs defaultValue="hero">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="cta">CTA</TabsTrigger>
          </TabsList>

          {/* ─── HERO ─── */}
          <TabsContent value="hero" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle>Hero Section</CardTitle><CardDescription>The first thing visitors see at the top of the page.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Badge text" value={cms.hero.badge} onChange={(v) => update("hero", "badge", v)} placeholder="🚀 #1 Travel Agency Software..." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Title line 1" value={cms.hero.title1} onChange={(v) => update("hero", "title1", v)} />
                  <Field label="Title line 2 (gradient)" value={cms.hero.title2} onChange={(v) => update("hero", "title2", v)} />
                </div>
                <Field label="Subtitle" value={cms.hero.subtitle} onChange={(v) => update("hero", "subtitle", v)} multiline placeholder="Describe the platform briefly..." />
                <Field label="Primary CTA button text" value={cms.hero.ctaText} onChange={(v) => update("hero", "ctaText", v)} />
                <Separator />
                <ImageUploader label="Hero background image (optional)" value={cms.hero.heroImage} onChange={(v) => update("hero", "heroImage", v)} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── STATS ─── */}
          <TabsContent value="stats" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Stats Bar</CardTitle><CardDescription>Numbers shown below the hero section.</CardDescription></div>
                  <Button size="sm" variant="outline" onClick={() => setCms((p) => ({ ...p, stats: [...p.stats, { val: "0", label: "New Stat" }] }))}>
                    <Plus className="mr-2 h-3 w-3" />Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {cms.stats.map((s, i) => (
                  <div key={i} className="flex gap-3 items-end">
                    <div className="flex-1 grid gap-3 sm:grid-cols-2">
                      <Field label={`Stat ${i + 1} value`} value={s.val} onChange={(v) => { const n = [...cms.stats]; n[i] = { ...n[i], val: v }; setCms((p) => ({ ...p, stats: n })); }} />
                      <Field label="Label" value={s.label} onChange={(v) => { const n = [...cms.stats]; n[i] = { ...n[i], label: v }; setCms((p) => ({ ...p, stats: n })); }} />
                    </div>
                    {cms.stats.length > 1 && (
                      <Button size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive" onClick={() => setCms((p) => ({ ...p, stats: p.stats.filter((_, j) => j !== i) }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── WORKFLOW ─── */}
          <TabsContent value="workflow" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle>Workflow Section</CardTitle><CardDescription>"How It Works" numbered steps.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Badge" value={cms.workflow.badge} onChange={(v) => update("workflow", "badge", v)} />
                  <Field label="Title" value={cms.workflow.title} onChange={(v) => update("workflow", "title", v)} />
                  <Field label="Subtitle" value={cms.workflow.subtitle} onChange={(v) => update("workflow", "subtitle", v)} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Steps</Label>
                  {cms.workflow.steps.map((step, i) => (
                    <div key={i} className="flex gap-3 items-center p-3 rounded-lg border bg-muted/20">
                      <span className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <div className="flex-1 grid gap-2 sm:grid-cols-2">
                        <Input value={step.label} onChange={(e) => { const n = [...cms.workflow.steps]; n[i] = { ...n[i], label: e.target.value }; update("workflow", "steps", n); }} placeholder="Step name" className="text-sm" />
                        <Input value={step.sub} onChange={(e) => { const n = [...cms.workflow.steps]; n[i] = { ...n[i], sub: e.target.value }; update("workflow", "steps", n); }} placeholder="Sub-label" className="text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── FEATURES ─── */}
          <TabsContent value="features" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Features Section</CardTitle><CardDescription>Feature cards grid.</CardDescription></div>
                  <Button size="sm" variant="outline" onClick={() => setCms((p) => ({ ...p, features: { ...p.features, items: [...p.features.items, { title: "New Feature", desc: "Feature description" }] } }))}>
                    <Plus className="mr-2 h-3 w-3" />Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Badge" value={cms.features.badge} onChange={(v) => update("features", "badge", v)} />
                  <Field label="Title" value={cms.features.title} onChange={(v) => update("features", "title", v)} />
                  <Field label="Subtitle" value={cms.features.subtitle} onChange={(v) => update("features", "subtitle", v)} />
                </div>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2">
                  {cms.features.items.map((f, i) => (
                    <div key={i} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">Card {i + 1}</Badge>
                        {cms.features.items.length > 1 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setCms((p) => ({ ...p, features: { ...p.features, items: p.features.items.filter((_, j) => j !== i) } }))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Input value={f.title} onChange={(e) => { const n = [...cms.features.items]; n[i] = { ...n[i], title: e.target.value }; update("features", "items", n); }} placeholder="Feature title" className="text-sm" />
                      <Textarea value={f.desc} onChange={(e) => { const n = [...cms.features.items]; n[i] = { ...n[i], desc: e.target.value }; update("features", "items", n); }} placeholder="Description" className="text-sm resize-none" rows={2} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TESTIMONIALS ─── */}
          <TabsContent value="testimonials" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Testimonials</CardTitle><CardDescription>Customer quotes displayed on the landing page.</CardDescription></div>
                  <Button size="sm" variant="outline" onClick={() => setCms((p) => ({ ...p, testimonials: { ...p.testimonials, items: [...p.testimonials.items, { name: "", role: "", text: "" }] } }))}>
                    <Plus className="mr-2 h-3 w-3" />Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Badge" value={cms.testimonials.badge} onChange={(v) => update("testimonials", "badge", v)} />
                  <Field label="Section title" value={cms.testimonials.title} onChange={(v) => update("testimonials", "title", v)} />
                  <Field label="Subtitle" value={cms.testimonials.subtitle} onChange={(v) => update("testimonials", "subtitle", v)} />
                </div>
                <Separator />
                {cms.testimonials.items.map((tm, i) => (
                  <div key={i} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Testimonial {i + 1}</span>
                      {cms.testimonials.items.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setCms((p) => ({ ...p, testimonials: { ...p.testimonials, items: p.testimonials.items.filter((_, j) => j !== i) } }))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name" value={tm.name} onChange={(v) => { const n = [...cms.testimonials.items]; n[i] = { ...n[i], name: v }; update("testimonials", "items", n); }} />
                      <Field label="Role / Company" value={tm.role} onChange={(v) => { const n = [...cms.testimonials.items]; n[i] = { ...n[i], role: v }; update("testimonials", "items", n); }} />
                    </div>
                    <Field label="Quote" value={tm.text} onChange={(v) => { const n = [...cms.testimonials.items]; n[i] = { ...n[i], text: v }; update("testimonials", "items", n); }} multiline />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── FAQ ─── */}
          <TabsContent value="faq" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>FAQ</CardTitle><CardDescription>Frequently asked questions.</CardDescription></div>
                  <Button size="sm" variant="outline" onClick={() => setCms((p) => ({ ...p, faq: { ...p.faq, items: [...p.faq.items, { q: "", a: "" }] } }))}>
                    <Plus className="mr-2 h-3 w-3" />Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Badge" value={cms.faq.badge} onChange={(v) => update("faq", "badge", v)} />
                  <Field label="Section title" value={cms.faq.title} onChange={(v) => update("faq", "title", v)} />
                </div>
                <Separator />
                {cms.faq.items.map((item, i) => (
                  <div key={i} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Q{i + 1}</span>
                      {cms.faq.items.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setCms((p) => ({ ...p, faq: { ...p.faq, items: p.faq.items.filter((_, j) => j !== i) } }))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Field label="Question" value={item.q} onChange={(v) => { const n = [...cms.faq.items]; n[i] = { ...n[i], q: v }; update("faq", "items", n); }} />
                    <Field label="Answer" value={item.a} onChange={(v) => { const n = [...cms.faq.items]; n[i] = { ...n[i], a: v }; update("faq", "items", n); }} multiline />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── CTA ─── */}
          <TabsContent value="cta" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle>Final CTA Section</CardTitle><CardDescription>The closing call-to-action at the bottom of the page.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Title" value={cms.cta.title} onChange={(v) => update("cta", "title", v)} />
                <Field label="Subtitle" value={cms.cta.subtitle} onChange={(v) => update("cta", "subtitle", v)} multiline />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sticky save bar */}
        <div className="sticky bottom-6 flex justify-end">
          <Button onClick={save} disabled={saving} className="shadow-xl bg-amber-500 hover:bg-amber-600 text-white px-8">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save & Publish
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
