import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { portalApi, setPortalToken } from "@/lib/portalApi";

export default function PortalVerify() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing token");
      return;
    }
    portalApi
      .verify(token)
      .then((s) => {
        setPortalToken(s.token);
        const path = s.roles.includes("customer")
          ? "/bookings"
          : s.roles.includes("agent")
            ? "/agent"
            : "/purchase-orders";
        navigate(path, { replace: true });
      })
      .catch((e) => setError(e.message));
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {error ? (
        <div className="text-center space-y-2">
          <p className="text-destructive">{error}</p>
          <a href="/login" className="text-sm underline">
            {t("portal.requestNewLink")}
          </a>
        </div>
      ) : (
        <p className="text-muted-foreground">{t("portal.signingIn")}</p>
      )}
    </div>
  );
}
