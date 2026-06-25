import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { InlineEmpty } from "@/components/EmptyState";
import { Plus, Wallet, Building2 } from "lucide-react";
import PermissionGate from "@/components/PermissionGate";
import { useToast } from "@/hooks/use-toast";
import { accountApi } from "@/lib/api";
import type { Account } from "@/lib/api";

interface Props {
  accounts: Account[];
  onRefresh: () => void;
}

const emptyForm = { name: "", type: "cash" as "cash" | "bank", balance: 0, accountNumber: "", bankName: "", notes: "" };

export default function CashBankAccountsTab({ accounts, onRefresh }: Props) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const cashBalance = accounts.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0);
  const bankBalance = accounts.filter((a) => a.type === "bank").reduce((s, a) => s + a.balance, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await accountApi.create({ ...form, status: "active" } as any);
      toast({ title: "Account created" });
      setForm(emptyForm);
      setDialogOpen(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid gap-3 grid-cols-3 flex-1 mr-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Balance</p><p className="text-lg font-bold text-primary">৳{totalBalance.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Cash in Hand</p><p className="text-lg font-bold">৳{cashBalance.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Bank Balance</p><p className="text-lg font-bold">৳{bankBalance.toLocaleString()}</p></CardContent></Card>
        </div>
        <PermissionGate module="accounts" action="create">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Cash/Bank Account</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Main Cash, DBBL Current A/C" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "cash" | "bank" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Opening Balance (৳)</Label>
                    <Input type="number" step={0.01} value={form.balance || ""} onChange={(e) => setForm((f) => ({ ...f, balance: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                {form.type === "bank" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="e.g. Dutch Bangla Bank" />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} placeholder="A/C number" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Creating..." : "Create Account"}</Button>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      {accounts.length === 0 ? (
        <Card><CardContent className="py-12"><InlineEmpty title={t("emptyStates.noAccounts")} hint={t("emptyStates.noAccountsHint")} /></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {acc.type === "bank" ? <Building2 className="h-4 w-4 text-blue-600" /> : <Wallet className="h-4 w-4 text-green-600" />}
                  {acc.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${acc.balance >= 0 ? "text-green-600" : "text-destructive"}`}>
                  ৳{acc.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="capitalize">{acc.type}</Badge>
                  {acc.bankName && <span className="text-xs text-muted-foreground">{acc.bankName}</span>}
                  {acc.accountNumber && <span className="text-xs text-muted-foreground">•••{acc.accountNumber.slice(-4)}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
