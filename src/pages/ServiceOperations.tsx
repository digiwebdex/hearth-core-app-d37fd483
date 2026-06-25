import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookingApi, type Booking, type BookingStatus } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getTenantServiceDesks } from "@/lib/bookingTypeOptions";
import {
  deskToBookingType,
  getWorkflowStatus,
  groupDepartures,
  mergeServiceDetailsIntoBooking,
  type ServiceDeskId,
} from "@/lib/bookingServiceDetails";
import { Stamp, Ticket, Hotel, Car, Users, Search, Eye, CalendarDays, Shield, LayoutGrid, List } from "lucide-react";
import { OpsKanbanBoard } from "@/components/operations/OpsKanbanBoard";
import {
  HOTEL_WORKFLOW_STATUSES,
  TICKET_WORKFLOW_STATUSES,
  VISA_WORKFLOW_STATUSES,
} from "@/lib/bookingServiceDetails";

const ACTIVE_STATUSES: BookingStatus[] = ["pending", "confirmed", "ticketed", "traveling"];
const ALL_DESK_IDS: ServiceDeskId[] = ["visa", "ticket", "hotel", "transport", "insurance", "departures"];

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function deskIcon(desk: ServiceDeskId) {
  switch (desk) {
    case "visa":
      return Stamp;
    case "ticket":
      return Ticket;
    case "hotel":
      return Hotel;
    case "transport":
      return Car;
    case "insurance":
      return Shield;
    case "departures":
      return Users;
  }
}

const KANBAN_DESKS = new Set<ServiceDeskId>(["visa", "ticket", "hotel"]);

function isServiceDeskId(value: string | null): value is ServiceDeskId {
  return ALL_DESK_IDS.includes(value as ServiceDeskId);
}

const ServiceOperations = () => {
  const { t } = useTranslation();
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deskParam = searchParams.get("desk");
  const viewParam = searchParams.get("view");

  const allowedDesks = useMemo(
    () => getTenantServiceDesks(tenant?.enabledServiceTypes, tenant?.enabledSubcategories),
    [tenant?.enabledServiceTypes, tenant?.enabledSubcategories],
  );

  const desk: ServiceDeskId = isServiceDeskId(deskParam) && allowedDesks.includes(deskParam)
    ? deskParam
    : allowedDesks[0] || "visa";

  const supportsKanban = KANBAN_DESKS.has(desk);
  const view: "table" | "board" =
    supportsKanban && viewParam === "board" ? "board" : "table";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");

  useEffect(() => {
    if (deskParam && isServiceDeskId(deskParam) && !allowedDesks.includes(deskParam)) {
      setSearchParams({ desk: allowedDesks[0] || "visa" });
    }
  }, [deskParam, allowedDesks, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await bookingApi.list({ limit: 1000 });
      setBookings(data.map((b) => mergeServiceDetailsIntoBooking(b)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("serviceOps.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const setDesk = (next: ServiceDeskId) => {
    const params: Record<string, string> = { desk: next };
    if (KANBAN_DESKS.has(next) && view === "board") params.view = "board";
    setSearchParams(params);
  };

  const setView = (next: "table" | "board") => {
    setSearchParams({ desk, view: next });
  };

  const handleBookingPatched = (updated: Booking) => {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const kanbanConfig = useMemo(() => {
    switch (desk) {
      case "visa":
        return {
          workflowType: "visa" as const,
          statuses: VISA_WORKFLOW_STATUSES,
          subtitleFor: (b: Booking) =>
            [b.visaCountry || b.destination, b.passportNumber].filter(Boolean).join(" · ") || "—",
        };
      case "ticket":
        return {
          workflowType: "ticket" as const,
          statuses: TICKET_WORKFLOW_STATUSES,
          subtitleFor: (b: Booking) =>
            [b.pnrNumber || b.supplierRef, b.airline, [b.fromCity, b.toCity].filter(Boolean).join(" → ")]
              .filter(Boolean)
              .join(" · ") || "—",
        };
      case "hotel":
        return {
          workflowType: "hotel" as const,
          statuses: HOTEL_WORKFLOW_STATUSES,
          subtitleFor: (b: Booking) =>
            [b.hotelName || b.supplierName, b.confirmationNumber || b.supplierRef].filter(Boolean).join(" · ") || "—",
        };
      default:
        return null;
    }
  }, [desk]);

  const counts = useMemo(() => {
    const countType = (type: string) => bookings.filter((b) => b.type === type).length;
    return {
      visa: countType("visa"),
      ticket: countType("ticket"),
      hotel: countType("hotel"),
      transport: countType("transport"),
      insurance: countType("insurance"),
      departures: groupDepartures(bookings).length,
    };
  }, [bookings]);

  const typed = useMemo(() => {
    if (desk === "departures") return [];
    return bookings.filter((b) => b.type === deskToBookingType(desk));
  }, [bookings, desk]);

  const filtered = useMemo(() => {
    return typed
      .filter((b) => (statusFilter === "active" ? ACTIVE_STATUSES.includes(b.status) : true))
      .filter((b) => {
        if (!search) return true;
        const q = search.toLowerCase();
        const haystack = [
          b.clientName,
          b.title,
          b.destination,
          b.visaCountry,
          b.pnrNumber,
          b.supplierRef,
          b.hotelName,
          b.routeDescription,
          b.pickupLocation,
          getWorkflowStatus(b),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [typed, search, statusFilter]);

  const departureGroups = useMemo(() => {
    if (desk !== "departures") return [];
    const groups = groupDepartures(bookings);
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter(
      (g) => g.destination.toLowerCase().includes(q) || g.travelDateFrom.includes(q),
    );
  }, [bookings, desk, search]);

  const DeskIcon = deskIcon(desk);
  const bookingPath =
    desk === "visa"
      ? "/bookings/visa"
      : desk === "ticket"
        ? "/bookings/flight"
        : desk === "hotel"
          ? "/bookings/hotel"
          : desk === "transport"
            ? "/bookings/transport"
            : desk === "insurance"
              ? "/bookings/insurance"
              : "/bookings/tour";

  const renderDeskRow = (b: Booking) => {
    const workflow = getWorkflowStatus(b);
    const workflowLabel = t(`serviceOps.workflow.${b.type}.${workflow}`, { defaultValue: workflow });

    switch (b.type) {
      case "visa":
        return (
          <>
            <TableCell>{b.visaCountry || b.destination || "—"}</TableCell>
            <TableCell>{b.passportNumber || "—"}</TableCell>
            <TableCell>{b.submissionDate || b.appointmentDate || "—"}</TableCell>
            <TableCell><Badge variant="outline">{workflowLabel}</Badge></TableCell>
          </>
        );
      case "ticket":
        return (
          <>
            <TableCell>{b.pnrNumber || b.supplierRef || "—"}</TableCell>
            <TableCell>{b.airline || b.supplierName || "—"}</TableCell>
            <TableCell>{[b.fromCity, b.toCity].filter(Boolean).join(" → ") || b.destination || "—"}</TableCell>
            <TableCell><Badge variant="outline">{workflowLabel}</Badge></TableCell>
          </>
        );
      case "hotel":
        return (
          <>
            <TableCell>{b.hotelName || b.supplierName || "—"}</TableCell>
            <TableCell>{b.checkInDate || b.travelDateFrom || "—"}</TableCell>
            <TableCell>{b.confirmationNumber || b.supplierRef || "—"}</TableCell>
            <TableCell><Badge variant="outline">{workflowLabel}</Badge></TableCell>
          </>
        );
      case "transport":
        return (
          <>
            <TableCell>{b.routeDescription || b.destination || "—"}</TableCell>
            <TableCell>{b.pickupLocation || "—"}</TableCell>
            <TableCell>{b.vehicleType || b.supplierRef || "—"}</TableCell>
            <TableCell><Badge variant="outline">{workflowLabel}</Badge></TableCell>
          </>
        );
      case "insurance":
        return (
          <>
            <TableCell>{(b as Booking & { insurancePlan?: string }).insurancePlan || b.supplierName || "—"}</TableCell>
            <TableCell>{(b as Booking & { insuranceDestination?: string }).insuranceDestination || b.destination || "—"}</TableCell>
            <TableCell>
              {[b.travelDateFrom, b.travelDateTo].filter(Boolean).join(" → ") || "—"}
            </TableCell>
            <TableCell><Badge variant="outline">{workflowLabel}</Badge></TableCell>
          </>
        );
      default:
        return null;
    }
  };

  const deskHeads = () => {
    switch (desk) {
      case "visa":
        return (
          <>
            <TableHead>{t("serviceOps.columns.country")}</TableHead>
            <TableHead>{t("serviceOps.columns.passport")}</TableHead>
            <TableHead>{t("serviceOps.columns.dates")}</TableHead>
            <TableHead>{t("serviceOps.columns.workflow")}</TableHead>
          </>
        );
      case "ticket":
        return (
          <>
            <TableHead>{t("serviceOps.columns.pnr")}</TableHead>
            <TableHead>{t("serviceOps.columns.airline")}</TableHead>
            <TableHead>{t("serviceOps.columns.route")}</TableHead>
            <TableHead>{t("serviceOps.columns.workflow")}</TableHead>
          </>
        );
      case "hotel":
        return (
          <>
            <TableHead>{t("serviceOps.columns.hotel")}</TableHead>
            <TableHead>{t("serviceOps.columns.checkIn")}</TableHead>
            <TableHead>{t("serviceOps.columns.confirmation")}</TableHead>
            <TableHead>{t("serviceOps.columns.workflow")}</TableHead>
          </>
        );
      case "transport":
        return (
          <>
            <TableHead>{t("serviceOps.columns.route")}</TableHead>
            <TableHead>{t("serviceOps.columns.pickup")}</TableHead>
            <TableHead>{t("serviceOps.columns.vehicle")}</TableHead>
            <TableHead>{t("serviceOps.columns.workflow")}</TableHead>
          </>
        );
      case "insurance":
        return (
          <>
            <TableHead>{t("serviceOps.columns.plan")}</TableHead>
            <TableHead>{t("serviceOps.columns.coverage")}</TableHead>
            <TableHead>{t("serviceOps.columns.dates")}</TableHead>
            <TableHead>{t("serviceOps.columns.workflow")}</TableHead>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DeskIcon className="h-8 w-8" />
            {t("serviceOps.title")}
          </h1>
          <p className="text-muted-foreground">{t("serviceOps.subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {allowedDesks.map((id) => {
            const Icon = deskIcon(id);
            return (
              <TabButton key={id} active={desk === id} onClick={() => setDesk(id)}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {t(`serviceOps.desks.${id}`)} ({counts[id]})
                </span>
              </TabButton>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {desk !== "departures" && (
            <>
              <Button
                size="sm"
                variant={statusFilter === "active" ? "default" : "outline"}
                onClick={() => setStatusFilter("active")}
              >
                {t("serviceOps.filters.active")}
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                {t("serviceOps.filters.all")}
              </Button>
            </>
          )}
          <div className="flex items-center gap-2 max-w-sm flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder={t("serviceOps.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {desk !== "departures" && (
            <Button variant="outline" size="sm" asChild>
              <Link to={bookingPath}>{t("serviceOps.viewAllBookings")}</Link>
            </Button>
          )}
          {supportsKanban && (
            <>
              <Button
                size="sm"
                variant={view === "table" ? "default" : "outline"}
                onClick={() => setView("table")}
              >
                <List className="h-3.5 w-3.5 mr-1" />
                {t("serviceOps.view.table")}
              </Button>
              <Button
                size="sm"
                variant={view === "board" ? "default" : "outline"}
                onClick={() => setView("board")}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                {t("serviceOps.view.board")}
              </Button>
            </>
          )}
        </div>

        {loading ? (
          <LoadingState rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : desk === "departures" ? (
          departureGroups.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t("serviceOps.departures.emptyTitle")}
              description={t("serviceOps.departures.emptyDesc")}
              actionLabel={t("serviceOps.departures.createBooking")}
              onAction={() => navigate("/bookings/tour")}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("serviceOps.departures.date")}</TableHead>
                      <TableHead>{t("serviceOps.departures.destination")}</TableHead>
                      <TableHead>{t("serviceOps.departures.bookings")}</TableHead>
                      <TableHead>{t("serviceOps.departures.travelers")}</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departureGroups.map((group) => (
                      <TableRow
                        key={group.key}
                        className="cursor-pointer"
                        onClick={() => navigate(`/bookings/${group.bookingIds[0]}`)}
                      >
                        <TableCell>{group.travelDateFrom}</TableCell>
                        <TableCell>{group.destination}</TableCell>
                        <TableCell>{group.bookingCount}</TableCell>
                        <TableCell>{group.travelerCount}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/bookings/${group.bookingIds[0]}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        ) : view === "board" && kanbanConfig ? (
          filtered.length === 0 ? (
            <EmptyState
              icon={DeskIcon}
              title={t("serviceOps.emptyTitle")}
              description={t("serviceOps.emptyDesc")}
              actionLabel={t("serviceOps.createBooking")}
              onAction={() => navigate(bookingPath)}
            />
          ) : (
            <OpsKanbanBoard
              bookings={filtered}
              workflowType={kanbanConfig.workflowType}
              statuses={[...kanbanConfig.statuses]}
              subtitleFor={kanbanConfig.subtitleFor}
              onOpen={(id) => navigate(`/bookings/${id}?tab=operations`)}
              onBookingUpdated={handleBookingPatched}
            />
          )
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={DeskIcon}
            title={t("serviceOps.emptyTitle")}
            description={t("serviceOps.emptyDesc")}
            actionLabel={t("serviceOps.createBooking")}
            onAction={() => navigate(bookingPath)}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("serviceOps.client")}</TableHead>
                    {deskHeads()}
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("serviceOps.payment")}</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/bookings/${b.id}?tab=operations`)}
                    >
                      <TableCell className="font-medium">{b.clientName || "—"}</TableCell>
                      {renderDeskRow(b)}
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{b.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.paymentStatus === "paid" ? "default" : "outline"} className="capitalize">
                          {b.paymentStatus || "unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/bookings/${b.id}?tab=operations`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">{t("serviceOps.footerHint")}</p>
      </div>
    </DashboardLayout>
  );
};

export default ServiceOperations;
