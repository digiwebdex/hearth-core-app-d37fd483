import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import SmtpSettings from "@/components/SmtpSettings";
import DataExport from "@/components/DataExport";
import ModuleSettings from "@/components/ModuleSettings";
import { CreditCard, ArrowRight } from "lucide-react";

const SettingsPage = () => {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.settingsTitle")}</h1>
          <p className="text-muted-foreground">{t("pages.settingsSubtitle")}</p>
        </div>

        <ModuleSettings />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> {t("pages.billingSection")}
                </CardTitle>
                <CardDescription>{t("pages.billingDesc")}</CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link to="/settings/billing">
                  {t("pages.manageBilling")} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("pages.profile")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.fullName")}</Label>
              <Input placeholder={t("common.fullName")} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input type="email" placeholder="you@example.com" disabled />
            </div>
            <Button>{t("pages.updateProfile")}</Button>
          </CardContent>
        </Card>
        <SmtpSettings />
        <DataExport />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Tax &amp; VAT Rules
                </CardTitle>
                <CardDescription>Configure tax rates for invoices and quotations</CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link to="/settings/tax">
                  Manage Tax Rules <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
