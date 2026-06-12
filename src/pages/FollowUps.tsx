import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { leadApi, type Lead, type LeadStatus } from "@/lib/api";
import { CalendarClock, Clock, Phone, Search, Target } from "lucide-react";

type FollowUpFilter = "overdue" | "today" | "upcoming" | "all";

const CLOSED_STATUSES: LeadStatus[] = ["won", "lost"];

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function isActiveLead(lead: Lead) {
  return !CLOSED_STATUSES.includes(lead.status);
}

const FollowUps = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FollowUpFilter>("today");
  const today = todayIso();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await leadApi.list();
      setLeads(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("followUps.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const withFollowUp = useMemo(
    () => leads.filter((l) => isActiveLead(l) && l.nextFollowUp),
    [leads],
  );

  const counts = useMemo(() => {
    const overdue = withFollowUp.filter((l) => l.nextFollowUp! < today).length;
    const dueToday = withFollowUp.filter((l) => l.nextFollowUp === today).length;
    const upcoming = withFollowUp.filter((l) => l.nextFollowUp! > today).length;
    return { overdue, today: dueToday, upcoming, all: withFollowUp.length };
  }, [withFollowUp, today]);

  const filtered = useMemo(() => {
    return withFollowUp
      .filter((l) => {
        if (filter === "overdue") return l.nextFollowUp! < today;
        if (filter === "today") return l.nextFollowUp === today;
        if (filter === "upcoming") return l.nextFollowUp! > today;
        return true;
      })
      .filter((l) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.phone?.includes(search) ||
          l.email?.toLowerCase().includes(q) ||
          l.destination?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.nextFollowUp || "").localeCompare(b.nextFollowUp || ""));
  }, [withFollowUp, filter, search, today]);

  const filterButtons: { key: FollowUpFilter; count: number }[] = [
    { key: "overdue", count: counts.overdue },
    { key: "today", count: counts.today },
    { key: "upcoming", count: counts.upcoming },
    { key: "all", count: counts.all },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-8 w-8" />
            {t("followUps.title")}
          </h1>
          <p className="text-muted-foreground">{t("followUps.subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterButtons.map(({ key, count }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {t(`followUps.filters.${key}`)} ({count})
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder={t("followUps.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <LoadingState rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchLeads} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Target}
            title={t("followUps.emptyTitle")}
            description={t("followUps.emptyDesc")}
            actionLabel={t("sidebar.leads")}
            onAction={() => navigate("/leads")}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("followUps.lead")}</TableHead>
                    <TableHead>{t("followUps.contact")}</TableHead>
                    <TableHead>{t("followUps.destination")}</TableHead>
                    <TableHead>{t("followUps.followUpDate")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => {
                    const overdue = lead.nextFollowUp! < today;
                    const dueToday = lead.nextFollowUp === today;
                    return (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-sm">
                            {lead.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {lead.phone}
                              </span>
                            ) : null}
                            {lead.email ? <span className="text-muted-foreground">{lead.email}</span> : null}
                          </div>
                        </TableCell>
                        <TableCell>{lead.destination || "—"}</TableCell>
                        <TableCell>
                          <span
                            className={
                              overdue
                                ? "text-destructive font-medium"
                                : dueToday
                                  ? "text-orange-600 dark:text-orange-400 font-medium"
                                  : ""
                            }
                          >
                            {lead.nextFollowUp
                              ? format(parseISO(lead.nextFollowUp), "PP")
                              : "—"}
                          </span>
                          {overdue ? (
                            <Badge variant="destructive" className="ml-2 text-[10px]">
                              {t("followUps.overdue")}
                            </Badge>
                          ) : dueToday ? (
                            <Badge className="ml-2 text-[10px]">
                              <Clock className="mr-1 h-3 w-3 inline" />
                              {t("followUps.dueToday")}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {lead.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FollowUps;
