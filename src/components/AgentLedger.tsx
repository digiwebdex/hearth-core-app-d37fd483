import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PermissionGate from "@/components/PermissionGate";
import { agentApi, type AgentTransaction } from "@/lib/api";

const money = (n: number) => `৳${(n || 0).toLocaleString()}`;

export default function AgentLedger({ agentId }: { agentId: string }) {
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<AgentTransaction[]>([]);
  const [type, setType] = useState<"deposit" | "payment">("deposit");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    agentApi.getLedger(agentId).then((l) => { setBalance(l.balance); setTxns(l.transactions); }).catch(() => {});
  }, [agentId]);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt) return;
    setBusy(true);
    try {
      const r = await agentApi.addLedger(agentId, { type, amount: amt, method, note: note || undefined });
      setBalance(r.balance); setTxns((p) => [r.transaction, ...p]); setAmount(""); setNote("");
      toast({ title: type === "deposit" ? "Deposit recorded" : "Payment recorded" });
    } catch (err: unknown) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-5 w-5 text-primary" /> Agent ledger
          <span className={`ml-auto text-lg font-bold ${balance < 0 ? "text-destructive" : "text-foreground"}`}>{money(balance)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PermissionGate module="agents" action="edit" fallback={null}>
          <div className="flex flex-wrap items-end gap-2">
            <Select value={type} onValueChange={(v) => setType(v as "deposit" | "payment")}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="deposit">Deposit (+)</SelectItem><SelectItem value="payment">Payment (−)</SelectItem></SelectContent>
            </Select>
            <Input className="h-9 w-32" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{["cash", "bank", "bkash", "nagad"].map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="h-9 flex-1 min-w-[140px]" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button className="h-9" disabled={busy || !amount} onClick={submit}>Record</Button>
          </div>
        </PermissionGate>

        {txns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-muted-foreground">{tx.createdAt.slice(0, 10)}</TableCell>
                  <TableCell><Badge variant="secondary" className={tx.type === "deposit" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"}>{tx.type}</Badge></TableCell>
                  <TableCell className="text-sm capitalize">{tx.method || "—"}</TableCell>
                  <TableCell className={`text-right ${tx.type === "payment" ? "text-destructive" : "text-green-600"}`}>{tx.type === "payment" ? "−" : "+"}{money(tx.amount)}</TableCell>
                  <TableCell className="text-right font-medium">{money(tx.balance)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[160px]">{tx.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
