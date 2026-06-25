import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  quotationApi, type Quotation, type QuotationVersion, type QuotationStatus,
} from "@/lib/api";
import {
  ArrowLeft, Pencil, Copy, Printer, ArrowRight, Send, Clock,
  MapPin, CalendarIcon, Users, DollarSign, Hotel, Plane, Stamp,
  Car, Map, Bike, Shield, Percent, Receipt, FileText, History, Eye,
} from "lucide-react";
import { WorkflowNextStep } from "@/components/WorkflowNextStep";

const STATUS_META: { value: QuotationStatus; color: string }[] = [
  { value: "draft", color: "bg-muted text-muted-foreground" },
  { value: "sent", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "rejected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "expired", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
];

const getStatusMeta = (s: QuotationStatus) => STATUS_META.find((x) => x.value === s) || STATUS_META[0];

const ITEM_ICONS: Record<string, any> = {
  hotel: Hotel, flight: Plane, visa: Stamp, transport: Car, tour: Map,
  activity: Bike, insurance: Shield, service_fee: DollarSign, discount: Percent, tax: Receipt,
};

const QuotationDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [versions, setVersions] = useState<QuotationVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [q, v] = await Promise.all([
        quotationApi.get(id),
        quotationApi.getVersions(id).catch(() => []),
      ]);
      setQuotation(q);
      setVersions(v);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (status: QuotationStatus) => {
    if (!quotation) return;
    try {
      await quotationApi.updateStatus(quotation.id, status);
      setQuotation((p) => p ? { ...p, status } : p);
      toast({ title: t("quotationDetails.statusUpdated", { label: t(`quotationDetails.statuses.${status}`) }) });
    } catch (err: any) {
      toast({ variant: "destructive", title: t("quotationDetails.error"), description: err.message });
    }
  };

  const handleConvert = async () => {
    if (!quotation) return;
    try {
      await quotationApi.convertToBooking(quotation.id);
      toast({ title: t("quotationDetails.bookingCreated") });
      navigate("/bookings");
    } catch (err: any) {
      toast({ variant: "destructive", title: t("quotationDetails.error"), description: err.message });
    }
  };

  const handleDuplicate = async () => {
    if (!quotation) return;
    try {
      const dup = await quotationApi.duplicate(quotation.id);
      toast({ title: t("quotationDetails.duplicated") });
      navigate(`/quotations/${dup.id}/edit`);
    } catch (err: any) {
      toast({ variant: "destructive", title: t("quotationDetails.error"), description: err.message });
    }
  };

  if (loading) return <DashboardLayout><LoadingState rows={8} /></DashboardLayout>;
  if (error || !quotation) return <DashboardLayout><ErrorState message={error || t("quotationDetails.notFound")} onRetry={fetchData} /></DashboardLayout>;

  const statusMeta = getStatusMeta(quotation.status);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <WorkflowNextStep
          current="quotation"
          next="booking"
          nextLabel={t("quotationDetails.actions.convertBooking", { defaultValue: "Create booking" })}
          onNextClick={quotation.status === "approved" ? handleConvert : undefined}
        />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/quotations")} className="mb-1">
              <ArrowLeft className="mr-1 h-4 w-4" /> {t("quotationDetails.back")}
            </Button>
            <h1 className="text-2xl font-bold">{quotation.title || t("quotationDetails.untitled")}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.color}`}>{t(`quotationDetails.statuses.${quotation.status}`)}</span>
              <Badge variant="outline">v{quotation.version || 1}</Badge>
              {quotation.destination && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {quotation.destination}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PermissionGate module="quotations" action="edit">
              <Select value={quotation.status} onValueChange={(v) => handleStatusChange(v as QuotationStatus)}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{t(`quotationDetails.statuses.${s.value}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </PermissionGate>
            <PermissionGate module="quotations" action="edit">
              <Button variant="outline" onClick={() => navigate(`/quotations/${id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" /> {t("quotationDetails.actions.edit")}
              </Button>
            </PermissionGate>
            <PermissionGate module="quotations" action="create">
              <Button variant="outline" onClick={handleDuplicate}>
                <Copy className="mr-2 h-4 w-4" /> {t("quotationDetails.actions.revise")}
              </Button>
            </PermissionGate>
            <Button variant="outline" onClick={() => navigate(`/quotations/${id}/print`)}>
              <Printer className="mr-2 h-4 w-4" /> {t("quotationDetails.actions.print")}
            </Button>
            {quotation.status === "approved" && (
              <PermissionGate module="quotations" action="approve">
                <Button onClick={handleConvert}>
                  <ArrowRight className="mr-2 h-4 w-4" /> {t("quotationDetails.actions.convert")}
                </Button>
              </PermissionGate>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("quotationDetails.stats.grandTotal")}</p>
                <p className="text-xl font-bold">৳{(quotation.grandTotal || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("quotationDetails.stats.estProfit")}</p>
                <p className="text-xl font-bold text-green-600">৳{(quotation.totalProfit || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="h-5 w-5 text-green-600" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("quotationDetails.stats.travelers")}</p>
                <p className="text-xl font-bold">{quotation.travelerCount || 1}</p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("quotationDetails.stats.validUntil")}</p>
                <p className="text-xl font-bold">{quotation.validUntil || "—"}</p>
              </div>
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="itinerary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="itinerary">{t("quotationDetails.tabs.itinerary")}</TabsTrigger>
            <TabsTrigger value="pricing">{t("quotationDetails.tabs.pricing", { count: quotation.items?.length || 0 })}</TabsTrigger>
            <TabsTrigger value="versions">{t("quotationDetails.tabs.versions", { count: versions.length })}</TabsTrigger>
          </TabsList>

          {/* Itinerary */}
          <TabsContent value="itinerary" className="space-y-3">
            {quotation.itinerary?.length ? quotation.itinerary.map((day) => (
              <Card key={day.dayNumber}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      D{day.dayNumber}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{day.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{day.description}</p>
                      {(day.meals || day.accommodation) && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          {day.meals && <span>🍽️ {day.meals}</span>}
                          {day.accommodation && <span>🏨 {day.accommodation}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t("quotationDetails.noItinerary")}</p>
            )}
          </TabsContent>

          {/* Pricing */}
          <TabsContent value="pricing">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("quotationDetails.th.type")}</TableHead>
                      <TableHead>{t("quotationDetails.th.description")}</TableHead>
                      <TableHead>{t("quotationDetails.th.cost")}</TableHead>
                      <TableHead>{t("quotationDetails.th.selling")}</TableHead>
                      <TableHead>{t("quotationDetails.th.qty")}</TableHead>
                      <TableHead>{t("quotationDetails.th.subtotal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotation.items?.map((item, i) => {
                      const Icon = ITEM_ICONS[item.type] || FileText;
                      return (
                        <TableRow key={item.id || i}>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Icon className="h-3.5 w-3.5" />
                              <span>{t(`quotationBuilder.itemTypes.${item.type}`, { defaultValue: item.type.replace("_", " ") })}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-sm">৳{item.costPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-sm">৳{item.sellingPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-sm">{item.quantity}{item.type === "hotel" && item.nights ? ` × ${item.nights}N` : ""}</TableCell>
                          <TableCell className="font-medium">৳{item.subtotal.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="max-w-sm ml-auto space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("quotationDetails.totals.totalCost")}</span>
                    <span>৳{(quotation.totalCost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("quotationDetails.totals.totalSelling")}</span>
                    <span>৳{(quotation.totalSelling || 0).toLocaleString()}</span>
                  </div>
                  {(quotation.discountAmount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>{t("quotationDetails.totals.discount")}</span><span>-৳{quotation.discountAmount?.toLocaleString()}</span>
                    </div>
                  )}
                  {(quotation.taxAmount || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("quotationDetails.totals.tax")}</span><span>+৳{quotation.taxAmount?.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t("quotationDetails.totals.grandTotal")}</span><span>৳{(quotation.grandTotal || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>{t("quotationDetails.totals.profit")}</span><span>৳{(quotation.totalProfit || 0).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Version History */}
          <TabsContent value="versions">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> {t("quotationDetails.versions.title")}</CardTitle></CardHeader>
              <CardContent>
                {versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("quotationDetails.versions.empty")}</p>
                ) : (
                  <div className="space-y-3">
                    {versions.map((v) => (
                      <div key={v.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          v{v.versionNumber}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t("quotationDetails.versions.version", { n: v.versionNumber })}</span>
                            {v.changedByName && <span className="text-xs text-muted-foreground">{t("quotationDetails.versions.by", { name: v.changedByName })}</span>}
                          </div>
                          {v.changeNote && <p className="text-sm text-muted-foreground">{v.changeNote}</p>}
                          <span className="text-xs text-muted-foreground">{v.createdAt?.slice(0, 16).replace("T", " ")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default QuotationDetails;
