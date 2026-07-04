import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Users, Building2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PermissionGate from "@/components/PermissionGate";
import { clientApi, type Client, type ClientFamilyMember, type WalletTransaction } from "@/lib/api";

const money = (n: number) => `৳${(n || 0).toLocaleString()}`;

export default function ClientCrmExtras({ client }: { client: Client }) {
  const { toast } = useToast();
  const [balance, setBalance] = useState(client.walletBalance || 0);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [amount, setAmount] = useState("");
  const [wType, setWType] = useState<"credit" | "debit">("credit");
  const [wNote, setWNote] = useState("");
  const [family, setFamily] = useState<ClientFamilyMember[]>([]);
  const [fam, setFam] = useState({ name: "", relation: "spouse", passportNumber: "", dateOfBirth: "" });
  const [busy, setBusy] = useState(false);
  const isCorporate = client.clientType === "corporate";
  const [credit, setCredit] = useState(client.creditLimit != null ? String(client.creditLimit) : "");
  const [contractRef, setContractRef] = useState(client.contractRef || "");
  const [contractExpiry, setContractExpiry] = useState(client.contractExpiry || "");

  useEffect(() => {
    clientApi.getWallet(client.id).then((w) => { setBalance(w.balance); setTxns(w.transactions); }).catch(() => {});
    clientApi.getFamily(client.id).then(setFamily).catch(() => {});
  }, [client.id]);

  const adjustWallet = async () => {
    const amt = Number(amount);
    if (!amt) return;
    setBusy(true);
    try {
      const r = await clientApi.adjustWallet(client.id, { amount: amt, type: wType, note: wNote || undefined });
      setBalance(r.balance); setTxns((p) => [r.transaction, ...p]); setAmount(""); setWNote("");
      toast({ title: `Wallet ${wType === "credit" ? "credited" : "debited"}` });
    } catch (err: unknown) {
      toast({ title: "Wallet update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const addFamily = async () => {
    if (!fam.name.trim()) return;
    setBusy(true);
    try {
      const m = await clientApi.addFamily(client.id, fam);
      setFamily((p) => [...p, m]); setFam({ name: "", relation: "spouse", passportNumber: "", dateOfBirth: "" });
    } catch (err: unknown) {
      toast({ title: "Could not add member", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const removeFamily = async (mid: string) => {
    try { await clientApi.deleteFamily(client.id, mid); setFamily((p) => p.filter((m) => m.id !== mid)); }
    catch { /* ignore */ }
  };

  const saveCorporate = async () => {
    setBusy(true);
    try {
      await clientApi.update(client.id, {
        creditLimit: credit === "" ? undefined : Number(credit),
        contractRef: contractRef || undefined,
        contractExpiry: contractExpiry || undefined,
      });
      toast({ title: "Corporate details saved" });
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <>
      {/* Wallet */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" /> Wallet</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Balance</span>
            <span className={`text-xl font-semibold ${balance < 0 ? "text-destructive" : ""}`}>{money(balance)}</span>
          </div>
          <PermissionGate module="clients" action="edit" fallback={null}>
            <div className="flex gap-2">
              <Select value={wType} onValueChange={(v) => setWType(v as "credit" | "debit")}>
                <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="credit">Add</SelectItem><SelectItem value="debit">Deduct</SelectItem></SelectContent>
              </Select>
              <Input className="h-9" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button size="sm" className="h-9" disabled={busy || !amount} onClick={adjustWallet}>Apply</Button>
            </div>
            <Input className="h-8" placeholder="Note (optional)" value={wNote} onChange={(e) => setWNote(e.target.value)} />
          </PermissionGate>
          {txns.length > 0 && (
            <div className="space-y-1 border-t pt-2">
              {txns.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{t.note || (t.type === "credit" ? "Added" : "Deducted")}</span>
                  <span className={t.type === "credit" ? "text-green-600" : "text-destructive"}>{t.type === "credit" ? "+" : "−"}{money(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family members */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Family members ({family.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {family.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded border p-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.name} <span className="text-xs text-muted-foreground capitalize">· {m.relation}</span></p>
                {(m.passportNumber || m.dateOfBirth) && <p className="text-xs text-muted-foreground truncate">{m.passportNumber || ""}{m.passportNumber && m.dateOfBirth ? " · " : ""}{m.dateOfBirth || ""}</p>}
              </div>
              <PermissionGate module="clients" action="edit" fallback={null}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeFamily(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </PermissionGate>
            </div>
          ))}
          <PermissionGate module="clients" action="edit" fallback={family.length === 0 ? <p className="text-xs text-muted-foreground">No family members.</p> : null}>
            <div className="grid grid-cols-2 gap-2 border-t pt-2">
              <Input className="h-8" placeholder="Name" value={fam.name} onChange={(e) => setFam({ ...fam, name: e.target.value })} />
              <Select value={fam.relation} onValueChange={(v) => setFam({ ...fam, relation: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{["spouse", "child", "parent", "sibling", "family"].map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="h-8" placeholder="Passport" value={fam.passportNumber} onChange={(e) => setFam({ ...fam, passportNumber: e.target.value })} />
              <Input className="h-8" type="date" value={fam.dateOfBirth} onChange={(e) => setFam({ ...fam, dateOfBirth: e.target.value })} />
              <Button size="sm" variant="outline" className="col-span-2 h-8" disabled={busy || !fam.name.trim()} onClick={addFamily}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add member</Button>
            </div>
          </PermissionGate>
        </CardContent>
      </Card>

      {/* Corporate details */}
      {isCorporate && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> Corporate</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <PermissionGate module="clients" action="edit" fallback={
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Credit limit:</span> {client.creditLimit != null ? money(client.creditLimit) : "—"}</p>
                <p><span className="text-muted-foreground">Contract:</span> {client.contractRef || "—"}{client.contractExpiry ? ` (exp ${client.contractExpiry})` : ""}</p>
              </div>
            }>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Credit limit</Label><Input className="h-9" type="number" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Contract reference</Label><Input className="h-9" value={contractRef} onChange={(e) => setContractRef(e.target.value)} placeholder="Contract no." /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Contract expiry</Label><Input className="h-9" type="date" value={contractExpiry} onChange={(e) => setContractExpiry(e.target.value)} /></div>
              <Button size="sm" className="w-full" disabled={busy} onClick={saveCorporate}>Save corporate details</Button>
            </PermissionGate>
          </CardContent>
        </Card>
      )}
    </>
  );
}
