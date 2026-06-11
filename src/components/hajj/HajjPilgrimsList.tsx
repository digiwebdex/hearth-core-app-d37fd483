import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PermissionGate from "@/components/PermissionGate";
import { CreditCard, Eye, Pencil, Trash2 } from "lucide-react";
import type { HajjPilgrim } from "@/lib/hajjApi";
import { getStatusMeta, PAGE_SIZE_OPTIONS, PILGRIM_STATUS_META, VISA_STATUS_META } from "./constants";

interface Props {
  pilgrims: HajjPilgrim[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  getPackageName: (id: string) => string;
  getGroupName: (id: string) => string;
  onView: (id: string) => void;
  onEdit: (pilgrim: HajjPilgrim) => void;
  onDelete: (id: string) => void;
  onPay: (id: string) => void;
}

export function HajjPilgrimsList({
  pilgrims,
  totalCount,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  getPackageName,
  getGroupName,
  onView,
  onEdit,
  onDelete,
  onPay,
}: Props) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="pt-6 overflow-x-auto space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("hajjForm.table.name")}</TableHead>
              <TableHead>{t("hajjForm.table.packageGroup")}</TableHead>
              <TableHead>{t("hajjForm.table.passport")}</TableHead>
              <TableHead>{t("hajjForm.table.visa")}</TableHead>
              <TableHead>{t("hajjForm.table.status")}</TableHead>
              <TableHead>{t("hajjForm.table.payment")}</TableHead>
              <TableHead>{t("hajjForm.table.room")}</TableHead>
              <TableHead className="text-right">{t("hajjForm.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pilgrims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t("hajjForm.noPilgrimsFound")}
                </TableCell>
              </TableRow>
            ) : (
              pilgrims.map((p) => {
                const st = getStatusMeta(PILGRIM_STATUS_META, p.status);
                const vs = getStatusMeta(VISA_STATUS_META, p.visaStatus);
                const paidPct = p.totalAmount > 0 ? Math.round((p.paidAmount / p.totalAmount) * 100) : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{getPackageName(p.packageId)}</div>
                      <div className="text-xs text-muted-foreground">{getGroupName(p.groupId)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{p.passportNumber}</div>
                      <div className="text-xs text-muted-foreground">{t("hajjForm.table.exp")}: {p.passportExpiry || "—"}</div>
                    </TableCell>
                    <TableCell><Badge className={vs.color}>{t(vs.labelKey)}</Badge></TableCell>
                    <TableCell><Badge className={st.color}>{t(st.labelKey)}</Badge></TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">৳{p.paidAmount.toLocaleString()} / ৳{p.totalAmount.toLocaleString()}</div>
                      <Progress value={paidPct} className="mt-2 h-2" />
                      <div className="text-xs text-muted-foreground mt-1">{t("hajjForm.table.due")}: ৳{p.dueAmount.toLocaleString()}</div>
                    </TableCell>
                    <TableCell>{p.roomType || "—"}{p.roomNumber ? ` / ${p.roomNumber}` : ""}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => onView(p.id)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> {t("hajjForm.view")}
                        </Button>
                        <PermissionGate module="hajj_umrah" action="edit">
                          <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="hajj_umrah" action="delete">
                          <Button variant="ghost" size="sm" onClick={() => onDelete(p.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="hajj_umrah" action="create">
                          <Button variant="secondary" size="sm" onClick={() => onPay(p.id)}>
                            <CreditCard className="mr-1 h-3.5 w-3.5" /> {t("hajjForm.pay")}
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {t("hajjForm.pagination.showing", { from: totalCount === 0 ? 0 : (page - 1) * pageSize + 1, to: Math.min(page * pageSize, totalCount), total: totalCount })}
          </span>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{t("hajjForm.pagination.prev")}</Button>
            <span>{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>{t("hajjForm.pagination.next")}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
