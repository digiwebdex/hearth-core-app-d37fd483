import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clientApi, type CorporateSummary } from "@/lib/api";
import { Building2, Eye, Plus } from "lucide-react";

const money = (n: number) => `৳${n.toLocaleString()}`;

const CorporateTravel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [summary, setSummary] = useState<CorporateSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientApi.getCorporateSummary(month);
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-7 w-7" />
              {t("corporate.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("corporate.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" onClick={() => navigate("/clients")}>
              <Plus className="mr-2 h-4 w-4" />
              {t("corporate.manageClients")}
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : !summary || summary.clients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t("corporate.emptyTitle")}
            description={t("corporate.emptyDesc")}
            action={
              <Button onClick={() => navigate("/clients")}>{t("corporate.addCorporateClient")}</Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("corporate.kpiClients")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary.totals.clients}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("corporate.kpiInvoices")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{summary.totals.invoiceCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("corporate.kpiBilled")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{money(summary.totals.monthTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("corporate.kpiDue")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-600">{money(summary.totals.monthDue)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("corporate.colCompany")}</TableHead>
                      <TableHead>{t("corporate.colContact")}</TableHead>
                      <TableHead className="text-right">{t("corporate.colInvoices")}</TableHead>
                      <TableHead className="text-right">{t("corporate.colBilled")}</TableHead>
                      <TableHead className="text-right">{t("corporate.colPaid")}</TableHead>
                      <TableHead className="text-right">{t("corporate.colDue")}</TableHead>
                      <TableHead className="text-right">{t("corporate.colOpen")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.clients.map((row) => (
                      <TableRow key={row.clientId}>
                        <TableCell>
                          <div className="font-medium">{row.companyName}</div>
                          <div className="text-xs text-muted-foreground">{row.name}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.phone || row.email || "—"}
                        </TableCell>
                        <TableCell className="text-right">{row.invoiceCount}</TableCell>
                        <TableCell className="text-right">{money(row.monthTotal)}</TableCell>
                        <TableCell className="text-right text-green-600">{money(row.monthPaid)}</TableCell>
                        <TableCell className="text-right text-amber-600">{money(row.monthDue)}</TableCell>
                        <TableCell className="text-right">{row.openInvoices}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/clients/${row.clientId}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CorporateTravel;
