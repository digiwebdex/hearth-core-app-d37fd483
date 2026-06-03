import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard, MessageSquare, Globe, BarChart3, Settings, Save, Loader2, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  FEATURE_DEFINITIONS, FEATURE_CATEGORIES, DEFAULT_FEATURE_MAP,
  type FeaturePlanMap,
} from "@/lib/features";
import type { PlanType } from "@/lib/plans";

const PLAN_ORDER: PlanType[] = ["free", "basic", "pro", "business", "enterprise"];

const AdminFeatures = () => {
  const [featureMap, setFeatureMap] = useState<FeaturePlanMap>(
    JSON.parse(JSON.stringify(DEFAULT_FEATURE_MAP))
  );
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  const text = {
    title: isBn ? "ফিচার কন্ট্রোল" : "Feature Control",
    subtitle: isBn ? "প্রতি সাবস্ক্রিপশন প্ল্যানে ফিচার চালু বা বন্ধ করুন" : "Toggle features per subscription plan",
    resetDefaults: isBn ? "ডিফল্টে রিসেট করুন" : "Reset Defaults",
    saveChanges: isBn ? "পরিবর্তন সংরক্ষণ করুন" : "Save Changes",
    resetDone: isBn ? "ডিফল্টে রিসেট হয়েছে" : "Reset to defaults",
    saveDone: isBn ? "ফিচার কনফিগারেশন সংরক্ষিত হয়েছে" : "Feature configuration saved",
    saveDesc: isBn ? "পরিবর্তন তাৎক্ষণিকভাবে সব টেন্যান্টে প্রযোজ্য হবে।" : "Changes will affect all tenants immediately.",
    enabledFeatures: isBn ? "ফিচার চালু" : "features enabled",
    allOn: isBn ? "সব চালু" : "All On",
    allOff: isBn ? "সব বন্ধ" : "All Off",
    allFeatures: isBn ? "সব ফিচার" : "All Features",
    feature: isBn ? "ফিচার" : "Feature",
  };

  const planLabel = (plan: PlanType) => {
    const map: Record<PlanType, string> = {
      free: isBn ? "ফ্রি" : "free",
      basic: isBn ? "বেসিক" : "basic",
      pro: isBn ? "প্রো" : "pro",
      business: isBn ? "বিজনেস" : "business",
      enterprise: isBn ? "এন্টারপ্রাইজ" : "enterprise",
    };
    return map[plan];
  };

  const categoryLabel = (id: string, fallback: string) => {
    const map: Record<string, string> = {
      payment: isBn ? "পেমেন্ট" : "Payment",
      communication: isBn ? "কমিউনিকেশন" : "Communication",
      website: isBn ? "ওয়েবসাইট" : "Website",
      analytics: isBn ? "অ্যানালিটিক্স" : "Analytics",
      core: isBn ? "মূল" : "Core",
    };
    return map[id] || fallback;
  };

  const featureLabel = (id: string, fallback: string) => {
    const map: Record<string, string> = {
      custom_domain: isBn ? "কাস্টম ডোমেইন" : fallback,
      sms_notifications: isBn ? "এসএমএস নোটিফিকেশন" : fallback,
      whatsapp_notifications: isBn ? "হোয়াটসঅ্যাপ নোটিফিকেশন" : fallback,
      payment_gateway: isBn ? "পেমেন্ট গেটওয়ে" : fallback,
      theme_builder: isBn ? "থিম বিল্ডার" : fallback,
      analytics_dashboard: isBn ? "অ্যানালিটিক্স ড্যাশবোর্ড" : fallback,
      leads_crm: isBn ? "লিডস সিআরএম" : fallback,
      invoicing: isBn ? "ইনভয়েসিং" : fallback,
      multi_user_team: isBn ? "মাল্টি-ইউজার টিম" : fallback,
    };
    return map[id] || fallback;
  };

  const featureDescription = (id: string, fallback: string) => {
    const map: Record<string, string> = {
      custom_domain: isBn ? "এজেন্সির ওয়েবসাইটে নিজস্ব ডোমেইন ব্যবহার করুন" : fallback,
      sms_notifications: isBn ? "এসএমএস অ্যালার্ট ও নোটিফিকেশন পাঠান" : fallback,
      whatsapp_notifications: isBn ? "হোয়াটসঅ্যাপ নোটিফিকেশন পাঠান" : fallback,
      payment_gateway: isBn ? "অনলাইন পেমেন্ট গেটওয়ে সক্রিয় করুন" : fallback,
      theme_builder: isBn ? "ওয়েবসাইট ডিজাইন ও থিম কাস্টমাইজ করুন" : fallback,
      analytics_dashboard: isBn ? "উন্নত রিপোর্ট ও অ্যানালিটিক্স দেখুন" : fallback,
      leads_crm: isBn ? "লিড ম্যানেজমেন্ট ও ফলো-আপ সিস্টেম" : fallback,
      invoicing: isBn ? "ইনভয়েস ও পেমেন্ট ব্যবস্থাপনা" : fallback,
      multi_user_team: isBn ? "একাধিক ইউজার ও টিম পারমিশন ব্যবহার করুন" : fallback,
    };
    return map[id] || fallback;
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    payment: <CreditCard className="h-4 w-4" />,
    communication: <MessageSquare className="h-4 w-4" />,
    website: <Globe className="h-4 w-4" />,
    analytics: <BarChart3 className="h-4 w-4" />,
    core: <Settings className="h-4 w-4" />,
  };

  const toggleFeature = (featureId: string, plan: PlanType) => {
    setFeatureMap((prev) => ({
      ...prev,
      [featureId]: {
        ...prev[featureId],
        [plan]: !prev[featureId]?.[plan],
      },
    }));
  };

  const enableAllForPlan = (plan: PlanType) => {
    setFeatureMap((prev) => {
      const next = { ...prev };
      for (const fId of Object.keys(next)) next[fId] = { ...next[fId], [plan]: true };
      return next;
    });
  };

  const disableAllForPlan = (plan: PlanType) => {
    setFeatureMap((prev) => {
      const next = { ...prev };
      for (const fId of Object.keys(next)) next[fId] = { ...next[fId], [plan]: false };
      return next;
    });
  };

  const resetToDefaults = () => {
    setFeatureMap(JSON.parse(JSON.stringify(DEFAULT_FEATURE_MAP)));
    toast({ title: text.resetDone });
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast({ title: text.saveDone, description: text.saveDesc });
  };

  const countEnabled = (plan: PlanType) => Object.values(featureMap).filter((m) => m[plan]).length;
  const totalFeatures = FEATURE_DEFINITIONS.length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8" /> {text.title}
            </h1>
            <p className="text-muted-foreground">{text.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetToDefaults}>{text.resetDefaults}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {text.saveChanges}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-5">
          {PLAN_ORDER.map((plan) => {
            const enabled = countEnabled(plan);
            const pct = Math.round((enabled / totalFeatures) * 100);
            return (
              <Card key={plan}>
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <Badge variant="secondary" className="capitalize text-sm">{planLabel(plan)}</Badge>
                    <p className="text-2xl font-bold">{enabled}/{totalFeatures}</p>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{pct}% {text.enabledFeatures}</p>
                    <div className="flex gap-1 pt-1">
                      <Button size="sm" variant="ghost" className="text-xs flex-1" onClick={() => enableAllForPlan(plan)}>{text.allOn}</Button>
                      <Button size="sm" variant="ghost" className="text-xs flex-1" onClick={() => disableAllForPlan(plan)}>{text.allOff}</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">{text.allFeatures}</TabsTrigger>
            {FEATURE_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5">
                {categoryIcons[cat.id]} {categoryLabel(cat.id, cat.label)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">
            <FeatureTable
              features={FEATURE_DEFINITIONS}
              featureMap={featureMap}
              onToggle={toggleFeature}
              isBn={isBn}
              planLabel={planLabel}
              featureLabel={featureLabel}
              featureDescription={featureDescription}
              featureHeading={text.feature}
            />
          </TabsContent>

          {FEATURE_CATEGORIES.map((cat) => (
            <TabsContent key={cat.id} value={cat.id}>
              <FeatureTable
                features={FEATURE_DEFINITIONS.filter((f) => f.category === cat.id)}
                featureMap={featureMap}
                onToggle={toggleFeature}
                isBn={isBn}
                planLabel={planLabel}
                featureLabel={featureLabel}
                featureDescription={featureDescription}
                featureHeading={text.feature}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
};

function FeatureTable({
  features,
  featureMap,
  onToggle,
  planLabel,
  featureLabel,
  featureDescription,
  featureHeading,
}: {
  features: typeof FEATURE_DEFINITIONS;
  featureMap: FeaturePlanMap;
  onToggle: (featureId: string, plan: PlanType) => void;
  isBn: boolean;
  planLabel: (plan: PlanType) => string;
  featureLabel: (id: string, fallback: string) => string;
  featureDescription: (id: string, fallback: string) => string;
  featureHeading: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">{featureHeading}</TableHead>
              {PLAN_ORDER.map((plan) => (
                <TableHead key={plan} className="text-center capitalize">{planLabel(plan)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((feature) => (
              <TableRow key={feature.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{featureLabel(feature.id, feature.name)}</p>
                    <p className="text-xs text-muted-foreground">{featureDescription(feature.id, feature.description)}</p>
                  </div>
                </TableCell>
                {PLAN_ORDER.map((plan) => {
                  const enabled = featureMap[feature.id]?.[plan] ?? false;
                  return (
                    <TableCell key={plan} className="text-center">
                      <div className="flex justify-center">
                        <Switch checked={enabled} onCheckedChange={() => onToggle(feature.id, plan)} />
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default AdminFeatures;
