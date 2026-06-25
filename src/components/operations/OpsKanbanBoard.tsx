import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Booking, BookingType } from "@/lib/api";
import { bookingApi } from "@/lib/api";
import { getWorkflowStatus, mergeServiceDetailsIntoBooking } from "@/lib/bookingServiceDetails";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type OpsKanbanBoardProps = {
  bookings: Booking[];
  workflowType: Extract<BookingType, "visa" | "ticket" | "hotel" | "student" | "manpower">;
  statuses: string[];
  onOpen: (bookingId: string) => void;
  onBookingUpdated?: (booking: Booking) => void;
  subtitleFor: (booking: Booking) => string;
};

const COLUMN_COLORS: Record<string, string> = {
  not_started: "border-slate-200",
  documents_pending: "border-amber-300",
  submitted: "border-blue-300",
  interview_scheduled: "border-violet-300",
  approved: "border-green-400",
  rejected: "border-red-400",
  passport_returned: "border-emerald-400",
  pending: "border-slate-200",
  issued: "border-green-400",
  reissued: "border-blue-300",
  refund_requested: "border-amber-300",
  refunded: "border-slate-300",
  confirmed: "border-blue-300",
  voucher_sent: "border-violet-300",
  checked_in: "border-green-400",
  cancelled: "border-red-300",
  inquiry: "border-slate-200",
  docs_collected: "border-amber-300",
  application_submitted: "border-blue-300",
  offer_received: "border-violet-300",
  visa_processing: "border-indigo-300",
  enrolled: "border-green-400",
  completed: "border-emerald-500",
  registered: "border-slate-200",
  medical: "border-amber-300",
  bmet: "border-blue-300",
  visa: "border-violet-300",
  deployed: "border-green-400",
};

export function OpsKanbanBoard({
  bookings,
  workflowType,
  statuses,
  onOpen,
  onBookingUpdated,
  subtitleFor,
}: OpsKanbanBoardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const grouped = statuses.map((status) => ({
    status,
    items: bookings.filter((b) => getWorkflowStatus(mergeServiceDetailsIntoBooking(b)) === status),
  }));

  const handleStatusChange = async (booking: Booking, nextStatus: string) => {
    const merged = mergeServiceDetailsIntoBooking(booking);
    if (getWorkflowStatus(merged) === nextStatus) return;
    setUpdatingId(booking.id);
    try {
      const serviceDetails = { ...(merged.serviceDetails || {}), workflowStatus: nextStatus };
      const updated = await bookingApi.update(booking.id, {
        serviceDetails,
        opsStatus: nextStatus,
      });
      const patched = { ...merged, ...updated, serviceDetails, opsStatus: nextStatus };
      onBookingUpdated?.(patched);
      toast({ title: t("serviceOps.kanban.statusUpdated") });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("serviceOps.panel.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
      {grouped.map(({ status, items }) => (
        <div
          key={status}
          className={cn(
            "min-w-[240px] max-w-[280px] flex-shrink-0 rounded-lg border-2 bg-muted/30",
            COLUMN_COLORS[status] || "border-border",
          )}
        >
          <div className="sticky top-0 z-10 rounded-t-md bg-background/95 backdrop-blur px-3 py-2 border-b">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold leading-tight">
                {t(`serviceOps.workflow.${workflowType}.${status}`, { defaultValue: status })}
              </p>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {items.length}
              </Badge>
            </div>
          </div>
          <div className="p-2 space-y-2 min-h-[120px]">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-1">
                {t("serviceOps.kanban.emptyColumn")}
              </p>
            ) : (
              items.map((b) => {
                const merged = mergeServiceDetailsIntoBooking(b);
                const busy = updatingId === b.id;
                const dateHint = b.appointmentDate || b.submissionDate || b.checkInDate || b.departureDate || "";
                return (
                  <Card key={b.id} className="shadow-sm">
                    <CardHeader className="p-3 pb-1 space-y-0">
                      <CardTitle className="text-sm font-medium leading-snug line-clamp-2">
                        {b.clientName || b.title || "—"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1 space-y-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">{subtitleFor(merged)}</p>
                      {dateHint ? (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {dateHint}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-1">
                        <Select
                          value={getWorkflowStatus(merged)}
                          onValueChange={(v) => handleStatusChange(b, v)}
                          disabled={busy}
                        >
                          <SelectTrigger className="h-7 text-[10px] flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {t(`serviceOps.workflow.${workflowType}.${s}`, { defaultValue: s })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => onOpen(b.id)}
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
