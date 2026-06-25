import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, FileText, RefreshCw } from "lucide-react";
import { format, subMonths } from "date-fns";
import { financeApi, type PLReport, type BalanceSheet, type CashFlowReport, type TaxReport } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function fmt(n: number) {
  return `৳ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${positive === true ? "text-green-600" : positive === false ? "text-red-600" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold, indent, positive }: { label: string; value: number; bold?: boolean; indent?: boolean; positive?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${bold ? "border-t font-semibold" : "border-t border-dashed"} ${indent ? "pl-4" : ""}`}>
      <span className={`text-sm ${positive === true ? "text-green-700" : positive === false ? "text-red-700" : ""}`}>{label}</span>
      <span className={`text-sm font-mono ${positive === true ? "text-green-700 font-semibold" : positive === false ? "text-red-700 font-semibold" : ""}`}>{fmt(value)}</span>
    </div>
  );
}

export default function FinancialStatements() {
  const { toast } = useToast();
  const [tab, setTab] = useState("pl");
  const [loading, setLoading] = useState(false);
  const from = format(subMonths(new Date(), 3), "yyyy-MM-dd");
  const to = format(new Date(), "yyyy-MM-dd");

  const [pl, setPL] = useState<PLReport | null>(null);
  const [bs, setBS] = useState<BalanceSheet | null>(null);
  const [cf, setCF] = useState<CashFlowReport | null>(null);
  const [tax, setTax] = useState<TaxReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plR, bsR, cfR, taxR] = await Promise.allSettled([
        financeApi.getPL(from, to),
        financeApi.getBalanceSheet(),
        financeApi.getCashFlow(from, to),
        financeApi.getTaxReport(from, to),
      ]);
      if (plR.status === "fulfilled") setPL(plR.value);
      if (bsR.status === "fulfilled") setBS(bsR.value);
      if (cfR.status === "fulfilled") setCF(cfR.value);
      if (taxR.status === "fulfilled") setTax(taxR.value);
    } catch {
      toast({ title: "Failed to load reports", variant: "destructive" });
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Financial Statements</h1>
            <p className="text-muted-foreground text-sm">P&L · Balance Sheet · Cash Flow · Tax Report</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pl"><TrendingUp className="w-4 h-4 mr-1.5" />P&L</TabsTrigger>
            <TabsTrigger value="bs"><BarChart3 className="w-4 h-4 mr-1.5" />Balance Sheet</TabsTrigger>
            <TabsTrigger value="cf"><DollarSign className="w-4 h-4 mr-1.5" />Cash Flow</TabsTrigger>
            <TabsTrigger value="tax"><FileText className="w-4 h-4 mr-1.5" />Tax Report</TabsTrigger>
          </TabsList>

          {/* P&L */}
          <TabsContent value="pl" className="mt-4 space-y-4">
            {loading ? <Skeleton className="h-64 w-full" /> : pl ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Revenue" value={fmt(pl.revenue.total)} positive={true} />
                  <StatCard label="Cost of Sales" value={fmt(pl.costOfSales.vendorCosts)} />
                  <StatCard label="Gross Profit" value={fmt(pl.grossProfit)} positive={pl.grossProfit >= 0} />
                  <StatCard label="Net Profit" value={fmt(pl.netProfit)} positive={pl.netProfit >= 0} sub="After all expenses" />
                </div>
                <Card>
                  <CardHeader><CardTitle className="text-base">Income Statement — {from} to {to}</CardTitle></CardHeader>
                  <CardContent>
                    <Row label="Revenue (Payments Received)" value={pl.revenue.total} />
                    <Row label="Less: Tax Collected" value={-pl.revenue.taxCollected} indent />
                    <Row label="Net Revenue" value={pl.revenue.netRevenue} bold />
                    <Row label="Less: Vendor / Cost of Sales" value={-pl.costOfSales.vendorCosts} indent />
                    <Row label="Gross Profit" value={pl.grossProfit} bold positive={pl.grossProfit >= 0} />
                    <Row label="Operating Expenses" value={-pl.operatingExpenses.total} indent />
                    {Object.entries(pl.operatingExpenses.byCategory).map(([cat, amt]) => (
                      <Row key={cat} label={`  ${cat}`} value={-amt} indent />
                    ))}
                    <Row label="Net Profit / (Loss)" value={pl.netProfit} bold positive={pl.netProfit >= 0} />
                  </CardContent>
                </Card>
              </>
            ) : <p className="text-muted-foreground text-sm">No data available</p>}
          </TabsContent>

          {/* Balance Sheet */}
          <TabsContent value="bs" className="mt-4 space-y-4">
            {loading ? <Skeleton className="h-64 w-full" /> : bs ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="Total Assets" value={fmt(bs.assets.totalAssets)} positive={true} />
                  <StatCard label="Total Liabilities" value={fmt(bs.liabilities.totalLiabilities)} />
                  <StatCard label="Net Equity" value={fmt(bs.equity)} positive={bs.equity >= 0} />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Assets</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">Cash & Bank Accounts</p>
                      {bs.assets.cashAndBank.accounts.map((a) => (
                        <Row key={a.id} label={a.name} value={a.balance} indent />
                      ))}
                      <Row label="Total Cash & Bank" value={bs.assets.cashAndBank.total} bold />
                      <Row label="Accounts Receivable (Due Invoices)" value={bs.assets.accountsReceivable} />
                      <Row label="Total Assets" value={bs.assets.totalAssets} bold positive={true} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Liabilities & Equity</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">Liabilities</p>
                      <Row label="Accounts Payable (Vendor Bills Due)" value={bs.liabilities.accountsPayable} />
                      <Row label="Total Liabilities" value={bs.liabilities.totalLiabilities} bold />
                      <div className="mt-4" />
                      <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">Equity</p>
                      <Row label="Net Equity (Assets − Liabilities)" value={bs.equity} bold positive={bs.equity >= 0} />
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : <p className="text-muted-foreground text-sm">No data available</p>}
          </TabsContent>

          {/* Cash Flow */}
          <TabsContent value="cf" className="mt-4 space-y-4">
            {loading ? <Skeleton className="h-64 w-full" /> : cf ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="Total Inflows" value={fmt(cf.summary.totalInflows)} positive={true} />
                  <StatCard label="Total Outflows" value={fmt(cf.summary.totalOutflows)} />
                  <StatCard label="Net Cash" value={fmt(cf.summary.net)} positive={cf.summary.net >= 0} />
                </div>
                <Card>
                  <CardHeader><CardTitle className="text-base">Monthly Cash Flow</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Month</th>
                          <th className="text-right px-4 py-2 font-medium text-green-700">Inflows</th>
                          <th className="text-right px-4 py-2 font-medium text-red-700">Outflows</th>
                          <th className="text-right px-4 py-2 font-medium">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cf.monthly.map((row) => (
                          <tr key={row.month} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2 font-medium">{row.month}</td>
                            <td className="px-4 py-2 text-right text-green-700">{fmt(row.inflows)}</td>
                            <td className="px-4 py-2 text-right text-red-700">{fmt(row.outflows)}</td>
                            <td className={`px-4 py-2 text-right font-semibold ${row.net >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(row.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            ) : <p className="text-muted-foreground text-sm">No data available</p>}
          </TabsContent>

          {/* Tax Report */}
          <TabsContent value="tax" className="mt-4 space-y-4">
            {loading ? <Skeleton className="h-64 w-full" /> : tax ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <StatCard label="Total Revenue (ex-tax)" value={fmt(tax.summary.totalSubTotal)} />
                  <StatCard label="Tax Collected" value={fmt(tax.summary.totalTaxCollected)} positive={true} />
                  <StatCard label="Invoices with Tax" value={String(tax.summary.invoiceCount)} />
                </div>
                <Card>
                  <CardHeader><CardTitle className="text-base">Tax Invoice Breakdown</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {tax.invoices.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">No tax-bearing invoices in this period.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">Invoice</th>
                            <th className="text-left px-4 py-2 font-medium">Client</th>
                            <th className="text-left px-4 py-2 font-medium">Date</th>
                            <th className="text-right px-4 py-2 font-medium">Sub-total</th>
                            <th className="text-right px-4 py-2 font-medium">Tax Rate</th>
                            <th className="text-right px-4 py-2 font-medium">Tax</th>
                            <th className="text-right px-4 py-2 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tax.invoices.map((inv) => (
                            <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-2 font-medium">{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                              <td className="px-4 py-2">{inv.clientName || "—"}</td>
                              <td className="px-4 py-2 text-muted-foreground">{inv.issuedDate || "—"}</td>
                              <td className="px-4 py-2 text-right">{fmt(inv.subTotal)}</td>
                              <td className="px-4 py-2 text-right">
                                <Badge variant="secondary">{inv.taxRate}%</Badge>
                              </td>
                              <td className="px-4 py-2 text-right text-green-700 font-semibold">{fmt(inv.taxAmount)}</td>
                              <td className="px-4 py-2 text-right font-semibold">{fmt(inv.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : <p className="text-muted-foreground text-sm">No data available</p>}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
