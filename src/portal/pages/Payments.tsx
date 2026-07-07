import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { portalApi } from "@/lib/portalApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate } from "../lib/format";

export default function Payments() {
  const { t } = useTranslation();
  const payments = useQuery({ queryKey: ["portal-payments"], queryFn: portalApi.payments });
  const invoices = useQuery({ queryKey: ["portal-invoices"], queryFn: portalApi.invoices });

  const due = (invoices.data || []).filter((i) => (i.dueAmount || 0) > 0).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const totalDue = due.reduce((s, i) => s + (i.dueAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("portal.payments", { defaultValue: "Payments" })}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.paymentsHint", { defaultValue: "Your payment history and outstanding dues." })}</p>
      </div>

      {/* Due payments */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("portal.duePayments", { defaultValue: "Due payments" })}</CardTitle>
          {totalDue > 0 && <Badge variant="destructive">{t("portal.due")}: {formatMoney(totalDue)}</Badge>}
        </CardHeader>
        <CardContent>
          {invoices.isLoading ? <Skeleton className="h-16 w-full" /> : due.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("portal.noDues", { defaultValue: "You're all paid up — no dues." })}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("portal.invoice", { defaultValue: "Invoice" })}</TableHead>
                  <TableHead>{t("portal.dueDate", { defaultValue: "Due date" })}</TableHead>
                  <TableHead className="text-right">{t("portal.amountDue", { defaultValue: "Amount due" })}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {due.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.invoiceNumber || i.id.slice(0, 8)}</TableCell>
                      <TableCell>{formatDate(i.dueDate)}</TableCell>
                      <TableCell className="text-right text-destructive font-medium">{formatMoney(i.dueAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("portal.paymentHistory", { defaultValue: "Payment history" })}</CardTitle></CardHeader>
        <CardContent>
          {payments.isLoading ? <Skeleton className="h-24 w-full" /> : (payments.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("portal.noPayments", { defaultValue: "No payments recorded yet." })}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t("portal.date", { defaultValue: "Date" })}</TableHead>
                  <TableHead>{t("portal.method", { defaultValue: "Method" })}</TableHead>
                  <TableHead>{t("portal.invoice", { defaultValue: "Invoice" })}</TableHead>
                  <TableHead className="text-right">{t("portal.amount", { defaultValue: "Amount" })}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payments.data!.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.date)}</TableCell>
                      <TableCell className="capitalize">{p.method || "—"}</TableCell>
                      <TableCell>{p.invoiceNumber || "—"}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">{formatMoney(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
