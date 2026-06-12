import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wallet, Receipt, ArrowUpCircle, Store, CreditCard, Building2, BookOpen, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import FeatureGate from "@/components/FeatureGate";
import AccountsOverview from "@/components/accounts/AccountsOverview";
import ReceivablesTab from "@/components/accounts/ReceivablesTab";
import PaymentsReceivedTab from "@/components/accounts/PaymentsReceivedTab";
import VendorPayablesTab from "@/components/accounts/VendorPayablesTab";
import ExpensesTab from "@/components/accounts/ExpensesTab";
import CashBankAccountsTab from "@/components/accounts/CashBankAccountsTab";
import LedgerTab from "@/components/accounts/LedgerTab";
import ProfitabilityTab from "@/components/accounts/ProfitabilityTab";
import { accountApi, invoiceApi, paymentApi, vendorApi, expenseApi } from "@/lib/api";
import type { AccountsSummary, Invoice, Payment, VendorBill, Expense, Account, Transaction, BookingProfitability } from "@/lib/api";

const Accounts = () => {
  const { currentPlan } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const resolveInitialTab = () => {
    if (location.pathname === "/expenses") return "expenses";
    const tab = searchParams.get("tab");
    if (tab) return tab;
    return "overview";
  };
  const [activeTab, setActiveTab] = useState(resolveInitialTab);
  const [loading, setLoading] = useState(true);

  // Data states
  const [summary, setSummary] = useState<AccountsSummary>({
    totalReceivable: 0, totalReceived: 0, totalPayable: 0,
    overdueReceivable: 0, overduePayable: 0, cashBankBalance: 0,
    totalExpenses: 0, netProfit: 0,
    receivableCount: 0, payableCount: 0, overdueReceivableCount: 0, overduePayableCount: 0,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ledger, setLedger] = useState<Transaction[]>([]);
  const [profitability, setProfitability] = useState<BookingProfitability[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, invoicesRes, paymentsRes, billsRes, expensesRes, accountsRes, ledgerRes, profitRes] = await Promise.allSettled([
        accountApi.getSummary(),
        invoiceApi.list(),
        paymentApi.list(),
        vendorApi.getPayableReport(),
        expenseApi.list(),
        accountApi.list(),
        accountApi.getLedger(),
        accountApi.getProfitability(),
      ]);

      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
      if (invoicesRes.status === "fulfilled") setInvoices(invoicesRes.value);
      if (paymentsRes.status === "fulfilled") setPayments(paymentsRes.value);
      if (billsRes.status === "fulfilled") setVendorBills(billsRes.value);
      if (expensesRes.status === "fulfilled") setExpenses(expensesRes.value);
      if (accountsRes.status === "fulfilled") setAccounts(accountsRes.value);
      if (ledgerRes.status === "fulfilled") setLedger(ledgerRes.value);
      if (profitRes.status === "fulfilled") {
        const value: any = profitRes.value;
        setProfitability(Array.isArray(value) ? value : Array.isArray(value?.bookings) ? value.bookings : []);
      }

      // Fallback: compute summary from loaded data if API summary failed
      if (summaryRes.status === "rejected" && invoicesRes.status === "fulfilled") {
        const inv = invoicesRes.value;
        const bills = billsRes.status === "fulfilled" ? billsRes.value : [];
        const accs = accountsRes.status === "fulfilled" ? accountsRes.value : [];
        const exps = expensesRes.status === "fulfilled" ? expensesRes.value : [];
        const now = new Date().toISOString().split("T")[0];

        const receivable = inv.filter((i) => ["unpaid", "partial", "overdue"].includes(i.status));
        const overdueInv = inv.filter((i) => i.status === "overdue" || (i.dueDate && i.dueDate < now && i.dueAmount > 0));
        const outstandingBills = bills.filter((b) => ["unpaid", "partial", "overdue"].includes(b.status));
        const overdueBills = bills.filter((b) => b.status === "overdue" || (b.dueDate && b.dueDate < now && b.dueAmount > 0));

        setSummary({
          totalReceivable: receivable.reduce((s, i) => s + i.dueAmount, 0),
          totalReceived: inv.reduce((s, i) => s + i.paidAmount, 0),
          totalPayable: outstandingBills.reduce((s, b) => s + b.dueAmount, 0),
          overdueReceivable: overdueInv.reduce((s, i) => s + i.dueAmount, 0),
          overduePayable: overdueBills.reduce((s, b) => s + b.dueAmount, 0),
          cashBankBalance: accs.reduce((s, a) => s + a.balance, 0),
          totalExpenses: exps.reduce((s, e) => s + e.amount, 0),
          netProfit: inv.reduce((s, i) => s + i.paidAmount, 0) - outstandingBills.reduce((s, b) => s + b.paidAmount, 0) - exps.reduce((s, e) => s + e.amount, 0),
          receivableCount: receivable.length,
          payableCount: outstandingBills.length,
          overdueReceivableCount: overdueInv.length,
          overduePayableCount: overdueBills.length,
        });
      }
    } catch {
      // Errors handled by individual settled results
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (location.pathname === "/expenses") {
      setActiveTab("expenses");
      return;
    }
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [location.pathname, searchParams]);

  return (
    <DashboardLayout>
      <FeatureGate
        featureId="accounting"
        currentPlan={currentPlan}
        fallback={
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-muted p-6 mb-6">
              <Wallet className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Accounts & Finance</h2>
            <p className="text-muted-foreground max-w-md mb-2">
              Track receivables, vendor payables, expenses, and booking profitability — all in one place.
            </p>
            <ul className="text-sm text-muted-foreground mb-6 space-y-1 text-left">
              <li>• Client receivable and payment tracking</li>
              <li>• Vendor payable management</li>
              <li>• Expense recording with categories</li>
              <li>• Cash and bank account balances</li>
              <li>• Booking-level profitability reports</li>
              <li>• Unified searchable transaction ledger</li>
            </ul>
            <Button onClick={() => window.location.href = "/subscription"}>
              Upgrade to Basic Plan
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Accounts & Finance</h1>
              <p className="text-muted-foreground">Track receivables, payables, expenses, and profitability</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
              <TabsTrigger value="overview" className="text-xs"><BarChart3 className="mr-1 h-3.5 w-3.5 hidden sm:inline" />Overview</TabsTrigger>
              <TabsTrigger value="receivables" className="text-xs"><Receipt className="mr-1 h-3.5 w-3.5 hidden sm:inline" />Receivables</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs"><ArrowUpCircle className="mr-1 h-3.5 w-3.5 hidden sm:inline" />Payments</TabsTrigger>
              <TabsTrigger value="payables" className="text-xs"><Store className="mr-1 h-3.5 w-3.5 hidden sm:inline" />Payables</TabsTrigger>
              <TabsTrigger value="expenses" className="text-xs"><CreditCard className="mr-1 h-3.5 w-3.5 hidden sm:inline" />Expenses</TabsTrigger>
              <TabsTrigger value="accounts" className="text-xs"><Building2 className="mr-1 h-3.5 w-3.5 hidden sm:inline" />Accounts</TabsTrigger>
              <TabsTrigger value="ledger" className="text-xs"><BookOpen className="mr-1 h-3.5 w-3.5 hidden sm:inline" />Ledger</TabsTrigger>
              <TabsTrigger value="profitability" className="text-xs"><BarChart3 className="mr-1 h-3.5 w-3.5 hidden sm:inline" />Profit</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <AccountsOverview summary={summary} onTabChange={setActiveTab} />
            </TabsContent>
            <TabsContent value="receivables">
              <ReceivablesTab invoices={invoices} />
            </TabsContent>
            <TabsContent value="payments">
              <PaymentsReceivedTab payments={payments} />
            </TabsContent>
            <TabsContent value="payables">
              <VendorPayablesTab bills={vendorBills} />
            </TabsContent>
            <TabsContent value="expenses">
              <ExpensesTab expenses={expenses} onRefresh={fetchData} />
            </TabsContent>
            <TabsContent value="accounts">
              <CashBankAccountsTab accounts={accounts} onRefresh={fetchData} />
            </TabsContent>
            <TabsContent value="ledger">
              <LedgerTab transactions={ledger} />
            </TabsContent>
            <TabsContent value="profitability">
              <ProfitabilityTab data={profitability} />
            </TabsContent>
          </Tabs>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
};

export default Accounts;