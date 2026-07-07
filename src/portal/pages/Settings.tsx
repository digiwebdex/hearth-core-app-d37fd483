import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Globe, LogOut, UserCog } from "lucide-react";
import { clearPortalToken, portalApi } from "@/lib/portalApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: profile } = useQuery({ queryKey: ["portal-profile"], queryFn: portalApi.getProfile });
  const isBn = i18n.language?.startsWith("bn");

  const setLang = (lng: "en" | "bn") => i18n.changeLanguage(lng);
  const logout = () => { clearPortalToken(); navigate("/login"); };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><UserCog className="h-6 w-6" /> {t("portal.settings", { defaultValue: "Account settings" })}</h1>
        <p className="text-sm text-muted-foreground">{profile?.email}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> {t("portal.language", { defaultValue: "Language" })}</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Button variant={!isBn ? "default" : "outline"} size="sm" onClick={() => setLang("en")}>English</Button>
          <Button variant={isBn ? "default" : "outline"} size="sm" onClick={() => setLang("bn")}>বাংলা</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("portal.account", { defaultValue: "Account" })}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Link to="/profile"><Button variant="outline" className="w-full justify-start">{t("portal.editProfile", { defaultValue: "Edit contact details" })}</Button></Link>
          <Button variant="destructive" className="w-full justify-start" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> {t("portal.signOut", { defaultValue: "Sign out" })}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
