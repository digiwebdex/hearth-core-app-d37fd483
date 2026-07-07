import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useHumanError } from "@/hooks/useHumanError";
import { usePermissions } from "@/hooks/usePermissions";
import {
  accountingApi, type ChartOfAccount, type JournalEntry, type TrialBalance,
  type ProfitLoss, type AccountingBalanceSheet, type AccountKind,
} from "@/lib/api";
import {
  BookOpen, Plus, RefreshCw, Scale, TrendingUp, Building2, Trash2, RotateCcw, CheckCircle2, AlertTriangle,
} from "lucide-react";

const money = (n: number) => `৳${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

const ACCOUNT_KINDS: AccountKind[] = ["asset", "liability", "equity", "income", "expense"];

const Accounting = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatError, errorTitle } = useHumanError();
  const { can } = usePermissions();
  const canManage = can("accounts", "create");

  const [tab, setTab] = useState("coa");
  const [busy, setBusy] = useState(false);

  const showErr = useCallback((err: unknown) => toast({ variant: "destructive", title: errorTitle(), description: formatError(err) }), [toast, errorTitle, formatError]);

  // ── Chart of Accounts ──
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [coaLoading, setCoaLoading] = useState(true);
  const loadAccounts = useCallback(async () => {
    setCoaLoading(true);
    try { setAccounts(await accountingApi.listAccounts()); }
    catch (err) { showErr(err); }
    finally { setCoaLoading(false); }
  }, [showErr]);
  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const [acctDialog, setAcctDialog] = useState(false);
  const [acctForm, setAcctForm] = useState({ code: "", name: "", type: "asset" as AccountKind, subtype: "", description: "" });
  const saveAccount = async () => {
    if (!acctForm.code.trim() || !acctForm.name.trim()) return;
    try {
      await accountingApi.createAccount({ ...acctForm, subtype: acctForm.subtype || undefined, description: acctForm.description || undefined });
      setAcctDialog(false);
      setAcctForm({ code: "", name: "", type: "asset", subtype: "", description: "" });
      toast({ title: t("accounting.accountCreated") });
      loadAccounts();
    } catch (err) { showErr(err); }
  };
  const deleteAccount = async (a: ChartOfAccount) => {
    try { await accountingApi.deleteAccount(a.id); toast({ title: t("accounting.accountDeleted") }); loadAccounts(); }
    catch (err) { showErr(err); }
  };

  const resync = async () => {
    setBusy(true);
    try {
      const r = await accountingApi.resync();
      toast({ title: t("accounting.resynced"), description: t("accounting.resyncedDesc", { added: r.newlyPosted, total: r.totalEntries }) });
      loadAccounts();
    } catch (err) { showErr(err); } finally { setBusy(false); }
  };

  // ── Journal ──
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalLoaded, setJournalLoaded] = useState(false);
  const loadJournal = useCallback(async () => {
    try { setJournal(await accountingApi.listJournal()); setJournalLoaded(true); }
    catch (err) { showErr(err); }
  }, [showErr]);

  const [jDialog, setJDialog] = useState(false);
  const emptyLine = () => ({ accountId: "", debit: "", credit: "", description: "" });
  const [jForm, setJForm] = useState({ date: todayStr(), memo: "", lines: [emptyLine(), emptyLine()] });
  const jTotals = useMemo(() => {
    const d = jForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = jForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit: d, credit: c, balanced: Math.abs(d - c) < 0.01 && d > 0 };
  }, [jForm.lines]);
  const saveJournal = async () => {
    try {
      await accountingApi.createJournal({
        date: jForm.date, memo: jForm.memo,
        lines: jForm.lines.filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
          .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description })),
      });
      setJDialog(false);
      setJForm({ date: todayStr(), memo: "", lines: [emptyLine(), emptyLine()] });
      toast({ title: t("accounting.entryPosted") });
      loadJournal();
    } catch (err) { showErr(err); }
  };
  const reverseEntry = async (e: JournalEntry) => {
    try { await accountingApi.reverseJournal(e.id); toast({ title: t("accounting.entryReversed") }); loadJournal(); }
    catch (err) { showErr(err); }
  };

  // ── Reports ──
  const [tbRange, setTbRange] = useState({ from: "", to: "" });
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const loadTB = useCallback(async () => {
    try { setTb(await accountingApi.trialBalance({ from: tbRange.from || undefined, to: tbRange.to || undefined })); }
    catch (err) { showErr(err); }
  }, [tbRange, showErr]);

  const [plRange, setPlRange] = useState({ from: "", to: "" });
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const loadPL = useCallback(async () => {
    try { setPl(await accountingApi.profitLoss({ from: plRange.from || undefined, to: plRange.to || undefined })); }
    catch (err) { showErr(err); }
  }, [plRange, showErr]);

  const [bsAsOf, setBsAsOf] = useState(todayStr());
  const [bs, setBs] = useState<AccountingBalanceSheet | null>(null);
  const loadBS = useCallback(async () => {
    try { setBs(await accountingApi.balanceSheet({ asOf: bsAsOf || undefined })); }
    catch (err) { showErr(err); }
  }, [bsAsOf, showErr]);

  // Lazy-load per tab.
  useEffect(() => {
    if (tab === "journal" && !journalLoaded) loadJournal();
    if (tab === "tb" && !tb) loadTB();
    if (tab === "pnl" && !pl) loadPL();
    if (tab === "bs" && !bs) loadBS();
  }, [tab, journalLoaded, tb, pl, bs, loadJournal, loadTB, loadPL, loadBS]);

  const balancedBadge = (ok: boolean) => (
    <Badge variant={ok ? "default" : "destructive"} className="gap-1">
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {ok ? t("accounting.balanced") : t("accounting.unbalanced")}
    </Badge>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><BookOpen className="h-7 w-7" />{t("accounting.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("accounting.subtitle")}</p>
          </div>
          {canManage && (
            <Button variant="outline" onClick={resync} disabled={busy}>
              <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />{t("accounting.resync")}
            </Button>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="coa" className="gap-1.5"><BookOpen className="h-4 w-4" />{t("accounting.tabCoa")}</TabsTrigger>
            <TabsTrigger value="journal" className="gap-1.5"><Plus className="h-4 w-4" />{t("accounting.tabJournal")}</TabsTrigger>
            <TabsTrigger value="tb" className="gap-1.5"><Scale className="h-4 w-4" />{t("accounting.tabTrialBalance")}</TabsTrigger>
            <TabsTrigger value="pnl" className="gap-1.5"><TrendingUp className="h-4 w-4" />{t("accounting.tabPnl")}</TabsTrigger>
            <TabsTrigger value="bs" className="gap-1.5"><Building2 className="h-4 w-4" />{t("accounting.tabBalanceSheet")}</TabsTrigger>
          </TabsList>

          {/* Chart of Accounts */}
          <TabsContent value="coa">
            <div className="flex justify-end mb-3">
              {canManage && (
                <Dialog open={acctDialog} onOpenChange={setAcctDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />{t("accounting.newAccount")}</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("accounting.newAccount")}</DialogTitle></DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>{t("accounting.code")}</Label><Input value={acctForm.code} onChange={(e) => setAcctForm({ ...acctForm, code: e.target.value })} /></div>
                      <div><Label>{t("accounting.type")}</Label>
                        <Select value={acctForm.type} onValueChange={(v) => setAcctForm({ ...acctForm, type: v as AccountKind })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ACCOUNT_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`accounting.kind.${k}`)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>{t("accounting.name")}</Label><Input value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAcctDialog(false)}>{t("common.cancel")}</Button>
                      <Button onClick={saveAccount}>{t("common.save")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {coaLoading ? <LoadingState /> : accounts.length === 0 ? (
              <EmptyState icon={BookOpen} title={t("accounting.noAccounts")} description={t("accounting.noAccountsDesc")}
                action={canManage ? <Button onClick={() => accountingApi.seedAccounts().then(loadAccounts).catch(showErr)}>{t("accounting.seed")}</Button> : undefined} />
            ) : (
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{t("accounting.code")}</TableHead><TableHead>{t("accounting.name")}</TableHead>
                    <TableHead>{t("accounting.type")}</TableHead><TableHead>{t("accounting.normalBalance")}</TableHead><TableHead />
                  </TableRow></TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id} className={a.subtype === "group" ? "font-semibold bg-muted/30" : ""}>
                        <TableCell className="font-mono text-sm">{a.code}</TableCell>
                        <TableCell>{a.name}{a.isSystem && <Badge variant="outline" className="ml-2 text-[10px]">{t("accounting.system")}</Badge>}</TableCell>
                        <TableCell><Badge variant="secondary">{t(`accounting.kind.${a.type}`)}</Badge></TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{t(`accounting.${a.normalBalance}`)}</TableCell>
                        <TableCell className="text-right">
                          {canManage && !a.isSystem && (
                            <Button variant="ghost" size="icon" onClick={() => deleteAccount(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* Journal */}
          <TabsContent value="journal">
            <div className="flex justify-end mb-3">
              {canManage && (
                <Dialog open={jDialog} onOpenChange={setJDialog}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />{t("accounting.newEntry")}</Button></DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{t("accounting.newEntry")}</DialogTitle></DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>{t("accounting.date")}</Label><Input type="date" value={jForm.date} onChange={(e) => setJForm({ ...jForm, date: e.target.value })} /></div>
                      <div><Label>{t("accounting.memo")}</Label><Input value={jForm.memo} onChange={(e) => setJForm({ ...jForm, memo: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2 mt-2">
                      {jForm.lines.map((ln, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6">
                            <Select value={ln.accountId} onValueChange={(v) => { const lines = [...jForm.lines]; lines[i] = { ...ln, accountId: v }; setJForm({ ...jForm, lines }); }}>
                              <SelectTrigger><SelectValue placeholder={t("accounting.account")} /></SelectTrigger>
                              <SelectContent>{accounts.filter((a) => a.subtype !== "group").map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <Input className="col-span-3" type="number" placeholder={t("accounting.debit")} value={ln.debit} onChange={(e) => { const lines = [...jForm.lines]; lines[i] = { ...ln, debit: e.target.value, credit: "" }; setJForm({ ...jForm, lines }); }} />
                          <Input className="col-span-3" type="number" placeholder={t("accounting.credit")} value={ln.credit} onChange={(e) => { const lines = [...jForm.lines]; lines[i] = { ...ln, credit: e.target.value, debit: "" }; setJForm({ ...jForm, lines }); }} />
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => setJForm({ ...jForm, lines: [...jForm.lines, emptyLine()] })}><Plus className="mr-1 h-3 w-3" />{t("accounting.addLine")}</Button>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span>{t("accounting.debit")}: <b>{money(jTotals.debit)}</b> · {t("accounting.credit")}: <b>{money(jTotals.credit)}</b></span>
                      {balancedBadge(jTotals.balanced)}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setJDialog(false)}>{t("common.cancel")}</Button>
                      <Button onClick={saveJournal} disabled={!jTotals.balanced}>{t("accounting.postEntry")}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {!journalLoaded ? <LoadingState /> : journal.length === 0 ? (
              <EmptyState icon={Plus} title={t("accounting.noEntries")} description={t("accounting.noEntriesDesc")} />
            ) : (
              <div className="space-y-2">
                {journal.map((e) => (
                  <Card key={e.id} className={e.reversalOfId ? "border-dashed opacity-80" : ""}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm">{e.entryNumber}</span>
                        <Badge variant="outline">{t(`accounting.source.${e.source}`, e.source)}</Badge>
                        <span className="text-sm text-muted-foreground">{e.date?.slice(0, 10)}</span>
                        <span className="text-sm">{e.memo}</span>
                        <span className="ml-auto text-sm font-medium">{money(e.totalDebit)}</span>
                        {canManage && !e.reversalOfId && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title={t("accounting.reverse")} onClick={() => reverseEntry(e)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                      <Table>
                        <TableBody>
                          {e.lines.map((l) => (
                            <TableRow key={l.id} className="border-0">
                              <TableCell className="py-1 pl-6 text-sm">{l.account ? `${l.account.code} · ${l.account.name}` : l.accountId}</TableCell>
                              <TableCell className="py-1 text-right text-sm">{l.debit ? money(l.debit) : ""}</TableCell>
                              <TableCell className="py-1 text-right text-sm">{l.credit ? money(l.credit) : ""}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Trial Balance */}
          <TabsContent value="tb" className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div><Label className="text-xs">{t("accounting.from")}</Label><Input type="date" value={tbRange.from} onChange={(e) => setTbRange({ ...tbRange, from: e.target.value })} className="w-40" /></div>
              <div><Label className="text-xs">{t("accounting.to")}</Label><Input type="date" value={tbRange.to} onChange={(e) => setTbRange({ ...tbRange, to: e.target.value })} className="w-40" /></div>
              <Button size="sm" onClick={loadTB}>{t("accounting.run")}</Button>
              {tb && <div className="ml-auto">{balancedBadge(tb.balanced)}</div>}
            </div>
            {!tb ? <LoadingState /> : (
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{t("accounting.code")}</TableHead><TableHead>{t("accounting.account")}</TableHead>
                    <TableHead className="text-right">{t("accounting.debit")}</TableHead><TableHead className="text-right">{t("accounting.credit")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {tb.rows.map((r) => (
                      <TableRow key={r.code}>
                        <TableCell className="font-mono text-sm">{r.code}</TableCell><TableCell>{r.name}</TableCell>
                        <TableCell className="text-right">{r.debit ? money(r.debit) : "—"}</TableCell>
                        <TableCell className="text-right">{r.credit ? money(r.credit) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={2}>{t("accounting.total")}</TableCell>
                      <TableCell className="text-right">{money(tb.totalDebit)}</TableCell>
                      <TableCell className="text-right">{money(tb.totalCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* Profit & Loss */}
          <TabsContent value="pnl" className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div><Label className="text-xs">{t("accounting.from")}</Label><Input type="date" value={plRange.from} onChange={(e) => setPlRange({ ...plRange, from: e.target.value })} className="w-40" /></div>
              <div><Label className="text-xs">{t("accounting.to")}</Label><Input type="date" value={plRange.to} onChange={(e) => setPlRange({ ...plRange, to: e.target.value })} className="w-40" /></div>
              <Button size="sm" onClick={loadPL}>{t("accounting.run")}</Button>
            </div>
            {!pl ? <LoadingState /> : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-base">{t("accounting.income")}</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {pl.income.map((l) => <div key={l.code} className="flex justify-between text-sm"><span>{l.name}</span><span>{money(l.amount)}</span></div>)}
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>{t("accounting.totalIncome")}</span><span>{money(pl.totalIncome)}</span></div>
                  </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">{t("accounting.expenses")}</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {pl.expenses.map((l) => <div key={l.code} className="flex justify-between text-sm"><span>{l.name}</span><span>{money(l.amount)}</span></div>)}
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>{t("accounting.totalExpense")}</span><span>{money(pl.totalExpense)}</span></div>
                  </CardContent></Card>
                <Card className="md:col-span-2"><CardContent className="p-4 grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-xs text-muted-foreground">{t("accounting.grossProfit")}</p><p className="text-xl font-bold">{money(pl.grossProfit)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("accounting.cogs")}</p><p className="text-xl font-bold">{money(pl.cogs)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("accounting.netProfit")}</p><p className={`text-xl font-bold ${pl.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{money(pl.netProfit)}</p></div>
                </CardContent></Card>
              </div>
            )}
          </TabsContent>

          {/* Balance Sheet */}
          <TabsContent value="bs" className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div><Label className="text-xs">{t("accounting.asOf")}</Label><Input type="date" value={bsAsOf} onChange={(e) => setBsAsOf(e.target.value)} className="w-40" /></div>
              <Button size="sm" onClick={loadBS}>{t("accounting.run")}</Button>
              {bs && <div className="ml-auto">{balancedBadge(bs.balanced)}</div>}
            </div>
            {!bs ? <LoadingState /> : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-base">{t("accounting.assets")}</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {bs.assets.map((l) => <div key={l.code} className="flex justify-between text-sm"><span>{l.name}</span><span>{money(l.amount)}</span></div>)}
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>{t("accounting.totalAssets")}</span><span>{money(bs.totalAssets)}</span></div>
                  </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">{t("accounting.liabilitiesEquity")}</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {bs.liabilities.map((l) => <div key={l.code} className="flex justify-between text-sm"><span>{l.name}</span><span>{money(l.amount)}</span></div>)}
                    {bs.equity.map((l) => <div key={l.code} className="flex justify-between text-sm"><span>{l.name}</span><span>{money(l.amount)}</span></div>)}
                    <div className="flex justify-between text-sm"><span>{t("accounting.currentEarnings")}</span><span>{money(bs.currentEarnings)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>{t("accounting.totalLiabEquity")}</span><span>{money(bs.totalLiabilities + bs.totalEquity)}</span></div>
                  </CardContent></Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Accounting;
