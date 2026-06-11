import { useTranslation } from "react-i18next";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HajjPilgrim } from "@/lib/hajjApi";

interface Props {
  pilgrim: HajjPilgrim;
  packageName: string;
  groupName: string;
}

export function HajjPilgrimDetails({ pilgrim, packageName, groupName }: Props) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("hajjForm.pilgrimDetail")} — {pilgrim.name}</CardTitle>
        <CardDescription>{packageName} • {groupName}</CardDescription>
      </CardHeader>
    </Card>
  );
}
