import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AdminNotificationBell from "@/components/AdminNotificationBell";

const EXACT_TRANSLATIONS: Array<{ en: string; bn: string }> = [
  { en: "SMS Templates", bn: "এসএমএস টেমপ্লেট" },
  { en: "Manage SMS message templates with dynamic variables", bn: "ডাইনামিক ভ্যারিয়েবলসহ এসএমএস বার্তার টেমপ্লেট পরিচালনা করুন" },
  { en: "New Template", bn: "নতুন টেমপ্লেট" },
  { en: "Search templates...", bn: "টেমপ্লেট খুঁজুন..." },
  { en: "Filter type", bn: "ধরন ফিল্টার" },
  { en: "All Types", bn: "সব ধরন" },
  { en: "Booking", bn: "বুকিং" },
  { en: "Payment", bn: "পেমেন্ট" },
  { en: "Reminder", bn: "রিমাইন্ডার" },
  { en: "Custom", bn: "কাস্টম" },
  { en: "No templates found", bn: "কোনো টেমপ্লেট পাওয়া যায়নি" },
  { en: "Create your first SMS template to get started.", bn: "শুরু করতে আপনার প্রথম এসএমএস টেমপ্লেট তৈরি করুন।" },
  { en: "Name", bn: "নাম" },
  { en: "Type", bn: "ধরন" },
  { en: "Message Preview", bn: "বার্তার প্রিভিউ" },
  { en: "Variables", bn: "ভ্যারিয়েবল" },
  { en: "Status", bn: "স্ট্যাটাস" },
  { en: "Actions", bn: "অ্যাকশন" },
  { en: "Active", bn: "সক্রিয়" },
  { en: "Inactive", bn: "নিষ্ক্রিয়" },
  { en: "Preview", bn: "প্রিভিউ" },
  { en: "Edit", bn: "এডিট" },
  { en: "Delete", bn: "মুছুন" },
  { en: "Edit Template", bn: "টেমপ্লেট এডিট করুন" },
  { en: "New SMS Template", bn: "নতুন এসএমএস টেমপ্লেট" },
  { en: "Use {{variable}} syntax to insert dynamic content into your messages.", bn: "আপনার বার্তায় ডাইনামিক কনটেন্ট যোগ করতে {{variable}} সিনট্যাক্স ব্যবহার করুন।" },
  { en: "Template Name", bn: "টেমপ্লেট নাম" },
  { en: "Available Variables", bn: "উপলব্ধ ভ্যারিয়েবল" },
  { en: "Click to insert into message", bn: "বার্তায় যুক্ত করতে ক্লিক করুন" },
  { en: "Message Template", bn: "বার্তার টেমপ্লেট" },
  { en: "Live Preview", bn: "লাইভ প্রিভিউ" },
  { en: "Cancel", bn: "বাতিল" },
  { en: "Template Preview", bn: "টেমপ্লেট প্রিভিউ" },
  { en: "Rendered SMS", bn: "রেন্ডার করা এসএমএস" },
  { en: "Template updated", bn: "টেমপ্লেট আপডেট হয়েছে" },
  { en: "Template created", bn: "টেমপ্লেট তৈরি হয়েছে" },
  { en: "Template deleted", bn: "টেমপ্লেট মুছে ফেলা হয়েছে" },
  { en: "Name and message are required", bn: "নাম এবং বার্তা আবশ্যক" },

  { en: "SMS Logs", bn: "এসএমএস লগ" },
  { en: "Send SMS messages and view delivery logs", bn: "এসএমএস পাঠান এবং ডেলিভারি লগ দেখুন" },
  { en: "Refresh", bn: "রিফ্রেশ" },
  { en: "Send SMS", bn: "এসএমএস পাঠান" },
  { en: "Total Sent", bn: "মোট পাঠানো" },
  { en: "Delivered", bn: "ডেলিভার হয়েছে" },
  { en: "Failed", bn: "ব্যর্থ" },
  { en: "Pending", bn: "অপেক্ষমান" },
  { en: "Search by phone...", bn: "ফোন নম্বর দিয়ে খুঁজুন..." },
  { en: "All Status", bn: "সব স্ট্যাটাস" },
  { en: "Search", bn: "খুঁজুন" },
  { en: "No SMS logs found", bn: "কোনো এসএমএস লগ পাওয়া যায়নি" },
  { en: "Send your first SMS to see logs here.", bn: "এখানে লগ দেখতে আপনার প্রথম এসএমএস পাঠান।" },
  { en: "Phone", bn: "ফোন" },
  { en: "Message", bn: "বার্তা" },
  { en: "Provider", bn: "প্রোভাইডার" },
  { en: "Error", bn: "ত্রুটি" },
  { en: "Sent At", bn: "পাঠানোর সময়" },
  { en: "Previous", bn: "পূর্ববর্তী" },
  { en: "Next", bn: "পরবর্তী" },
  { en: "Send a single SMS message to a phone number.", bn: "একটি ফোন নম্বরে একক এসএমএস পাঠান।" },
  { en: "Phone Number", bn: "ফোন নম্বর" },
  { en: "Include country code (e.g. +880)", bn: "কান্ট্রি কোডসহ দিন (যেমন +880)" },
  { en: "Type your message...", bn: "আপনার বার্তা লিখুন..." },
  { en: "Phone and message are required", bn: "ফোন নম্বর এবং বার্তা আবশ্যক" },
  { en: "SMS sent successfully", bn: "এসএমএস সফলভাবে পাঠানো হয়েছে" },
  { en: "SMS failed", bn: "এসএমএস পাঠানো ব্যর্থ হয়েছে" },
  { en: "Failed to send SMS", bn: "এসএমএস পাঠানো যায়নি" },

  { en: "Role & Permission Management", bn: "রোল ও পারমিশন ম্যানেজমেন্ট" },
  { en: "Configure permissions for each role across all modules", bn: "সব মডিউলে প্রতিটি রোলের পারমিশন কনফিগার করুন" },
  { en: "Save All Changes", bn: "সব পরিবর্তন সংরক্ষণ করুন" },
  { en: "permissions", bn: "পারমিশন" },
  { en: "View", bn: "দেখুন" },
  { en: "Reset", bn: "রিসেট" },
  { en: "Permission Editor", bn: "পারমিশন এডিটর" },
  { en: "Full Permission View", bn: "পূর্ণ পারমিশন ভিউ" },
  { en: "Module", bn: "মডিউল" },
  { en: "Permission configuration saved", bn: "পারমিশন কনফিগারেশন সংরক্ষিত হয়েছে" },
  { en: "Changes will apply to all tenants.", bn: "পরিবর্তন সব টেন্যান্টে প্রযোজ্য হবে।" },
  { en: "Close", bn: "বন্ধ করুন" },
  { en: "Super Admin", bn: "সুপার অ্যাডমিন" },
  { en: "Tenant Owner", bn: "টেন্যান্ট ওনার" },
  { en: "Manager", bn: "ম্যানেজার" },
  { en: "Sales Agent", bn: "সেলস এজেন্ট" },
  { en: "Accountant", bn: "অ্যাকাউন্ট্যান্ট" },
  { en: "Operations", bn: "অপারেশনস" },
  { en: "Dashboard", bn: "ড্যাশবোর্ড" },
  { en: "Clients", bn: "ক্লায়েন্ট" },
  { en: "Agents", bn: "এজেন্ট" },
  { en: "Vendors", bn: "ভেন্ডর" },
  { en: "Leads", bn: "লিড" },
  { en: "Tasks", bn: "টাস্ক" },
  { en: "Quotations", bn: "কোটেশন" },
  { en: "Bookings", bn: "বুকিং" },
  { en: "Invoices", bn: "ইনভয়েস" },
  { en: "Accounts", bn: "অ্যাকাউন্টস" },
  { en: "Reports", bn: "রিপোর্ট" },
  { en: "Subscription", bn: "সাবস্ক্রিপশন" },
  { en: "Team", bn: "টিম" },
  { en: "Organization", bn: "অর্গানাইজেশন" },
  { en: "Settings", bn: "সেটিংস" },
  { en: "Website", bn: "ওয়েবসাইট" },
  { en: "Admin Panel", bn: "অ্যাডমিন প্যানেল" },

  { en: "Platform Reports", bn: "প্ল্যাটফর্ম রিপোর্ট" },
  { en: "Revenue, growth, churn, and financial analytics", bn: "রাজস্ব, গ্রোথ, চার্ন এবং আর্থিক অ্যানালিটিক্স" },
  { en: "Last 3 Months", bn: "শেষ ৩ মাস" },
  { en: "Last 6 Months", bn: "শেষ ৬ মাস" },
  { en: "Last 12 Months", bn: "শেষ ১২ মাস" },
  { en: "MRR Trend", bn: "এমআরআর ট্রেন্ড" },
  { en: "Collected vs Due", bn: "আদায় বনাম বকেয়া" },
  { en: "Revenue by Plan", bn: "প্ল্যানভিত্তিক রাজস্ব" },
  { en: "Agency Growth", bn: "এজেন্সি গ্রোথ" },
  { en: "Top Agencies", bn: "শীর্ষ এজেন্সি" },
  { en: "Agency", bn: "এজেন্সি" },
  { en: "Plan Analytics", bn: "প্ল্যান অ্যানালিটিক্স" },
  { en: "Plan Distribution", bn: "প্ল্যান বন্টন" },
  { en: "Plan Breakdown", bn: "প্ল্যান বিভাজন" },
  { en: "Overdue & Churn", bn: "বকেয়া ও চার্ন" },
  { en: "Overdue Payments", bn: "বকেয়া পেমেন্ট" },
  { en: "Days Late", bn: "বিলম্বিত দিন" },
  { en: "Monthly Churn", bn: "মাসিক চার্ন" },
  { en: "Collected", bn: "আদায়" },
  { en: "Due", bn: "বকেয়া" },
  { en: "Total", bn: "মোট" },
  { en: "New", bn: "নতুন" },
  { en: "Churned", bn: "চার্নড" },

  { en: "Feature Control", bn: "ফিচার কন্ট্রোল" },
  { en: "Toggle features per subscription plan", bn: "প্রতি সাবস্ক্রিপশন প্ল্যানে ফিচার চালু বা বন্ধ করুন" },
  { en: "Reset Defaults", bn: "ডিফল্টে রিসেট করুন" },
  { en: "Save Changes", bn: "পরিবর্তন সংরক্ষণ করুন" },
  { en: "Feature configuration saved", bn: "ফিচার কনফিগারেশন সংরক্ষিত হয়েছে" },
  { en: "Changes will affect all tenants immediately.", bn: "পরিবর্তন তাৎক্ষণিকভাবে সব টেন্যান্টে প্রযোজ্য হবে।" },
  { en: "All On", bn: "সব চালু" },
  { en: "All Off", bn: "সব বন্ধ" },
  { en: "All Features", bn: "সব ফিচার" },
  { en: "Feature", bn: "ফিচার" },

  { en: "Domain Management", bn: "ডোমেইন ম্যানেজমেন্ট" },
  { en: "Check DNS Now", bn: "এখনই ডিএনএস চেক করুন" },
  { en: "Add Domain", bn: "ডোমেইন যুক্ত করুন" },
  { en: "Checking...", bn: "চেক হচ্ছে..." },
  { en: "WWW Redirect", bn: "WWW রিডাইরেক্ট" },
  { en: "Verify Domain", bn: "ডোমেইন ভেরিফাই করুন" },
  { en: "Checking DNS...", bn: "ডিএনএস চেক হচ্ছে..." },
  { en: "SSL Active", bn: "এসএসএল সক্রিয়" },
  { en: "Copy Command", bn: "কমান্ড কপি করুন" },
  { en: "Mark SSL Active", bn: "এসএসএল সক্রিয় হিসেবে চিহ্নিত করুন" },
  { en: "Diagnostic", bn: "ডায়াগনস্টিক" },
  { en: "A record found", bn: "A record পাওয়া গেছে" },
  { en: "A record not found", bn: "A record পাওয়া যায়নি" },
  { en: "IP matches VPS", bn: "আইপি VPS-এর সাথে মিলেছে" },
  { en: "IP mismatch", bn: "আইপি মেলেনি" },
  { en: "SSL installed", bn: "এসএসএল ইনস্টল করা আছে" },
  { en: "SSL not installed", bn: "এসএসএল ইনস্টল করা নেই" },
  { en: "Verified", bn: "ভেরিফাইড" },
  { en: "Unverified", bn: "ভেরিফাই হয়নি" },
  { en: "Tenant / Company", bn: "টেন্যান্ট / কোম্পানি" },

  { en: "Back to agencies", bn: "এজেন্সি তালিকায় ফিরে যান" },
  { en: "Tenant ID:", bn: "টেন্যান্ট আইডি:" },
  { en: "Company profile", bn: "কোম্পানি প্রোফাইল" },
  { en: "Owner:", bn: "ওনার:" },
  { en: "Owner email:", bn: "ওনার ইমেইল:" },
  { en: "Created:", bn: "তৈরির তারিখ:" },
  { en: "Users:", bn: "ব্যবহারকারী:" },
  { en: "Bookings:", bn: "বুকিং:" },
  { en: "Current plan:", bn: "বর্তমান প্ল্যান:" },
  { en: "Expiry:", bn: "মেয়াদ শেষ:" },
  { en: "Available plans:", bn: "উপলব্ধ প্ল্যান:" },
  { en: "Activate / change plan", bn: "অ্যাক্টিভ / প্ল্যান পরিবর্তন" },
  { en: "Extend", bn: "এক্সটেন্ড" },
  { en: "Skip trial", bn: "ট্রায়াল শেষ করুন" },
  { en: "Suspend", bn: "সাসপেন্ড" },
  { en: "Custom domains", bn: "কাস্টম ডোমেইন" },
  { en: "Open domain management", bn: "ডোমেইন ম্যানেজমেন্ট খুলুন" },
  { en: "This agency has not connected any custom domain yet.", bn: "এই এজেন্সি এখনো কোনো কাস্টম ডোমেইন সংযুক্ত করেনি।" },
  { en: "Primary", bn: "প্রাইমারি" },
  { en: "Recent payment requests", bn: "সাম্প্রতিক পেমেন্ট রিকোয়েস্ট" },
  { en: "Submitted", bn: "জমা দেওয়া হয়েছে" },
  { en: "No payment requests for this agency.", bn: "এই এজেন্সির জন্য কোনো পেমেন্ট রিকোয়েস্ট নেই।" },
  { en: "Subscription history", bn: "সাবস্ক্রিপশন ইতিহাস" },
  { en: "Action", bn: "অ্যাকশন" },
  { en: "Old plan", bn: "আগের প্ল্যান" },
  { en: "New plan", bn: "নতুন প্ল্যান" },
  { en: "No subscription history yet.", bn: "এখনো কোনো সাবস্ক্রিপশন ইতিহাস নেই।" },
  { en: "Activate or change plan", bn: "প্ল্যান অ্যাক্টিভ বা পরিবর্তন করুন" },
  { en: "Extend subscription", bn: "সাবস্ক্রিপশন এক্সটেন্ড করুন" },
  { en: "Skip trial and activate paid plan", bn: "ট্রায়াল শেষ করে পেইড প্ল্যান অ্যাক্টিভ করুন" },
  { en: "Suspend subscription", bn: "সাবস্ক্রিপশন সাসপেন্ড করুন" },
  { en: "Target plan", bn: "টার্গেট প্ল্যান" },
  { en: "Billing cycle", bn: "বিলিং সাইকেল" },
  { en: "Monthly", bn: "মাসিক" },
  { en: "Yearly", bn: "বার্ষিক" },
  { en: "Extend by months", bn: "কত মাস বাড়াবেন" },
  { en: "Note", bn: "নোট" },
  { en: "Optional admin note", bn: "ঐচ্ছিক অ্যাডমিন নোট" },
  { en: "Saving...", bn: "সংরক্ষণ হচ্ছে..." },
  { en: "Confirm", bn: "নিশ্চিত করুন" },
  { en: "Loading tenant details...", bn: "টেন্যান্ট তথ্য লোড হচ্ছে..." },
  { en: "Tenant not found.", bn: "টেন্যান্ট পাওয়া যায়নি।" },
  { en: "Tenant subscription updated", bn: "টেন্যান্ট সাবস্ক্রিপশন আপডেট হয়েছে" },
  { en: "Action failed", bn: "অ্যাকশন ব্যর্থ হয়েছে" },
];

const EN_TO_BN = new Map(EXACT_TRANSLATIONS.map((entry) => [entry.en, entry.bn]));
const BN_TO_EN = new Map(EXACT_TRANSLATIONS.map((entry) => [entry.bn, entry.en]));

const toBanglaDigits = (value: string) => value.replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)] || digit);
const toEnglishDigits = (value: string) => value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));

const translateDynamic = (value: string, target: "bn" | "en") => {
  if (target === "bn") {
    return value
      .replace(/^(\d+) characters$/u, (_, count) => `${toBanglaDigits(count)} অক্ষর`)
      .replace(/^(\d+) characters · Detected variables: (.+)$/u, (_, count, vars) => `${toBanglaDigits(count)} অক্ষর · শনাক্ত ভ্যারিয়েবল: ${vars === "none" ? "কোনোটি নেই" : vars}`)
      .replace(/^Page (\d+) of (\d+) · (\d+) total logs$/u, (_, page, totalPages, totalLogs) => `পৃষ্ঠা ${toBanglaDigits(page)} / ${toBanglaDigits(totalPages)} · মোট ${toBanglaDigits(totalLogs)} টি লগ`)
      .replace(/^(.+) permissions reset to defaults$/u, (_, label) => `${label} পারমিশন ডিফল্টে রিসেট হয়েছে`)
      .replace(/^(\d+)% features enabled$/u, (_, percent) => `${toBanglaDigits(percent)}% ফিচার চালু`)
      .replace(/^(\d+)d$/u, (_, days) => `${toBanglaDigits(days)} দিন`)
      .replace(/^Expected: (.+)$/u, (_, content) => `প্রত্যাশিত: ${content}`);
  }

  return toEnglishDigits(value)
    .replace(/^(\d+) অক্ষর$/u, (_, count) => `${count} characters`)
    .replace(/^(\d+) অক্ষর · শনাক্ত ভ্যারিয়েবল: (.+)$/u, (_, count, vars) => `${count} characters · Detected variables: ${vars === "কোনোটি নেই" ? "none" : vars}`)
    .replace(/^পৃষ্ঠা (\d+) \/ (\d+) · মোট (\d+) টি লগ$/u, (_, page, totalPages, totalLogs) => `Page ${page} of ${totalPages} · ${totalLogs} total logs`)
    .replace(/^(.+) পারমিশন ডিফল্টে রিসেট হয়েছে$/u, (_, label) => `${label} permissions reset to defaults`)
    .replace(/^(\d+)% ফিচার চালু$/u, (_, percent) => `${percent}% features enabled`)
    .replace(/^(\d+) দিন$/u, (_, days) => `${days}d`)
    .replace(/^প্রত্যাশিত: (.+)$/u, (_, content) => `Expected: ${content}`);
};

const translateText = (value: string, target: "bn" | "en") => {
  const exact = target === "bn" ? EN_TO_BN.get(value) : BN_TO_EN.get(value);
  return exact || translateDynamic(value, target);
};

const translateDom = (root: ParentNode, target: "bn" | "en") => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parentTag = node.parentElement?.tagName?.toLowerCase();
    if (["script", "style", "noscript"].includes(parentTag || "")) continue;
    nodes.push(node);
  }

  nodes.forEach((node) => {
    const raw = node.textContent || "";
    const trimmed = raw.trim();
    if (!trimmed) return;
    const translated = translateText(trimmed, target);
    if (translated !== trimmed) {
      node.textContent = raw.replace(trimmed, translated);
    }
  });

  document.body.querySelectorAll<HTMLElement>("*").forEach((element) => {
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const translated = translateText(current, target);
      if (translated !== current) {
        element.setAttribute(attribute, translated);
      }
    });
  });
};

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "A";

  useEffect(() => {
    const target: "bn" | "en" = String(i18n.resolvedLanguage || i18n.language || "en").toLowerCase().startsWith("bn") ? "bn" : "en";
    let frame = 0;
    const run = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => translateDom(document.body, target));
    };

    run();
    const observer = new MutationObserver(() => run());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [i18n.language, i18n.resolvedLanguage]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-card px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <AdminNotificationBell />
              <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-destructive text-destructive-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;