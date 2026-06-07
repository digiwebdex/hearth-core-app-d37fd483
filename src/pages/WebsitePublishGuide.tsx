import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { tenantDomainApi, type TenantDomainRecord, type TenantDomainSummary } from "@/lib/tenantDomainApi";
import { CheckCircle2, Copy, ExternalLink, Globe, Loader2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const WebsitePublishGuide = () => {
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
  const [summary, setSummary] = useState<TenantDomainSummary | null>(null);

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
  };

  useEffect(() => {
    Promise.all([tenantDomainApi.getSummary(), tenantDomainApi.list()])
      .then(([summaryData, domainData]) => {
        setSummary(summaryData);
        setDomains(domainData);
      })
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="h-6 w-6" /> {text.title}</h1>
            <p className="text-sm text-muted-foreground">{text.subtitle}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/website"><Button variant="outline"><Wand2 className="mr-2 h-4 w-4" />{text.websiteBuilder}</Button></Link>
            <Link to="/travel-packages"><Button variant="outline">{text.packagesServices}</Button></Link>
            <Link to="/site/packages"><Button><ExternalLink className="mr-2 h-4 w-4" />{text.publicPackages}</Button></Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{text.defaultUrl}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="text-sm break-all">{summary?.defaultWebsiteUrl || "—"}</div>}
              {summary?.defaultWebsiteUrl ? <Button variant="outline" size="sm" onClick={() => copyText(summary.defaultWebsiteUrl)}><Copy className="mr-2 h-4 w-4" />Copy</Button> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{text.primaryDomain}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="text-sm break-all">{primaryLiveUrl || "—"}</div>}
              {primaryLiveUrl ? <div className="flex gap-2 flex-wrap"><Button variant="outline" size="sm" onClick={() => copyText(primaryLiveUrl)}><Copy className="mr-2 h-4 w-4" />Copy</Button><a href={primaryLiveUrl} target="_blank" rel="noreferrer"><Button size="sm"><ExternalLink className="mr-2 h-4 w-4" />{text.open}</Button></a></div> : null}
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

        <Card>
          <CardHeader>
            <CardTitle>{text.connectedDomains}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : domains.length === 0 ? <p className="text-sm text-muted-foreground">{text.noDomains}</p> : domains.map((domain) => (
              <div key={domain.id} className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium break-all">{domain.domain}</p>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <Badge variant={domain.verificationStatus === "verified" ? "default" : "outline"}>{domain.verificationStatus === "verified" ? text.verified : text.pending}</Badge>
                    <Badge variant={domain.status === "active" ? "default" : "secondary"}>{domain.status === "active" ? text.active : text.pending}</Badge>
                  </div>
                </div>
                {domain.isPrimary ? <Badge>{text.primaryDomain}</Badge> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WebsitePublishGuide;
