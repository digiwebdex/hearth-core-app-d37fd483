import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { portalApi } from "@/lib/portalApi";
import { toast } from "@/hooks/use-toast";

export default function PortalLogin() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await portalApi.requestMagicLink(email);
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Plane className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t("portal.loginTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("portal.loginHint")}</p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-3 py-6">
              <p className="text-sm">{t("portal.checkEmail", { email })}</p>
              <p className="text-xs text-muted-foreground">{t("portal.linkExpires")}</p>
              <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
                {t("portal.differentEmail")}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("portal.sending") : t("portal.sendLink")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
