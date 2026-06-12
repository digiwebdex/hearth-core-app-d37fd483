import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Booking, BookingType } from "@/lib/api";
import {
  getWorkflowStatus,
  type HotelWorkflowStatus,
  type TicketWorkflowStatus,
  type TransportWorkflowStatus,
  type VisaWorkflowStatus,
} from "@/lib/bookingServiceDetails";
import { useState } from "react";
import { bookingApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

const VISA_STATUSES: VisaWorkflowStatus[] = [
  "not_started",
  "documents_pending",
  "submitted",
  "interview_scheduled",
  "approved",
  "rejected",
  "passport_returned",
];

const TICKET_STATUSES: TicketWorkflowStatus[] = [
  "pending",
  "issued",
  "reissued",
  "refund_requested",
  "refunded",
];

const HOTEL_STATUSES: HotelWorkflowStatus[] = [
  "pending",
  "confirmed",
  "voucher_sent",
  "checked_in",
  "cancelled",
];

const TRANSPORT_STATUSES: TransportWorkflowStatus[] = [
  "pending",
  "assigned",
  "in_transit",
  "completed",
  "cancelled",
];

const SERVICE_OPS_TYPES = new Set<BookingType>(["visa", "ticket", "hotel", "transport"]);

function statusOptions(type: BookingType): string[] {
  switch (type) {
    case "visa":
      return VISA_STATUSES;
    case "ticket":
      return TICKET_STATUSES;
    case "hotel":
      return HOTEL_STATUSES;
    case "transport":
      return TRANSPORT_STATUSES;
    default:
      return [];
  }
}

function detailRows(booking: Booking, t: (key: string) => string): Array<{ label: string; value: string }> {
  switch (booking.type) {
    case "visa":
      return [
        { label: t("serviceOps.panel.visaCountry"), value: booking.visaCountry || booking.destination || "—" },
        { label: t("serviceOps.panel.passport"), value: booking.passportNumber || "—" },
        { label: t("serviceOps.panel.submission"), value: booking.submissionDate || "—" },
        { label: t("serviceOps.panel.appointment"), value: booking.appointmentDate || "—" },
      ];
    case "ticket":
      return [
        { label: t("serviceOps.panel.pnr"), value: booking.pnrNumber || booking.supplierRef || "—" },
        { label: t("serviceOps.panel.airline"), value: booking.airline || booking.supplierName || "—" },
        { label: t("serviceOps.panel.route"), value: [booking.fromCity, booking.toCity].filter(Boolean).join(" → ") || "—" },
        { label: t("serviceOps.panel.deadline"), value: booking.ticketDeadline || "—" },
      ];
    case "hotel":
      return [
        { label: t("serviceOps.panel.hotel"), value: booking.hotelName || booking.supplierName || "—" },
        { label: t("serviceOps.panel.dates"), value: [booking.checkInDate || booking.travelDateFrom, booking.checkOutDate || booking.travelDateTo].filter(Boolean).join(" → ") || "—" },
        { label: t("serviceOps.panel.confirmation"), value: booking.confirmationNumber || booking.supplierRef || "—" },
        { label: t("serviceOps.panel.guests"), value: booking.guestCount ? String(booking.guestCount) : "—" },
      ];
    case "transport":
      return [
        { label: t("serviceOps.panel.route"), value: booking.routeDescription || "—" },
        { label: t("serviceOps.panel.pickup"), value: booking.pickupLocation || "—" },
        { label: t("serviceOps.panel.vehicle"), value: booking.vehicleType || "—" },
        { label: t("serviceOps.panel.driver"), value: booking.driverName || "—" },
      ];
    default:
      return [];
  }
}

interface BookingOpsPanelProps {
  booking: Booking;
  onUpdated?: (booking: Booking) => void;
}

export function BookingOpsPanel({ booking, onUpdated }: BookingOpsPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [workflowStatus, setWorkflowStatus] = useState(getWorkflowStatus(booking));
  const [saving, setSaving] = useState(false);

  if (!SERVICE_OPS_TYPES.has(booking.type)) return null;

  const options = statusOptions(booking.type);
  const rows = detailRows(booking, t);

  const handleSave = async () => {
    setSaving(true);
    try {
      const serviceDetails = {
        ...(booking.serviceDetails || {}),
        workflowStatus,
      };
      const updated = await bookingApi.update(booking.id, {
        serviceDetails,
        opsStatus: workflowStatus,
      });
      onUpdated?.({ ...booking, ...updated, serviceDetails, opsStatus: workflowStatus, workflowStatus });
      toast({ title: t("serviceOps.panel.saved") });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("serviceOps.panel.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {t("serviceOps.panel.title")}
          <Badge variant="outline" className="capitalize">{t(`bookingsForm.types.${booking.type}`)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="text-sm font-medium">{row.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2 max-w-sm">
          <Label>{t("serviceOps.panel.workflowStatus")}</Label>
          <Select value={workflowStatus} onValueChange={setWorkflowStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(`serviceOps.workflow.${booking.type}.${status}`, { defaultValue: status })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t("serviceOps.panel.saveStatus")}
        </Button>
      </CardContent>
    </Card>
  );
}

export { SERVICE_OPS_TYPES };
