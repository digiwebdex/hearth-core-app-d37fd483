import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight, X, BookOpen } from "lucide-react";
import {
  clientApi,
  leadApi,
  quotationApi,
  bookingApi,
  invoiceApi,
  tenantApi,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "taw_onboarding_checklist_dismissed";

type StepDef = {
  id: string;
  done: boolean;
  labelBn: string;
  labelEn: string;
  path: string;
};

export function OnboardingChecklist() {
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const navigate = useNavigate();
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    if (dismissed) return;
    (async () => {
      try {
        const [leads, clients, quotations, bookings, invoices, members] = await Promise.all([
          leadApi.list().catch(() => []),
          clientApi.list().catch(() => []),
          quotationApi.list().catch(() => []),
          bookingApi.list().catch(() => []),
          invoiceApi.list().catch(() => []),
          tenantApi.getMembers().catch(() => []),
        ]);
        const hasServices = clients.length > 0 || bookings.length > 0;
        setSteps([
          {
            id: "lead",
            done: leads.length > 0,
            labelBn: "প্রথম লিড যোগ করুন",
            labelEn: "Add your first lead",
            path: "/leads",
          },
          {
            id: "client",
            done: clients.length > 0,
            labelBn: "ক্লায়েন্ট তৈরি করুন",
            labelEn: "Create a client",
            path: "/clients",
          },
          {
            id: "quote",
            done: quotations.length > 0,
            labelBn: "কোটেশন পাঠান",
            labelEn: "Send a quotation",
            path: "/quotations/new",
          },
          {
            id: "booking",
            done: bookings.length > 0,
            labelBn: "বুকিং নিশ্চিত করুন",
            labelEn: "Confirm a booking",
            path: "/bookings",
          },
          {
            id: "invoice",
            done: invoices.length > 0,
            labelBn: "ইনভয়েস তৈরি করুন",
            labelEn: "Create an invoice",
            path: "/invoices",
          },
          {
            id: "team",
            done: members.length > 1,
            labelBn: "টিম মেম্বার আমন্ত্রণ",
            labelEn: "Invite a team member",
            path: "/team",
          },
          {
            id: "catalog",
            done: hasServices,
            labelBn: "সার্ভিস ক্যাটালগ সেটআপ",
            labelEn: "Set up service catalog",
            path: "/packages/all",
          },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [dismissed]);

  if (dismissed || loading || steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const nextStep = steps.find((s) => !s.done);

  if (doneCount === steps.length) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            {isBn ? "অনবোর্ডিং সম্পন্ন — আপনি প্রস্তুত!" : "Onboarding complete — you're ready!"}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">
              {isBn ? "শুরু করার চেকলিস্ট" : "Getting started checklist"}
            </CardTitle>
            <CardDescription>
              {isBn
                ? `${doneCount}/${steps.length} সম্পন্ন — ৬ ধাপে আপনার এজেন্সি চালু করুন`
                : `${doneCount}/${steps.length} done — launch your agency in 6 steps`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => !step.done && navigate(step.path)}
            className={cn(
              "w-full flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
              step.done ? "text-muted-foreground" : "hover:bg-muted/60 cursor-pointer",
            )}
          >
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className={step.done ? "line-through" : ""}>{isBn ? step.labelBn : step.labelEn}</span>
          </button>
        ))}
        {nextStep && (
          <Button className="w-full mt-2" onClick={() => navigate(nextStep.path)}>
            {isBn ? "পরবর্তী:" : "Next:"} {isBn ? nextStep.labelBn : nextStep.labelEn}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" className="w-full" onClick={() => navigate("/user-guide")}>
          <BookOpen className="mr-2 h-4 w-4" />
          {isBn ? "বাংলা ইউজার গাইড দেখুন" : "Open user guide"}
        </Button>
      </CardContent>
    </Card>
  );
}
