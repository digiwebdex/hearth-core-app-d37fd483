import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Moon, Package2 } from "lucide-react";

const HajjOperationsLegacy = () => {
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const text = {
    title: isBn ? "লেগেসি হজ্জ অপারেশনস" : "Legacy Hajj Operations",
    subtitle: isBn
      ? "নতুন নেভিগেশন অনুযায়ী Hajj/Umrah package template এখন ‘প্যাকেজ ও সার্ভিসেস’ মডিউলে আছে। এই সেকশনটি শুধু পুরনো pilgrim, group, visa, payment operations-এর জন্য রাখা হয়েছে।"
      : "Under the new navigation, Hajj/Umrah package templates now live inside the ‘Packages & Services’ module. This section remains only for legacy pilgrim, group, visa, and payment operations.",
    unifiedTitle: isBn ? "নতুন কোথায় কী আছে" : "Where things are now",
    unifiedPackages: isBn ? "Hajj/Umrah package template, pricing, itinerary, publish settings → প্যাকেজ ও সার্ভিসেস" : "Hajj/Umrah package template, pricing, itinerary, publish settings → Packages & Services",
    legacyOps: isBn ? "Pilgrim, group, rooming, payment collection, visa progress → লেগেসি হজ্জ অপারেশনস" : "Pilgrim, group, rooming, payment collection, visa progress → Legacy Hajj Operations",
    publicText: isBn ? "Published package website package page-এ দেখা যাবে।" : "Published packages will appear on the website packages page.",
    packagesBtn: isBn ? "প্যাকেজ ও সার্ভিসেস" : "Packages & Services",
    operationsBtn: isBn ? "লেগেসি অপারেশনস খুলুন" : "Open Legacy Operations",
    publicBtn: isBn ? "পাবলিক প্যাকেজ পেজ" : "Public Packages Page",
    noteTitle: isBn ? "সেফ ট্রানজিশন নোট" : "Safe transition note",
    noteText: isBn ? "নেভিগেশন merge করা হয়েছে যাতে নতুন user-দের জন্য system সহজ হয়। পুরনো Hajj operations flow এখনো delete করা হয়নি।" : "The navigation has been merged to make the system easier for new users. The old Hajj operations flow has not been removed.",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Moon className="h-7 w-7" /> {text.title}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">{text.subtitle}</p>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{text.unifiedTitle}</CardTitle>
            <CardDescription>{text.publicText}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium flex items-center gap-2"><Package2 className="h-4 w-4" /> {text.unifiedPackages}</div>
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium flex items-center gap-2"><Moon className="h-4 w-4" /> {text.legacyOps}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link to="/travel-packages">
                <Button><Package2 className="mr-2 h-4 w-4" />{text.packagesBtn}</Button>
              </Link>
              <Link to="/hajj-umrah">
                <Button variant="secondary"><Moon className="mr-2 h-4 w-4" />{text.operationsBtn}</Button>
              </Link>
              <Link to="/site/packages">
                <Button variant="outline"><Globe className="mr-2 h-4 w-4" />{text.publicBtn}<ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{text.noteTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{text.noteText}</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default HajjOperationsLegacy;
