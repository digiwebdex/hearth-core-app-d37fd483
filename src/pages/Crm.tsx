import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target, UserCheck, Building2, FileText, Clock, ListTodo, MessageCircle,
  FolderOpen, AlertCircle, Megaphone, BarChart3, Settings, ArrowRight, LayoutGrid,
} from "lucide-react";

// A CRM workspace hub. Built features link to their real pages; not-yet-built
// leaves are marked "soon" so the whole CRM map is visible and honest. New
// phases (Complaints, Campaigns, CRM analytics/settings) fill the gaps here.
interface Leaf { label: string; soon?: boolean }
interface Group { id: string; title: string; titleBn: string; icon: typeof Target; url?: string; leaves: Leaf[] }

const GROUPS: Group[] = [
  { id: "leads", title: "Leads", titleBn: "লিড", icon: Target, url: "/leads", leaves: [
    { label: "New lead" }, { label: "Lead source" }, { label: "Lead status" }, { label: "Lead score" },
    { label: "Assignment" }, { label: "Follow-up" }, { label: "Call / WhatsApp / Email log" }, { label: "Meeting schedule" },
    { label: "Timeline" }, { label: "Notes" }, { label: "Duplicate detection" }, { label: "Convert to customer" },
  ] },
  { id: "customers", title: "Customers", titleBn: "গ্রাহক", icon: UserCheck, url: "/clients", leaves: [
    { label: "Individual & corporate" }, { label: "Profile, passport, NID" }, { label: "Emergency contact" },
    { label: "Travel / booking / payment history" }, { label: "Loyalty points" }, { label: "Tags" },
    { label: "Documents" }, { label: "Passport expiry reminder" },
    { label: "Family members", soon: true }, { label: "Customer wallet", soon: true }, { label: "Birthday reminder", soon: true },
  ] },
  { id: "corporate", title: "Corporate clients", titleBn: "কর্পোরেট ক্লায়েন্ট", icon: Building2, url: "/corporate", leaves: [
    { label: "Company profile" }, { label: "Corporate bookings" }, { label: "Billing information" },
    { label: "Contact persons", soon: true }, { label: "Employees", soon: true },
    { label: "Credit limit", soon: true }, { label: "Contract", soon: true },
  ] },
  { id: "quotations", title: "Quotations", titleBn: "কোটেশন", icon: FileText, url: "/quotations", leaves: [
    { label: "Air ticket / visa / hotel quote" }, { label: "Tour / Hajj / Umrah quote" }, { label: "Transport / insurance quote" },
    { label: "PDF quotation" }, { label: "Quote history" }, { label: "Email / WhatsApp quote", soon: true },
  ] },
  { id: "followups", title: "Follow-ups", titleBn: "ফলো-আপ", icon: Clock, url: "/follow-ups", leaves: [
    { label: "Today's follow-up" }, { label: "Upcoming" }, { label: "Overdue" }, { label: "Completed" },
    { label: "Reminders" }, { label: "Calendar view", soon: true },
  ] },
  { id: "tasks", title: "Tasks", titleBn: "টাস্ক", icon: ListTodo, url: "/tasks", leaves: [
    { label: "My tasks" }, { label: "Assign task" }, { label: "Priority" }, { label: "Task reminder" },
    { label: "Team tasks", soon: true }, { label: "Checklist", soon: true },
  ] },
  { id: "communications", title: "Communications", titleBn: "যোগাযোগ", icon: MessageCircle, url: "/notifications", leaves: [
    { label: "WhatsApp" }, { label: "SMS" }, { label: "Email" }, { label: "Templates" },
    { label: "Auto notifications" }, { label: "Communication history" }, { label: "Bulk messaging", soon: true },
  ] },
  { id: "documents", title: "Documents", titleBn: "ডকুমেন্ট", icon: FolderOpen, url: "/documents", leaves: [
    { label: "Passport / visa copy" }, { label: "Air ticket / hotel voucher" }, { label: "Invoice / money receipt" },
    { label: "Agreement & other" }, { label: "Document expiry alerts" },
  ] },
  { id: "complaints", title: "Complaints", titleBn: "অভিযোগ", icon: AlertCircle, url: "/complaints", leaves: [
    { label: "New complaint" }, { label: "Assigned staff" }, { label: "Resolution" },
    { label: "Customer feedback" }, { label: "Complaint history" },
  ] },
  { id: "marketing", title: "Marketing", titleBn: "মার্কেটিং", icon: Megaphone, url: "/campaigns", leaves: [
    { label: "SMS campaign" }, { label: "WhatsApp campaign" }, { label: "Email campaign" },
    { label: "Customer segmentation" }, { label: "Loyalty program" }, { label: "Referral program" },
    { label: "Promotions", soon: true },
  ] },
  { id: "reports", title: "Reports", titleBn: "রিপোর্ট", icon: BarChart3, url: "/reports", leaves: [
    { label: "Customer report" }, { label: "Corporate report" }, { label: "Follow-up report" },
    { label: "Lead & source report", soon: true }, { label: "Conversion report", soon: true },
    { label: "Lost lead report", soon: true }, { label: "Retention report", soon: true }, { label: "CRM analytics", soon: true },
  ] },
  { id: "settings", title: "CRM settings", titleBn: "CRM সেটিংস", icon: Settings, url: "/settings", leaves: [
    { label: "WhatsApp / SMS / SMTP API" }, { label: "User permissions" },
    { label: "Lead sources", soon: true }, { label: "Lead status", soon: true }, { label: "Follow-up types", soon: true },
    { label: "Custom fields", soon: true }, { label: "Automation rules", soon: true },
  ] },
];

export default function Crm() {
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">{isBn ? "CRM ওয়ার্কস্পেস" : "CRM workspace"}</h1>
          </div>
          <p className="text-muted-foreground">
            {isBn
              ? "লিড থেকে গ্রাহক পর্যন্ত সবকিছু এক জায়গায়। ✓ চিহ্নিত অংশগুলো চালু আছে; 'শীঘ্রই' অংশগুলো পরবর্তী ধাপে যুক্ত হবে।"
              : "Everything from lead to loyal customer in one place. Sections marked live are ready now; “soon” items arrive in the next phases."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => {
            const Icon = g.icon;
            const built = g.leaves.filter((l) => !l.soon).length;
            const header = (
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  <span className="flex-1">{isBn ? g.titleBn : g.title}</span>
                  {g.url ? <ArrowRight className="h-4 w-4 text-muted-foreground" /> : (
                    <Badge variant="secondary" className="text-[10px] font-normal">{isBn ? "শীঘ্রই" : "Soon"}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
            );
            const body = (
              <CardContent className="pt-0">
                <ul className="space-y-1">
                  {g.leaves.map((l, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-sm">
                      {l.soon ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                          <span className="text-muted-foreground/60">{l.label}</span>
                          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/50">· {isBn ? "শীঘ্রই" : "soon"}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-primary shrink-0">✓</span>
                          <span className="text-foreground/80">{l.label}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {g.url && (
                  <p className="mt-3 text-xs text-primary font-medium">
                    {isBn ? `খুলুন (${built} টি চালু)` : `Open · ${built} live`}
                  </p>
                )}
              </CardContent>
            );
            return g.url ? (
              <Link key={g.id} to={g.url} className="block">
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">{header}{body}</Card>
              </Link>
            ) : (
              <Card key={g.id} className="h-full opacity-90">{header}{body}</Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-4">
          {isBn
            ? "এই মডিউলটি Business ও Ultimate প্ল্যানের জন্য। মালিক Settings → ঐচ্ছিক মডিউল থেকে চালু/বন্ধ করতে পারেন।"
            : "This module is for Business and Ultimate plans. The owner can switch it on or off in Settings → Optional modules."}
        </p>
      </div>
    </DashboardLayout>
  );
}
