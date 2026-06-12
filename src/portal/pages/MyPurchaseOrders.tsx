import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { portalApi } from "@/lib/portalApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatMoney(n: number) {
  return `৳${n.toLocaleString()}`;
}

export default function MyPurchaseOrders() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-pos"],
    queryFn: portalApi.purchaseOrders,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("portal.purchaseOrders")}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.purchaseOrdersHint")}</p>
      </div>

      {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {data && data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("portal.noPurchaseOrders")}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {data?.map((po) => (
          <Card key={po.id}>
            <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{po.description}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {po.tenantName ? `${t("portal.fromAgency")}: ${po.tenantName} · ` : ""}
                  {new Date(po.createdAt).toLocaleDateString()}
                  {po.dueDate ? ` · ${t("portal.due")} ${po.dueDate}` : ""}
                </div>
              </div>
              <div className="text-right space-y-1">
                <Badge>{po.status}</Badge>
                <div className="text-sm">
                  {formatMoney(po.paidAmount)} / {formatMoney(po.totalAmount)}
                </div>
                {po.dueAmount > 0 && (
                  <div className="text-xs text-destructive">
                    {t("portal.due")}: {formatMoney(po.dueAmount)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
