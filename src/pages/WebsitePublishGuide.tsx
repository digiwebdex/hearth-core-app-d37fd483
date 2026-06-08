import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { tenantDomainApi, type TenantDomainRecord, type TenantDomainSummary } from "@/lib/tenantDomainApi";
import { CheckCircle2, Copy, ExternalLink, Globe, Loader2, Plus, ShieldCheck, Star, Trash2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const WebsitePublishGuide = () => {
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
  const [summary, setSummary] = useState<TenantDomainSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [domainForm, setDomainForm] = useState({ domain: "", wwwRedirect: "www-to-root" as "www-to-root" | "root-to-www" });

  const text = {
    title: isBn ? "পাবলিশ ও ডোমেইন" : "Publish & Domain",
    subtitle: isBn ? "আপনার লাইভ ওয়েবসাইট URL, package publish flow এবং domain status এখানে দেখুন।" : "View your live website URL, package publish flow, and domain status here.",
    defaultUrl: isBn ? "ডিফল্ট লাইভ URL" : "Default live URL",
    primaryDomain: isBn ? "প্রাইমারি লাইভ ডোমেইন" : "Primary live domain",
    websiteBuilder: isBn ? "ওয়েবসাইট বিল্ডার" : "Website Builder",
    packagesServices: isBn ? "প্যাকেজ ও সার্ভিসেস" : "Packages & Services",
    publicPackages: isBn ? "পাবলিক প্যাকেজ পেজ" : "Public Packages Page",
    connectedDomains: isBn ? "যুক্ত ডোমেইন" : "Connected domains",
    noDomains: isBn ? "এখনো কোনো custom domain যুক্ত করা হয়নি।" : "No custom domain connected yet.",
    steps: isBn ? "দ্রুত publish ধাপ" : "Quick publish steps",
    step1: isBn ? "ওয়েবসাইট বিল্ডার থেকে logo, theme, section update করুন" : "Update logo, theme, and sections from Website Builder",
    step2: isBn ? "প্যাকেজ ও সার্ভিসেস থেকে published package তৈরি করুন" : "Create published packages from Packages & Services",
    step3: isBn ? "পাবলিক প্যাকেজ পেজে output check করুন" : "Check the result on the public packages page",
    step4: isBn ? "Custom domain verify হলে super admin SSL/activation complete করবে" : "After domain verification, super admin completes SSL and activation",
    copied: isBn ? "কপি হয়েছে" : "Copied",
    loadFailed: isBn ? "ডোমেইন তথ্য লোড করা যায়নি" : "Failed to load domain data",
    verified: isBn ? "ভেরিফাইড" : "Verified",
    pending: isBn ? "পেন্ডিং" : "Pending",
    active: isBn ? "সক্রিয়" : "Active",
    open: isBn ? "ওপেন" : "Open",
    copy: isBn ? "কপি" : "Copy",
    primary: isBn ? "প্রাইমারি" : "Primary",
    needsVerify: isBn ? "ভেরিফাই বাকি" : "Needs verify",
    sslReady: isBn ? "SSL Ready" : "SSL Ready",
    sslPending: isBn ? "SSL Pending" : "SSL Pending",
    addDomain: isBn ? "নতুন ডোমেইন যোগ করুন" : "Add new domain",
    domainName: isBn ? "ডোমেইন নাম" : "Domain name",
    domainHint: isBn ? "শুধু domain লিখুন, যেমন tourandtravels.cloud" : "Enter only the domain, for example tourandtravels.cloud",
    redirectRule: isBn ? "রিডাইরেক্ট রুল" : "Redirect rule",
    addNow: isBn ? "ডোমেইন যুক্ত করুন" : "Add domain",
    verify: isBn ? "ভেরিফাই" : "Verify",
    setPrimary: isBn ? "প্রাইমারি করুন" : "Set primary",
    remove: isBn ? "রিমুভ" : "Remove",
    added: isBn ? "ডোমেইন যোগ হয়েছে" : "Domain added",
    addFailed: isBn ? "ডোমেইন যোগ করা যায়নি" : "Failed to add domain",
    verifyDone: isBn ? "ভেরিফিকেশন চেক সম্পন্ন" : "Verification check completed",
    primaryDone: isBn ? "প্রাইমারি ডোমেইন আপডেট হয়েছে" : "Primary domain updated",
    removed: isBn ? "ডোমেইন রিমুভ করা হয়েছে" : "Domain removed",
    actionFailed: isBn ? "অ্যাকশন সম্পন্ন হয়নি" : "Action failed",
    domainLimit: isBn ? "ডোমেইন সীমা" : "Domain limit",
    usedLimit: isBn ? "ব্যবহৃত / সীমা" : "Used / limit",
  };

  const load = async () => {
    const [summaryData, domainData] = await Promise.all([tenantDomainApi.getSummary(), tenantDomainApi.list()]);
    setSummary(summaryData);
    setDomains(domainData);
  };

  useEffect(() => {
    load()
      .catch((err: any) => {
        toast({ title: text.loadFailed, description: err.message, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  const preferredLiveDomain = useMemo(() => {
    return domains.find((item) => item.isPrimary && item.status === "active")
      || domains.find((item) => item.status === "active")
      || domains.find((item) => item.isPrimary)
      || null;
  }, [domains]);

  const primaryLiveUrl = preferredLiveDomain
    ? `https://${preferredLiveDomain.wwwRedirect === "root-to-www" ? `www.${preferredLiveDomain.domain}` : preferredLiveDomain.domain}`
    : summary?.defaultWebsiteUrl || "";

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: text.copied, description: value });
  };

  const addDomain = async () => {
    if (!domainForm.domain.trim()) {
      toast({ title: text.addFailed, description: text.domainHint, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await tenantDomainApi.add(domainForm);
      setDomainForm({ domain: "", wwwRedirect: "www-to-root" });
      await load();
      toast({ title: text.added });
    } catch (err: any) {
      toast({ title: text.addFailed, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const verifyDomain = async (id: string) => {
    setActionId(id);
    try {
      await tenantDomainApi.verify(id);
      await load();
      toast({ title: text.verifyDone });
    } catch (err: any) {
      toast({ title: text.actionFailed, description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const setPrimaryDomain = async (id: string) => {
    setActionId(id);
    try {
      await tenantDomainApi.setPrimary(id);
      await load();
      toast({ title: text.primaryDone });
    } catch (err: any) {
      toast({ title: text.actionFailed, description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const removeDomain = async (id: string) => {
    setActionId(id);
    try {
      await tenantDomainApi.remove(id);
      await load();
      toast({ title: text.removed });
    } catch (err: any) {
      toast({ title: text.actionFailed, description: err.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="h-6 w-6" /> {text.title}</h1>
            <p className="text-sm text-muted-foreground">{text.subtitle}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/website/builder"><Button variant="outline"><Wand2 className="mr-2 h-4 w-4" />{text.websiteBuilder}</Button></Link>
            <Link to="/travel-packages"><Button variant="outline">{text.packagesServices}</Button></Link>
            <Link to="/site/packages"><Button><ExternalLink className="mr-2 h-4 w-4" />{text.publicPackages}</Button></Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>{text.defaultUrl}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="text-sm break-all">{summary?.defaultWebsiteUrl || "—"}</div>}
              {summary?.defaultWebsiteUrl ? <Button variant="outline" size="sm" onClick={() => copyText(summary.defaultWebsiteUrl)}><Copy className="mr-2 h-4 w-4" />{text.copy}</Button> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{text.primaryDomain}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="text-sm break-all">{primaryLiveUrl || "—"}</div>}
              {primaryLiveUrl ? <div className="flex gap-2 flex-wrap"><Button variant="outline" size="sm" onClick={() => copyText(primaryLiveUrl)}><Copy className="mr-2 h-4 w-4" />{text.copy}</Button><a href={primaryLiveUrl} target="_blank" rel="noreferrer"><Button size="sm"><ExternalLink className="mr-2 h-4 w-4" />{text.open}</Button></a></div> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{text.domainLimit}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>
                <div className="text-2xl font-bold">{summary?.usedDomains || 0} / {summary?.domainLimit || 0}</div>
                <p className="text-sm text-muted-foreground">{text.usedLimit}</p>
              </>}
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{text.steps}</CardTitle>
            <CardDescription>{summary?.tenantName || ""}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" /><span>{text.step1}</span></div>
            <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" /><span>{text.step2}</span></div>
            <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" /><span>{text.step3}</span></div>
            <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" /><span>{text.step4}</span></div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{text.addDomain}</CardTitle>
              <CardDescription>{text.domainHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{text.domainName}</Label>
                <Input value={domainForm.domain} placeholder="tourandtravels.cloud" onChange={(e) => setDomainForm((prev) => ({ ...prev, domain: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{text.redirectRule}</Label>
                <Select value={domainForm.wwwRedirect} onValueChange={(value: "www-to-root" | "root-to-www") => setDomainForm((prev) => ({ ...prev, wwwRedirect: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="www-to-root">www → root</SelectItem>
                    <SelectItem value="root-to-www">root → www</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addDomain} disabled={saving || !!summary && !summary.canAddDomain}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{text.addNow}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{text.connectedDomains}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : domains.length === 0 ? <p className="text-sm text-muted-foreground">{text.noDomains}</p> : domains.map((domain) => (
                <div key={domain.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-medium break-all">{domain.domain}</p>
                      <p className="text-xs text-muted-foreground mt-1">{domain.verificationToken}</p>
                    </div>
                    {domain.isPrimary ? <Badge><Star className="mr-1 h-3 w-3" />{text.primary}</Badge> : null}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {domain.verificationStatus === "verified" ? <Badge className="bg-green-100 text-green-800"><ShieldCheck className="mr-1 h-3 w-3" />{text.verified}</Badge> : <Badge variant="outline">{text.needsVerify}</Badge>}
                    <Badge variant={domain.status === "active" ? "default" : "secondary"}>{domain.status === "active" ? text.active : text.pending}</Badge>
                    <Badge variant={domain.sslStatus === "active" ? "default" : "outline"}>{domain.sslStatus === "active" ? text.sslReady : text.sslPending}</Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => verifyDomain(domain.id)} disabled={actionId === domain.id}>{actionId === domain.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{text.verify}</Button>
                    {!domain.isPrimary ? <Button variant="outline" size="sm" onClick={() => setPrimaryDomain(domain.id)} disabled={actionId === domain.id}>{text.setPrimary}</Button> : null}
                    <Button variant="destructive" size="sm" onClick={() => removeDomain(domain.id)} disabled={actionId === domain.id}><Trash2 className="mr-2 h-4 w-4" />{text.remove}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WebsitePublishGuide;
