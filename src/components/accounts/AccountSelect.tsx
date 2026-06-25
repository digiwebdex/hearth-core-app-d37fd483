import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountApi, type Account } from "@/lib/api";

interface AccountSelectProps {
  value: string;
  onChange: (accountId: string) => void;
  label?: string;
  required?: boolean;
  filterType?: "all" | "cash" | "bank" | "mobile_banking";
}

const TYPE_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  mobile_banking: "Mobile Banking",
  card: "Card",
  other: "Other",
};

export function AccountSelect({
  value,
  onChange,
  label = "Deposit / Pay From Account",
  required = false,
  filterType = "all",
}: AccountSelectProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    accountApi.list().then((rows) => {
      const active = (rows as Account[]).filter((a) => a.status === "active");
      setAccounts(active);
    }).catch(() => setAccounts([]));
  }, []);

  const filtered = filterType === "all"
    ? accounts
    : accounts.filter((a) => a.type === filterType);

  return (
    <div className="space-y-2">
      <Label>{label}{required ? " *" : ""}</Label>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="none">No account selected</SelectItem>}
          {filtered.map((acc) => (
            <SelectItem key={acc.id} value={acc.id}>
              {acc.name} ({TYPE_LABELS[acc.type] || acc.type}) · ৳{acc.balance.toLocaleString()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filtered.length === 0 && (
        <p className="text-xs text-muted-foreground">Add a cash, bank, or mobile banking account under Accounts → Cash & Bank.</p>
      )}
    </div>
  );
}

export function accountLabelForMethod(method: string): "all" | "cash" | "bank" | "mobile_banking" {
  if (method === "cash") return "cash";
  if (method === "mobile_banking") return "mobile_banking";
  if (method === "bank" || method === "cheque" || method === "online" || method === "card") return "bank";
  return "all";
}
