import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { financeApi, type FinanceRemindersPayload } from "@/lib/api";
import { Bell, Send, Eye, AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FinanceReminders = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<FinanceRemindersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await financeApi.getReminders());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("financeReminders.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const sendReminder = async (invoiceId: string) => {
    try {
      await financeApi.sendInvoiceReminder(invoiceId);
      toast({ title: t("financeReminders.sent") });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("financeReminders.sendFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (loading) return <DashboardLayout><LoadingState rows={6} /></DashboardLayout>;
  if (error || !data) {
    return (
      <DashboardLayout>
        <ErrorState message={error || t("financeReminders.loadFailed")} onRetry={load} />
      </DashboardLayout>
    );
  }

  const stats = [
    { label: t("financeReminders.stats.overdueInvoices"), value: data.counts.overdueInvoices, icon: AlertTriangle },
    { label: t("financeReminders.stats.dueSoonInvoices"), value: data.counts.dueSoonInvoices, icon: Clock },
    { label: t("financeReminders.stats.overdueInstallments"), value: data.counts.overdueInstallments, icon: AlertTriangle },
    { label: t("financeReminders.stats.dueSoonInstallments"), value: data.counts.dueSoonInstallments, icon: Clock },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-8 w-8" />
            {t("financeReminders.title")}
          </h1>
          <p className="text-muted-foreground">{t("financeReminders.subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("financeReminders.overdueInvoicesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.overdueInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">{t("financeReminders.none")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("financeReminders.invoice")}</TableHead>
                    <TableHead>{t("financeReminders.client")}</TableHead>
                    <TableHead>{t("financeReminders.dueDate")}</TableHead>
                    <TableHead className="text-right">{t("financeReminders.dueAmount")}</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overdueInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber || inv.id.slice(0, 8)}</TableCell>
                      <TableCell>{inv.clientName || "—"}</TableCell>
                      <TableCell>{inv.dueDate || "—"}</TableCell>
                      <TableCell className="text-right">৳{inv.dueAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices?open=${inv.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => sendReminder(inv.id)}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("financeReminders.overdueInstallmentsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.overdueInstallments.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">{t("financeReminders.none")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("financeReminders.installment")}</TableHead>
                    <TableHead>{t("financeReminders.invoice")}</TableHead>
                    <TableHead>{t("financeReminders.dueDate")}</TableHead>
                    <TableHead className="text-right">{t("financeReminders.remaining")}</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overdueInstallments.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>{row.invoice?.invoiceNumber || row.invoice?.clientName || "—"}</TableCell>
                      <TableCell>{row.dueDate || "—"}</TableCell>
                      <TableCell className="text-right">৳{(row.amount - row.paidAmount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices?open=${row.invoiceId}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          {t("financeReminders.footer")}{" "}
          <Link to="/commissions" className="underline">{t("sidebar.commissions")}</Link>
          {" · "}
          <Link to="/accounts" className="underline">{t("sidebar.accounts")}</Link>
        </p>
      </div>
    </DashboardLayout>
  );
};

export default FinanceReminders;
