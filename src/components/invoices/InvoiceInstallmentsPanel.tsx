import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { invoiceApi, type InvoiceInstallment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import PermissionGate from "@/components/PermissionGate";

interface Props {
  invoiceId: string;
  installments: InvoiceInstallment[];
  onChange: (rows: InvoiceInstallment[]) => void;
}

export function InvoiceInstallmentsPanel({ invoiceId, installments, onChange }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const totalScheduled = installments.reduce((s, r) => s + r.amount, 0);
  const totalPaidOnSchedule = installments.reduce((s, r) => s + r.paidAmount, 0);

  const handleAdd = async () => {
    if (!label.trim() || amount <= 0) {
      toast({ title: t("installmentsForm.required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const row = await invoiceApi.addInstallment(invoiceId, {
        label: label.trim(),
        amount,
        dueDate: dueDate || undefined,
        sortOrder: installments.length,
      });
      onChange([...installments, row]);
      setLabel("");
      setAmount(0);
      setDueDate("");
      toast({ title: t("installmentsForm.added") });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("installmentsForm.addFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (instId: string) => {
    try {
      await invoiceApi.deleteInstallment(invoiceId, instId);
      onChange(installments.filter((r) => r.id !== instId));
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("installmentsForm.deleteFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">{t("installmentsForm.scheduled")}</p>
          <p className="font-semibold">৳{totalScheduled.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{t("installmentsForm.paidOnSchedule")}</p>
          <p className="font-semibold text-green-600">৳{totalPaidOnSchedule.toLocaleString()}</p>
        </div>
      </div>

      {installments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t("installmentsForm.empty")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("installmentsForm.label")}</TableHead>
              <TableHead>{t("installmentsForm.dueDate")}</TableHead>
              <TableHead className="text-right">{t("installmentsForm.amount")}</TableHead>
              <TableHead className="text-right">{t("installmentsForm.paid")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.dueDate || "—"}</TableCell>
                <TableCell className="text-right">৳{row.amount.toLocaleString()}</TableCell>
                <TableCell className="text-right">৳{row.paidAmount.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {t(`installmentsForm.statuses.${row.status}`, { defaultValue: row.status })}
                  </Badge>
                </TableCell>
                <TableCell>
                  <PermissionGate module="invoices" action="edit">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <PermissionGate module="invoices" action="edit">
        <div className="rounded-md border p-3 space-y-3">
          <p className="text-sm font-medium">{t("installmentsForm.addTitle")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t("installmentsForm.label")}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("installmentsForm.labelPlaceholder")} />
            </div>
            <div className="space-y-1">
              <Label>{t("installmentsForm.amount")}</Label>
              <Input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label>{t("installmentsForm.dueDate")}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {t("installmentsForm.addButton")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("installmentsForm.paymentHint")}</p>
        </div>
      </PermissionGate>
    </div>
  );
}
