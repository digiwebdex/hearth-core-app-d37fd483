import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";

interface AdminConfigNoticeProps {
  sourceFile: string;
}

/** Explains that admin plan/feature/role screens are code-managed previews. */
const AdminConfigNotice = ({ sourceFile }: AdminConfigNoticeProps) => {
  const { i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");

  return (
    <Alert className="border-amber-500/30 bg-amber-500/5">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle>{isBn ? "প্রিভিউ মোড" : "Preview mode"}</AlertTitle>
      <AlertDescription>
        {isBn
          ? `এই স্ক্রিন শুধু প্রিভিউ। রানটাইম কনফিগারেশন কোডে (${sourceFile}) সংরক্ষিত। এখানে সংরক্ষণ করলে লাইভ সিস্টেমে প্রভাব পড়বে না।`
          : `This screen is preview-only. Live configuration is managed in code (${sourceFile}). Saving here does not affect the running system.`}
      </AlertDescription>
    </Alert>
  );
};

export default AdminConfigNotice;
