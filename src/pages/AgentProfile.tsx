import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowLeft, UserCog, Briefcase, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { agentApi, bookingApi, type AgentSummary } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getPlan } from "@/lib/plans";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

const AgentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentPlan } = useAuth();
  const { can } = usePermissions();
  const canUseCommission = getPlan(currentPlan).hasAgentCommission;

  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await agentApi.getSummary(id);
      setSummary(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("agentsForm.loading");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleMarkPaid = async (bookingId: string) => {
    try {
      await bookingApi.markCommissionPaid(bookingId);
      toast({ title: t("agentsForm.summary.commissionMarkedPaid") });
      fetchSummary();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("agentsForm.summary.markPaidFailed");
      toast({ title: t("agentsForm.summary.markPaidFailed"), description: message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState rows={6} />
      </DashboardLayout>
    );
  }

  if (error || !summary) {
    return (
      <DashboardLayout>
        <ErrorState message={error || "Not found"} onRetry={fetchSummary} />
      </DashboardLayout>
    );
  }

  const { agent, totalBookings, totalRevenue, pendingCommission, paidCommission, recentBookings } = summary;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/agents")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("agentsForm.title")}
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <UserCog className="h-8 w-8" /> {agent.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {agent.email}{agent.phone ? ` · ${agent.phone}` : ""}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                {t(`agentsForm.statuses.${agent.status}`)}
              </Badge>
              {canUseCommission && (
                <Badge variant="outline">{agent.commissionRate}% {t("agentsForm.summary.commission")}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                {t("agentsForm.summary.totalBookings")}
                <Briefcase className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold mt-1">{totalBookings}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                {t("agentsForm.summary.totalRevenue")}
                <DollarSign className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold mt-1">৳{totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          {canUseCommission && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    {t("agentsForm.summary.pendingCommission")}
                    <Clock className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold mt-1 text-amber-600">৳{pendingCommission.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    {t("agentsForm.summary.paidCommission")}
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold mt-1 text-green-600">৳{paidCommission.toLocaleString()}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("agentsForm.summary.recentBookings")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">{t("agentsForm.summary.noBookings")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("agentsForm.recentBookingsTable.booking")}</TableHead>
                    <TableHead>{t("agentsForm.recentBookingsTable.client")}</TableHead>
                    <TableHead className="text-right">{t("agentsForm.recentBookingsTable.amount")}</TableHead>
                    {canUseCommission && <TableHead className="text-right">{t("agentsForm.recentBookingsTable.commission")}</TableHead>}
                    <TableHead>{t("agentsForm.recentBookingsTable.status")}</TableHead>
                    <TableHead>{t("agentsForm.recentBookingsTable.travelDate")}</TableHead>
                    <TableHead className="w-[140px]">{t("agentsForm.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.title || booking.id.slice(0, 8)}</TableCell>
                      <TableCell>{booking.clientName || "—"}</TableCell>
                      <TableCell className="text-right">৳{booking.amount.toLocaleString()}</TableCell>
                      {canUseCommission && (
                        <TableCell className="text-right">
                          {booking.agentCommissionAmount != null
                            ? `৳${booking.agentCommissionAmount.toLocaleString()}`
                            : "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline">{booking.status}</Badge>
                        {canUseCommission && booking.agentCommissionStatus && (
                          <Badge
                            className={cn(
                              "ml-1",
                              booking.agentCommissionStatus === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800",
                            )}
                            variant="secondary"
                          >
                            {booking.agentCommissionStatus === "paid"
                              ? t("agentsForm.summary.commissionPaid")
                              : t("agentsForm.summary.commissionPending")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{booking.travelDateFrom || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/bookings/${booking.id}`)}>
                            {t("agentsForm.summary.viewBooking")}
                          </Button>
                          {canUseCommission &&
                            booking.agentCommissionStatus === "pending" &&
                            can("agents", "approve") && (
                              <PermissionGate module="agents" action="approve">
                                <Button variant="outline" size="sm" onClick={() => handleMarkPaid(booking.id)}>
                                  {t("agentsForm.summary.markCommissionPaid")}
                                </Button>
                              </PermissionGate>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AgentProfile;
