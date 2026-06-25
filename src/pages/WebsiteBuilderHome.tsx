import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { tenantDomainApi, type TenantDomainRecord, type TenantDomainSummary } from "@/lib/tenantDomainApi";
import { Copy, ExternalLink, FileText, Globe, LayoutTemplate, Loader2, Package2, UploadCloud, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const WebsiteBuilderHome = () => {
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
  const [summary, setSummary] = useState<TenantDomainSummary | null>(null);

  const text = {
    title: isBn ? "ওয়েবসাইট সেন্টার" : "Website Center",
    subtitle: isBn ? "ওয়েবসাইট বিল্ডার, পাবলিশ, ডোমেইন এবং public output এক জায়গা থেকে সহজে ম্যানেজ করুন।" : "Manage website builder, publishing, domains, and public output from one place.",
    themeBuilder: isBn ? "থিম বিল্ডার" : "Theme Builder",
    themeBuilderDesc: isBn ? "logo, hero, agency info, section content এবং theme update করুন" : "Update logo, hero, agency info, section content, and theme settings",
    publishDomain: isBn ? "পাবলিশ ও ডোমেইন" : "Publish & Domain",
    publishDomainDesc: isBn ? "live URL, custom domain, verify status এবং publish flow check করুন" : "Check live URL, custom domains, verification status, and publish flow",
    packagesServices: isBn ? "প্যাকেজ ও সার্ভিসেস" : "Packages & Services",
    packagesServicesDesc: isBn ? "published package template তৈরি ও update করুন" : "Create and update published package templates",
    blogPosts: isBn ? "ব্লগ পোস্ট" : "Blog Posts",
    blogPostsDesc: isBn ? "ওয়েবসাইটে প্রকাশের জন্য ট্রাভেল টিপস ও আপডেট লিখুন" : "Write travel tips and updates for your public website",
    publicSite: isBn ? "পাবলিক ওয়েবসাইট" : "Public Website",
    publicSiteDesc: isBn ? "customer side output browser-এ দেখে নিন" : "Preview the customer-facing output in the browser",
    defaultUrl: isBn ? "ডিফল্ট লাইভ URL" : "Default live URL",
    primaryDomain: isBn ? "প্রাইমারি ডোমেইন" : "Primary domain",
    domainUsage: isBn ? "ডোমেইন ব্যবহার" : "Domain usage",
    quickFlow: isBn ? "দ্রুত কাজের ধাপ" : "Quick workflow",
    workflowTitle: isBn ? "কোন স্ক্রিনে কী কাজ করবেন" : "Which screen does what",
    workflowDesc: isBn ? "`/website` overview screen, `/website/builder` direct theme builder, আর `/website/publish` publish ও domain management screen হিসেবে কাজ করবে।" : "`/website` works as the overview screen, `/website/builder` is the direct theme builder, and `/website/publish` is the publish and domain management screen.",
    step1: isBn ? "থিম বিল্ডার থেকে branding ও homepage section update করুন" : "Update branding and homepage sections from Theme Builder",
    step2: isBn ? "প্যাকেজ ও সার্ভিসেস থেকে published package তৈরি করুন" : "Create published packages from Packages & Services",
    step3: isBn ? "পাবলিশ ও ডোমেইন থেকে live URL ও custom domain check করুন" : "Check live URL and custom domains from Publish & Domain",
    step4: isBn ? "পাবলিক ওয়েবসাইট খুলে final output দেখে নিন" : "Open the public website to review the final output",
    open: isBn ? "ওপেন" : "Open",
    copy: isBn ? "কপি" : "Copy",
    noUrl: isBn ? "এখনো live URL পাওয়া যায়নি" : "No live URL available yet",
    loadFailed: isBn ? "ওয়েবসাইট তথ্য লোড করা যায়নি" : "Failed to load website data",
    active: isBn ? "সক্রিয়" : "Active",
    pending: isBn ? "পেন্ডিং" : "Pending",
    openBuilder: isBn ? "থিম বিল্ডার খুলুন" : "Open Theme Builder",
    openPublish: isBn ? "পাবলিশ স্ক্রিন খুলুন" : "Open Publish Screen",
    openPublicSite: isBn ? "লাইভ সাইট খুলুন" : "Open Live Site",
    copyLiveUrl: isBn ? "লাইভ URL কপি" : "Copy Live URL",
    manageBuilder: isBn ? "বিল্ডার ম্যানেজ করুন" : "Manage Builder",
    managePublish: isBn ? "পাবলিশ ম্যানেজ করুন" : "Manage Publish",
    managePackages: isBn ? "প্যাকেজ ম্যানেজ করুন" : "Manage Packages",
    manageBlog: isBn ? "ব্লগ ম্যানেজ করুন" : "Manage Blog",
    previewSite: isBn ? "সাইট প্রিভিউ" : "Preview Site",
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

  const primaryDomain = useMemo(() => {
    return domains.find((item) => item.isPrimary && item.status === "active")
      || domains.find((item) => item.status === "active")
      || domains.find((item) => item.isPrimary)
      || null;
  }, [domains]);

  const primaryLiveUrl = primaryDomain
    ? `https://${primaryDomain.wwwRedirect === "root-to-www" ? `www.${primaryDomain.domain}` : primaryDomain.domain}`
    : summary?.defaultWebsiteUrl || "";

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: text.copy, description: value });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Globe className="h-7 w-7" /> {text.title}</h1>
            <p className="text-muted-foreground mt-2">{text.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/website/builder"><Button><Wand2 className="mr-2 h-4 w-4" />{text.openBuilder}</Button></Link>
            <Link to="/website/publish"><Button variant="outline"><UploadCloud className="mr-2 h-4 w-4" />{text.openPublish}</Button></Link>
            {primaryLiveUrl ? (
              <a href={primaryLiveUrl} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />{text.openPublicSite}</Button></a>
            ) : null}
          </div>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{text.workflowTitle}</CardTitle>
            <CardDescription>{text.workflowDesc}</CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>{text.defaultUrl}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <p className="text-sm break-all">{summary?.defaultWebsiteUrl || text.noUrl}</p>}
              {summary?.defaultWebsiteUrl ? <Button variant="outline" size="sm" onClick={() => copyText(summary.defaultWebsiteUrl)}><Copy className="mr-2 h-4 w-4" />{text.copy}</Button> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{text.primaryDomain}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>
                <p className="text-sm break-all">{primaryLiveUrl || text.noUrl}</p>
                <div className="flex gap-2 flex-wrap">
                  {primaryDomain ? <Badge variant={primaryDomain.status === "active" ? "default" : "secondary"}>{primaryDomain.status === "active" ? text.active : text.pending}</Badge> : null}
                  {primaryLiveUrl ? <Button variant="outline" size="sm" onClick={() => copyText(primaryLiveUrl)}><Copy className="mr-2 h-4 w-4" />{text.copyLiveUrl}</Button> : null}
                </div>
              </>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{text.domainUsage}</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <p className="text-2xl font-bold">{summary?.usedDomains || 0} / {summary?.domainLimit || 0}</p>}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LayoutTemplate className="h-5 w-5" /> {text.themeBuilder}</CardTitle>
              <CardDescription>{text.themeBuilderDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/website/builder"><Button className="w-full"><Wand2 className="mr-2 h-4 w-4" />{text.manageBuilder}</Button></Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5" /> {text.publishDomain}</CardTitle>
              <CardDescription>{text.publishDomainDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/website/publish"><Button className="w-full" variant="outline">{text.managePublish}</Button></Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package2 className="h-5 w-5" /> {text.packagesServices}</CardTitle>
              <CardDescription>{text.packagesServicesDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/packages/all"><Button className="w-full" variant="outline">{text.managePackages}</Button></Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {text.blogPosts}</CardTitle>
              <CardDescription>{text.blogPostsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/website/blog"><Button className="w-full" variant="outline">{text.manageBlog}</Button></Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ExternalLink className="h-5 w-5" /> {text.publicSite}</CardTitle>
              <CardDescription>{text.publicSiteDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <a href={primaryLiveUrl || "/site/packages"} target="_blank" rel="noreferrer"><Button className="w-full" variant="outline">{text.previewSite}</Button></a>
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{text.quickFlow}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>{text.step1}</div>
            <div>{text.step2}</div>
            <div>{text.step3}</div>
            <div>{text.step4}</div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WebsiteBuilderHome;
