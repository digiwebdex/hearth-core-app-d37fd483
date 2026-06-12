import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STORAGE_KEY = "hearth.productHelp.dismissed";

export default function ProductHelpBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Alert className="relative border-primary/30 bg-primary/5">
      <Info className="h-4 w-4" />
      <AlertTitle>{t("productHelp.title")}</AlertTitle>
      <AlertDescription className="space-y-2 pr-8">
        <p>{t("productHelp.intro")}</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>{t("productHelp.catalog")}</li>
          <li>{t("productHelp.bookings")}</li>
          <li>{t("productHelp.hajjOps")}</li>
        </ul>
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8"
        onClick={dismiss}
        aria-label={t("productHelp.dismiss")}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
