import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Globe, Trash2, Copy, CheckCircle, AlertCircle, ExternalLink, ShieldCheck, Loader2, RefreshCw, Lock, Search, XCircle, CheckCircle2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { checkDomainARecord, generateSslCommand } from "@/lib/domainVerification";
import { adminApi, domainApi, type TenantDomainRecord, type AdminTenant } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const VPS_IP = import.meta.env.VITE_VPS_IP || "";
const DNS_CHECK_INTERVAL = 3 * 60 * 1000;

const AdminDomains = () => {
  const [domains, setDomains] = useState<TenantDomainRecord[]>([]);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verifyDialogDomain, setVerifyDialogDomain] = useState<TenantDomainRecord | null>(null);
  const [form, setForm] = useState({ tenantId: "", domain: "", wwwRedirect: "www-to-root" });
  const [verifying, setVerifying] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sslDialogDomain, setSslDialogDomain] = useState<TenantDomainRecord | null>(null);
  const [autoChecking, setAutoChecking] = useState(false);
  const [lastAutoCheck, setLastAutoCheck] = useState<string | null>(null);
  const [diagDomain, setDiagDomain] = useState<TenantDomainRecord | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<{
    aRecord: { found: boolean; ips: string[]; error?: string };
    ipMatch: boolean;
    ssl: { active: boolean; error?: string };
  } | null>(null);
  const domainsRef = useRef(domains);
  domainsRef.current = domains;
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const text = {
    loadFailed: isBn ? "ডেটা লোড ব্যর্থ" : "Data load failed",
    title: isBn ? "ডোমেইন ম্যানেজমেন্ট" : "Domain Management",
    subtitle: isBn ? "টেন্যান্টদের কাস্টম ডোমেইন ম্যানেজ করুন" : "Manage tenant custom domains",
    lastCheck: isBn ? "শেষ চেক" : "Last check",
    checking: isBn ? "চেক হচ্ছে..." : "Checking...",
    checkDnsNow: isBn ? "এখনই ডিএনএস চেক করুন" : "Check DNS Now",
    addDomain: isBn ? "ডোমেইন যুক্ত করুন" : "Add Domain",
    addNewDomain: isBn ? "নতুন ডোমেইন যুক্ত করুন" : "Add new domain",
    tenantCompany: isBn ? "টেন্যান্ট / কোম্পানি" : "Tenant / Company",
    selectCompany: isBn ? "কোম্পানি সিলেক্ট করুন" : "Select company",
    domain: isBn ? "ডোমেইন" : "Domain",
    domainHint: isBn ? "শুধু ডোমেইন নাম লিখুন, http:// বা www ছাড়া" : "Enter only domain name, without http:// or www",
    wwwRedirect: isBn ? "WWW রিডাইরেক্ট" : "WWW Redirect",
    saveAddDomain: isBn ? "ডোমেইন যুক্ত করুন" : "Add Domain",
    cancel: isBn ? "বাতিল" : "Cancel",
    verifyInstructions: isBn ? "ডোমেইন ভেরিফিকেশন নির্দেশনা" : "Domain verification instructions",
    step1: isBn ? "ধাপ ১: DNS TXT রেকর্ড যুক্ত করুন" : "Step 1: Add DNS TXT record",
    step1Text: isBn ? "আপনার DNS প্রোভাইডারে একটি TXT Record যুক্ত করুন:" : "Add a TXT record in your DNS provider:",
    step2: isBn ? "ধাপ ২: ভেরিফাই → ধাপ ৩: Nginx + SSL → ধাপ ৪: Activate" : "Step 2: Verify → Step 3: Nginx + SSL → Step 4: Activate",
    verification: isBn ? "ডোমেইন ভেরিফিকেশন" : "Domain Verification",
    verifyText: isBn ? "ভেরিফাই করতে DNS TXT রেকর্ড যুক্ত করুন:" : "Add DNS TXT record to verify:",
    type: "Type",
    name: "Name",
    value: "Value",
    copyToken: isBn ? "টোকেন কপি হয়েছে" : "Token copied",
    verifyDomain: isBn ? "ডোমেইন ভেরিফাই করুন" : "Verify Domain",
    close: isBn ? "বন্ধ করুন" : "Close",
    sslTitle: "SSL",
    sslActive: isBn ? "SSL Active" : "SSL Active",
    runOnVps: isBn ? "VPS-এ নিচের কমান্ড রান করুন:" : "Run the following command on VPS:",
    copyCommand: isBn ? "কমান্ড কপি করুন" : "Copy Command",
    markSslActive: isBn ? "SSL Active করুন" : "Mark SSL Active",
    diagnostic: isBn ? "ডায়াগনস্টিক" : "Diagnostic",
    recheck: isBn ? "পুনরায় চেক করুন" : "Re-check",
    runDiagnostic: isBn ? "ডায়াগনস্টিক চালান" : "Run Diagnostic",
    connectedDomains: isBn ? "সংযুক্ত ডোমেইন" : "Connected Domains",
    connectedDomainsDesc: isBn ? "প্রতিটি টেন্যান্টের কাস্টম ডোমেইন তালিকা" : "List of custom domains for each tenant",
    company: isBn ? "কোম্পানি" : "Company",
    verificationCol: isBn ? "ভেরিফিকেশন" : "Verification",
    status: isBn ? "স্ট্যাটাস" : "Status",
    ssl: "SSL",
    primary: isBn ? "প্রাইমারি" : "Primary",
    added: isBn ? "যুক্ত হয়েছে" : "Added",
    actions: isBn ? "অ্যাকশন" : "Actions",
    noDomains: isBn ? "কোনো ডোমেইন যুক্ত হয়নি" : "No domains added",
    active: isBn ? "সক্রিয়" : "Active",
    pending: isBn ? "অপেক্ষমান" : "Pending",
    error: isBn ? "ত্রুটি" : "Error",
    none: isBn ? "কিছুই নয়" : "None",
    remove: isBn ? "সরান" : "Remove",
    activate: isBn ? "অ্যাক্টিভ করুন" : "Activate",
    deactivate: isBn ? "ডিঅ্যাক্টিভ করুন" : "Deactivate",
    setPrimary: isBn ? "প্রাইমারি সেট করুন" : "Set primary",
    nginxCommand: isBn ? "Nginx কমান্ড" : "Nginx command",
    verify: isBn ? "ভেরিফাই" : "Verify",
    fillAll: isBn ? "সব ফিল্ড পূরণ করুন" : "Fill in all fields",
    domainAdded: isBn ? "ডোমেইন যুক্ত হয়েছে" : "Domain added",
    addFailed: isBn ? "ডোমেইন যুক্ত করা যায়নি" : "Could not add domain",
    verifiedSuccess: isBn ? "ডোমেইন ভেরিফাইড!" : "Domain verified!",
    verifyFailed: isBn ? "ভেরিফিকেশন ব্যর্থ" : "Verification failed",
    verifyMismatch: isBn ? "DNS TXT রেকর্ড মিলছে না" : "DNS TXT record does not match",
    verifyError: isBn ? "ভেরিফিকেশন ত্রুটি" : "Verification error",
    removed: isBn ? "ডোমেইন সরানো হয়েছে" : "Domain removed",
    removeFailed: isBn ? "মুছতে ব্যর্থ" : "Remove failed",
    statusUpdated: isBn ? "স্ট্যাটাস আপডেট হয়েছে" : "Status updated",
    updateFailed: isBn ? "আপডেট ব্যর্থ" : "Update failed",
    primarySet: isBn ? "Primary ডোমেইন সেট হয়েছে" : "Primary domain set",
    primaryFailed: isBn ? "Primary সেট ব্যর্থ" : "Failed to set primary",
    sslMarked: isBn ? "SSL Active করা হয়েছে" : "SSL marked active",
    sslFailed: isBn ? "SSL আপডেট ব্যর্থ" : "SSL update failed",
    sameStatus: isBn ? "সব ডোমেইনের স্ট্যাটাস আগের মতোই আছে" : "All domain statuses remain unchanged",
    sslCommandCopied: isBn ? "SSL কমান্ড কপি হয়েছে" : "SSL command copied",
    nginxCopied: isBn ? "Nginx কমান্ড কপি হয়েছে" : "Nginx command copied",
    unverified: isBn ? "ভেরিফাই হয়নি" : "Unverified",
  };

  const fetchData = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([domainApi.list(), adminApi.getTenants()]);
      setDomains(d);
      setTenants(t);
    } catch (err: any) {
      toast({ title: text.loadFailed, description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast, text.loadFailed]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runDnsStatusCheck = useCallback(async (silent = true) => {
    if (!VPS_IP) return;
    setAutoChecking(true);
    const verified = domainsRef.current.filter(d => d.verificationStatus === "verified");
    if (verified.length === 0) { setAutoChecking(false); return; }

    const results = await Promise.allSettled(
      verified.map(async d => {
        const r = await checkDomainARecord(d.domain, VPS_IP);
        return { id: d.id, ...r };
      })
    );

    let changed = 0;
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const dom = domainsRef.current.find(d => d.id === r.value.id);
      if (!dom) continue;
      const newStatus = r.value.pointing ? "active" : "pending";
      if (dom.status !== newStatus) {
        changed++;
        try { await domainApi.updateStatus(dom.id, newStatus); } catch {}
      }
    }

    setLastAutoCheck(new Date().toLocaleTimeString(isBn ? "bn-BD" : undefined));
    setAutoChecking(false);
    if (changed > 0) { await fetchData(); }
    if (!silent && changed === 0) toast({ title: text.sameStatus });
  }, [toast, fetchData, isBn, text.sameStatus]);

  useEffect(() => {
    const t1 = setTimeout(() => runDnsStatusCheck(true), 5000);
    const iv = setInterval(() => runDnsStatusCheck(true), DNS_CHECK_INTERVAL);
    return () => { clearTimeout(t1); clearInterval(iv); };
  }, [runDnsStatusCheck]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantId || !form.domain.trim()) {
      toast({ title: text.fillAll, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const newDom = await domainApi.add({ tenantId: form.tenantId, domain: form.domain.trim(), wwwRedirect: form.wwwRedirect });
      setDomains(prev => [newDom, ...prev]);
      setVerifyDialogDomain(newDom);
      toast({ title: text.domainAdded, description: newDom.domain });
      setForm({ tenantId: "", domain: "", wwwRedirect: "www-to-root" });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: text.addFailed, description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    try {
      const result = await domainApi.verify(id);
      setDomains(prev => prev.map(d => d.id === id ? result.domain : d));
      if (result.verified) {
        toast({ title: `✅ ${text.verifiedSuccess}`, description: result.domain.domain });
      } else {
        toast({ title: `❌ ${text.verifyFailed}`, description: text.verifyMismatch, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: text.verifyError, description: err.message, variant: "destructive" });
    } finally { setVerifying(null); }
  };

  const handleRemove = async (id: string) => {
    const dom = domains.find(d => d.id === id);
    try {
      await domainApi.remove(id);
      setDomains(prev => prev.filter(d => d.id !== id));
      toast({ title: text.removed, description: dom?.domain });
    } catch (err: any) {
      toast({ title: text.removeFailed, description: err.message, variant: "destructive" });
    }
  };

  const toggleStatus = async (id: string) => {
    const dom = domains.find(d => d.id === id);
    if (!dom) return;
    const newStatus = dom.status === "active" ? "pending" : "active";
    try {
      const updated = await domainApi.updateStatus(id, newStatus);
      setDomains(prev => prev.map(d => d.id === id ? updated : d));
      toast({ title: text.statusUpdated });
    } catch (err: any) {
      toast({ title: text.updateFailed, description: err.message, variant: "destructive" });
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await domainApi.setPrimary(id);
      setDomains(prev => prev.map(d => ({ ...d, isPrimary: d.id === id ? true : (d.tenantId === domains.find(x => x.id === id)?.tenantId ? false : d.isPrimary) })));
      toast({ title: text.primarySet });
    } catch (err: any) {
      toast({ title: text.primaryFailed, description: err.message, variant: "destructive" });
    }
  };

  const handleMarkSslActive = async (id: string) => {
    try {
      const updated = await domainApi.updateSsl(id, "active");
      setDomains(prev => prev.map(d => d.id === id ? updated : d));
      toast({ title: text.sslMarked });
      setSslDialogDomain(null);
    } catch (err: any) {
      toast({ title: text.sslFailed, description: err.message, variant: "destructive" });
    }
  };

  const runDiagnostic = async (domain: TenantDomainRecord) => {
    setDiagDomain(domain);
    setDiagRunning(true);
    setDiagResult(null);
    try {
      const aResult = await checkDomainARecord(domain.domain, VPS_IP || "0.0.0.0");
      let ssl = { active: false, error: undefined as string | undefined };
      try {
        await fetch(`https://${domain.domain}`, { method: "HEAD", mode: "no-cors" });
        ssl = { active: true, error: undefined };
      } catch { ssl = { active: false, error: "HTTPS connection failed" }; }
      setDiagResult({ aRecord: { found: aResult.resolvedIps.length > 0, ips: aResult.resolvedIps, error: aResult.error }, ipMatch: aResult.pointing, ssl });
    } catch (err: any) {
      setDiagResult({ aRecord: { found: false, ips: [], error: err.message }, ipMatch: false, ssl: { active: false, error: "Check failed" } });
    }
    setDiagRunning(false);
  };

  const copyToken = (token: string) => { navigator.clipboard.writeText(token); toast({ title: text.copyToken }); };
  const copySslCommand = (domain: string) => { navigator.clipboard.writeText(generateSslCommand(domain)); toast({ title: text.sslCommandCopied }); };
  const copyNginxCommand = (domain: string, wwwRedirect: string) => {
    const primary = wwwRedirect === "root-to-www" ? `www.${domain}` : domain;
    const redirect = wwwRedirect === "root-to-www" ? domain : `www.${domain}`;
    const cmd = `cat > /etc/nginx/sites-available/${domain} << 'EOF'
server { listen 80; server_name ${redirect}; return 301 https://${primary}$request_uri; }
server {
    listen 80; server_name ${primary};
    root /var/www/tawss-frontend/dist; index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
EOF
ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
sudo certbot --nginx -d ${domain} -d www.${domain}`;
    navigator.clipboard.writeText(cmd);
    toast({ title: text.nginxCopied });
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><ShieldCheck className="mr-1 h-3 w-3" />Verified</Badge>;
      case "verifying":
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />{text.checking}</Badge>;
      default:
        return <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-400"><AlertCircle className="mr-1 h-3 w-3" />{text.unverified}</Badge>;
    }
  };

  if (loading) {
    return <AdminLayout><div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{text.title}</h1>
            <p className="text-muted-foreground">{text.subtitle}{lastAutoCheck && <span className="ml-2 text-xs">• {text.lastCheck}: {lastAutoCheck}</span>}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => runDnsStatusCheck(false)} disabled={autoChecking}>
              <RefreshCw className={`mr-2 h-4 w-4 ${autoChecking ? "animate-spin" : ""}`} />
              {autoChecking ? text.checking : text.checkDnsNow}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{text.addDomain}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{text.addNewDomain}</DialogTitle></DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{text.tenantCompany}</Label>
                    <Select value={form.tenantId} onValueChange={v => setForm(f => ({ ...f, tenantId: v }))}>
                      <SelectTrigger><SelectValue placeholder={text.selectCompany} /></SelectTrigger>
                      <SelectContent>
                        {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name} <span className="text-muted-foreground">({t.subscriptionPlan})</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{text.domain}</Label>
                    <Input placeholder="example.com" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} maxLength={253} required />
                    <p className="text-xs text-muted-foreground">{text.domainHint}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{text.wwwRedirect}</Label>
                    <Select value={form.wwwRedirect} onValueChange={v => setForm(f => ({ ...f, wwwRedirect: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="www-to-root">www → root</SelectItem>
                        <SelectItem value="root-to-www">root → www</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}{text.saveAddDomain}</Button>
                    <DialogClose asChild><Button type="button" variant="outline">{text.cancel}</Button></DialogClose>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-dashed">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{text.verifyInstructions}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p className="font-semibold text-foreground">{text.step1}</p>
            <p>{text.step1Text}</p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 font-mono text-xs">
              <p><strong>{text.type}:</strong> TXT</p>
              <p><strong>{text.name}:</strong> _verify</p>
              <p><strong>{text.value}:</strong> {isBn ? "(টেবিলে প্রতিটি ডোমেইনের টোকেন দেখুন)" : "(see each domain token in the table)"}</p>
            </div>
            <p className="font-semibold text-foreground mt-2">{text.step2}</p>
          </CardContent>
        </Card>

        <Dialog open={!!verifyDialogDomain} onOpenChange={open => !open && setVerifyDialogDomain(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />{text.verification}</DialogTitle></DialogHeader>
            {verifyDialogDomain && <div className="space-y-4">
              <p className="text-sm text-muted-foreground"><strong>{verifyDialogDomain.domain}</strong> {text.verifyText}</p>
              <div className="bg-muted rounded-lg p-4 space-y-2 font-mono text-sm">
                <div><strong>{text.type}:</strong> TXT</div>
                <div><strong>{text.name}:</strong> _verify</div>
                <div className="flex items-center gap-2">
                  <span className="break-all"><strong>{text.value}:</strong> {verifyDialogDomain.verificationToken}</span>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToken(verifyDialogDomain.verificationToken)}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleVerify(verifyDialogDomain.id)} disabled={verifying === verifyDialogDomain.id} className="flex-1">
                  {verifying === verifyDialogDomain.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{text.checking}</> : <><ShieldCheck className="mr-2 h-4 w-4" />{text.verifyDomain}</>}
                </Button>
                <DialogClose asChild><Button variant="outline">{text.close}</Button></DialogClose>
              </div>
            </div>}
          </DialogContent>
        </Dialog>

        <Dialog open={!!sslDialogDomain} onOpenChange={open => { if (!open) setSslDialogDomain(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />{text.sslTitle} — {sslDialogDomain?.domain}</DialogTitle></DialogHeader>
            {sslDialogDomain && <div className="space-y-4">
              {sslDialogDomain.sslStatus === "active" ? (
                <div className="text-center py-4"><CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" /><p className="font-medium">{text.sslActive}</p></div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{text.runOnVps}</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap max-h-48">{generateSslCommand(sslDialogDomain.domain)}</pre>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => copySslCommand(sslDialogDomain.domain)}><Copy className="mr-2 h-4 w-4" />{text.copyCommand}</Button>
                    <Button className="flex-1" onClick={() => handleMarkSslActive(sslDialogDomain.id)}><CheckCircle className="mr-2 h-4 w-4" />{text.markSslActive}</Button>
                  </div>
                </>
              )}
              <DialogClose asChild><Button variant="outline" className="w-full">{text.close}</Button></DialogClose>
            </div>}
          </DialogContent>
        </Dialog>

        <Dialog open={!!diagDomain} onOpenChange={open => { if (!open) { setDiagDomain(null); setDiagResult(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" />{text.diagnostic} — {diagDomain?.domain}</DialogTitle></DialogHeader>
            {diagDomain && <div className="space-y-4">
              {diagRunning ? (
                <div className="flex flex-col items-center py-6 gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">{text.checking}</p></div>
              ) : diagResult ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    {diagResult.aRecord.found ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />}
                    <div><p className="font-medium text-sm">{diagResult.aRecord.found ? "✔ A record found" : "❌ A record not found"}</p>{diagResult.aRecord.ips.length > 0 && <p className="text-xs text-muted-foreground">IPs: {diagResult.aRecord.ips.join(", ")}</p>}</div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    {diagResult.ipMatch ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />}
                    <div><p className="font-medium text-sm">{diagResult.ipMatch ? "✔ IP matches VPS" : "❌ IP mismatch"}</p><p className="text-xs text-muted-foreground">Expected: {VPS_IP || "(not set)"}</p></div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    {diagResult.ssl.active ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />}
                    <div><p className="font-medium text-sm">{diagResult.ssl.active ? "✔ SSL installed" : "❌ SSL not installed"}</p></div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => runDiagnostic(diagDomain)}><RefreshCw className="mr-2 h-4 w-4" />{text.recheck}</Button>
                </div>
              ) : (
                <Button className="w-full" onClick={() => runDiagnostic(diagDomain)}><Search className="mr-2 h-4 w-4" />{text.runDiagnostic}</Button>
              )}
              <DialogClose asChild><Button variant="outline" className="w-full">{text.close}</Button></DialogClose>
            </div>}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>{text.connectedDomains} ({domains.length})</CardTitle>
            <CardDescription>{text.connectedDomainsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.domain}</TableHead>
                  <TableHead>{text.company}</TableHead>
                  <TableHead>{text.verificationCol}</TableHead>
                  <TableHead>{text.status}</TableHead>
                  <TableHead>{text.ssl}</TableHead>
                  <TableHead>{text.primary}</TableHead>
                  <TableHead>{text.added}</TableHead>
                  <TableHead className="w-[240px]">{text.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{text.noDomains}</TableCell></TableRow>
                ) : domains.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{d.domain}</span><a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /></a></div>
                        <span className="text-xs text-muted-foreground ml-6">+ www.{d.domain} ({d.wwwRedirect === "www-to-root" ? "www → root" : "root → www"})</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.tenant?.name || "—"}</TableCell>
                    <TableCell>{getVerificationBadge(d.verificationStatus)}</TableCell>
                    <TableCell>{d.status === "active" ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="mr-1 h-3 w-3" />{text.active}</Badge> : d.status === "pending" ? <Badge variant="secondary"><AlertCircle className="mr-1 h-3 w-3" />{text.pending}</Badge> : <Badge variant="destructive">{text.error}</Badge>}</TableCell>
                    <TableCell>{d.sslStatus === "active" ? <Badge variant="outline" className="text-green-700 border-green-300">🔒 SSL</Badge> : d.sslStatus === "pending" ? <Badge variant="outline">⏳ {text.pending}</Badge> : <Badge variant="outline" className="text-destructive border-destructive/30">❌ {text.none}</Badge>}</TableCell>
                    <TableCell>{d.isPrimary ? <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Star className="mr-1 h-3 w-3" />{text.primary}</Badge> : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(d.createdAt).toLocaleDateString(isBn ? "bn-BD" : undefined)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title={text.diagnostic} onClick={() => runDiagnostic(d)}><Search className="h-4 w-4 text-primary" /></Button>
                        <Button variant="ghost" size="icon" title={text.verify} onClick={() => setVerifyDialogDomain(d)}><ShieldCheck className={`h-4 w-4 ${d.verificationStatus === "verified" ? "text-green-600" : "text-amber-500"}`} /></Button>
                        <Button variant="ghost" size="icon" title={text.ssl} onClick={() => setSslDialogDomain(d)} disabled={d.verificationStatus !== "verified"}><Lock className={`h-4 w-4 ${d.sslStatus === "active" ? "text-green-600" : "text-muted-foreground"}`} /></Button>
                        <Button variant="ghost" size="icon" title={text.nginxCommand} onClick={() => copyNginxCommand(d.domain, d.wwwRedirect)}><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title={text.setPrimary} onClick={() => handleSetPrimary(d.id)} disabled={d.isPrimary}><Star className={`h-4 w-4 ${d.isPrimary ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} /></Button>
                        <Button variant="ghost" size="icon" title={d.status === "active" ? text.deactivate : text.activate} onClick={() => toggleStatus(d.id)} disabled={d.verificationStatus !== "verified" && d.status !== "active"}><CheckCircle className={`h-4 w-4 ${d.status === "active" ? "text-green-600" : "text-muted-foreground"}`} /></Button>
                        <Button variant="ghost" size="icon" title={text.remove} onClick={() => handleRemove(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDomains;
