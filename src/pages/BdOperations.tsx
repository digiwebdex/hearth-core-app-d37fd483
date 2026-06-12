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
import { GraduationCap, HardHat, Search, Eye } from "lucide-react";

type DeskType = "student" | "manpower";

const ACTIVE_STATUSES: BookingStatus[] = ["pending", "confirmed", "ticketed", "traveling"];

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

const BdOperations = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deskParam = searchParams.get("desk");
  const desk: DeskType = deskParam === "manpower" ? "manpower" : "student";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await bookingApi.list();
      setBookings(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("bdOps.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const setDesk = (next: DeskType) => {
    setSearchParams({ desk: next });
  };

  const typed = useMemo(() => bookings.filter((b) => b.type === desk), [bookings, desk]);

  const counts = useMemo(
    () => ({
      student: bookings.filter((b) => b.type === "student").length,
      manpower: bookings.filter((b) => b.type === "manpower").length,
      activeStudent: bookings.filter((b) => b.type === "student" && ACTIVE_STATUSES.includes(b.status)).length,
      activeManpower: bookings.filter((b) => b.type === "manpower" && ACTIVE_STATUSES.includes(b.status)).length,
    }),
    [bookings],
  );

  const filtered = useMemo(() => {
    return typed
      .filter((b) => {
        if (statusFilter === "active") return ACTIVE_STATUSES.includes(b.status);
        return true;
      })
      .filter((b) => {
        if (!search) return true;
        const q = search.toLowerCase();
        const haystack = [
          b.clientName,
          b.title,
          b.instituteName,
          b.courseProgram,
          b.employer,
          b.jobTitle,
          b.workCountry,
          b.visaCountry,
          b.destination,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [typed, search, statusFilter]);

  const stats =
    desk === "student"
      ? [
          { label: t("bdOps.stats.total"), value: counts.student },
          { label: t("bdOps.stats.active"), value: counts.activeStudent },
        ]
      : [
          { label: t("bdOps.stats.total"), value: counts.manpower },
          { label: t("bdOps.stats.active"), value: counts.activeManpower },
        ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {desk === "student" ? <GraduationCap className="h-8 w-8" /> : <HardHat className="h-8 w-8" />}
            {t("bdOps.title")}
          </h1>
          <p className="text-muted-foreground">{t("bdOps.subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton active={desk === "student"} onClick={() => setDesk("student")}>
            {t("bdOps.desks.student")} ({counts.student})
          </TabButton>
          <TabButton active={desk === "manpower"} onClick={() => setDesk("manpower")}>
            {t("bdOps.desks.manpower")} ({counts.manpower})
          </TabButton>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "outline"}
            onClick={() => setStatusFilter("active")}
          >
            {t("bdOps.filters.active")}
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            {t("bdOps.filters.all")}
          </Button>
          <div className="flex items-center gap-2 max-w-sm flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder={t("bdOps.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={desk === "student" ? "/bookings/student" : "/bookings/manpower"}>
              {t("bdOps.viewAllBookings")}
            </Link>
          </Button>
        </div>

        {loading ? (
          <LoadingState rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={desk === "student" ? GraduationCap : HardHat}
            title={t("bdOps.emptyTitle")}
            description={t("bdOps.emptyDesc")}
            actionLabel={t("bdOps.createBooking")}
            onAction={() => navigate(desk === "student" ? "/bookings/student" : "/bookings/manpower")}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bdOps.client")}</TableHead>
                    {desk === "student" ? (
                      <>
                        <TableHead>{t("bdOps.institute")}</TableHead>
                        <TableHead>{t("bdOps.program")}</TableHead>
                        <TableHead>{t("bdOps.country")}</TableHead>
                        <TableHead>{t("bdOps.enrollment")}</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>{t("bdOps.employer")}</TableHead>
                        <TableHead>{t("bdOps.job")}</TableHead>
                        <TableHead>{t("bdOps.country")}</TableHead>
                        <TableHead>{t("bdOps.medical")}</TableHead>
                        <TableHead>{t("bdOps.bmet")}</TableHead>
                      </>
                    )}
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("bdOps.payment")}</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/bookings/${b.id}`)}
                    >
                      <TableCell className="font-medium">{b.clientName || "—"}</TableCell>
                      {desk === "student" ? (
                        <>
                          <TableCell>{b.instituteName || b.supplierName || "—"}</TableCell>
                          <TableCell>{b.courseProgram || b.supplierRef || "—"}</TableCell>
                          <TableCell>{b.visaCountry || b.destination || "—"}</TableCell>
                          <TableCell>{b.enrollmentDate || b.travelDateFrom || "—"}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{b.employer || b.supplierName || "—"}</TableCell>
                          <TableCell>{b.jobTitle || b.supplierRef || "—"}</TableCell>
                          <TableCell>{b.workCountry || b.destination || "—"}</TableCell>
                          <TableCell>
                            {b.medicalStatus ? (
                              <Badge variant="outline" className="capitalize">
                                {t(`bookingsForm.manpowerFields.medicalStatuses.${b.medicalStatus}`, {
                                  defaultValue: b.medicalStatus,
                                })}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{b.bmetRegistration || "—"}</TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{b.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={b.paymentStatus === "paid" ? "default" : "outline"}
                          className="capitalize"
                        >
                          {b.paymentStatus || "unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/bookings/${b.id}`)}>
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

        <p className="text-sm text-muted-foreground">{t("bdOps.footerHint")}</p>
      </div>
    </DashboardLayout>
  );
};

export default BdOperations;
