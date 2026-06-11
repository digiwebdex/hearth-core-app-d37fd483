import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import type { HajjPilgrim, HajjPilgrimPayment } from "@/lib/hajjApi";

interface Props {
  pilgrim: HajjPilgrim;
  payments: HajjPilgrimPayment[];
}

export function HajjPilgrimTabs({ pilgrim, payments }: Props) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">{t("hajjForm.tabs.info")}</TabsTrigger>
            <TabsTrigger value="payments">{t("hajjForm.tabs.payments")}</TabsTrigger>
            <TabsTrigger value="documents">{t("hajjForm.tabs.documents")}</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
              <div><div className="text-muted-foreground">{t("hajjForm.fields.passport")}</div><div className="font-medium">{pilgrim.passportNumber}</div></div>
              <div><div className="text-muted-foreground">{t("hajjForm.fields.nid")}</div><div className="font-medium">{pilgrim.nidNumber || "—"}</div></div>
              <div><div className="text-muted-foreground">{t("hajjForm.fields.mahramName")}</div><div className="font-medium">{pilgrim.mahramName || "—"}</div></div>
              <div><div className="text-muted-foreground">{t("hajjForm.fields.roomType")}</div><div className="font-medium">{pilgrim.roomType || "—"}{pilgrim.roomNumber ? ` • ${pilgrim.roomNumber}` : ""}</div></div>
            </div>
            {pilgrim.medicalNotes ? <p className="text-sm"><span className="text-muted-foreground">{t("hajjForm.fields.medicalNotes")}: </span>{pilgrim.medicalNotes}</p> : null}
            {pilgrim.notes ? <p className="text-sm"><span className="text-muted-foreground">{t("hajjForm.fields.notes")}: </span>{pilgrim.notes}</p> : null}
          </TabsContent>
          <TabsContent value="payments" className="mt-4">
            <Separator className="mb-4" />
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("hajjForm.noPayments")}</p>
            ) : (
              <div className="space-y-2">
                {payments.map((pay) => (
                  <div key={pay.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <div className="font-medium">৳{pay.amount.toLocaleString()} • {pay.method}</div>
                      <div className="text-xs text-muted-foreground">{pay.date}{pay.installmentLabel ? ` • ${pay.installmentLabel}` : ""}{pay.reference ? ` • ${pay.reference}` : ""}</div>
                    </div>
                    <Badge variant="secondary">{t("hajjForm.paymentReceived")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <p className="text-sm text-muted-foreground">{t("hajjForm.documentsPlaceholder")}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
