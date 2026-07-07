import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plane, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { portalApi } from "@/lib/portalApi";
import { toast } from "@/hooks/use-toast";

// Registration for a passwordless, invite-driven portal: a customer already
// exists as a Client created by their travel agency. Entering their email sends
// a secure sign-in link (reuses /portal/auth/request-link — no new account is
// minted here, which keeps tenant isolation intact).
export default function Register() {
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
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
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
          <CardTitle>{t("portal.registerTitle", { defaultValue: "Get portal access" })}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("portal.registerHint", { defaultValue: "Enter the email your travel agency has on file. We'll email you a secure sign-in link — no password needed." })}
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-3 py-6">
              <MailCheck className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="text-sm">{t("portal.checkEmail", { email })}</p>
              <p className="text-xs text-muted-foreground">
                {t("portal.registerNoAccount", { defaultValue: "If no account exists for this email, please ask your travel agency to add you as a client." })}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSent(false)}>{t("portal.differentEmail")}</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("portal.sending") : t("portal.sendLink")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("portal.haveAccess", { defaultValue: "Already have access?" })}{" "}
                <Link to="/login" className="text-primary hover:underline">{t("portal.signIn", { defaultValue: "Sign in" })}</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
