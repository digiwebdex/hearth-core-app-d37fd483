import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, isAfter, isBefore, addDays, parseISO } from "date-fns";
import {
  Plus, Pencil, Trash2, Plane, Search, Eye, DollarSign,
  CalendarIcon, MapPin, AlertTriangle, Clock, CheckCircle2, XCircle,
  Ticket, Hotel, Stamp, Package, Filter, FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bookingApi, quotationApi, type Booking, type BookingStatus, type BookingType, type Quotation } from "@/lib/api";
import { sendBookingSms } from "@/lib/smsAutomation";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { getServiceTypeLabel } from "@/lib/serviceTypes";

const STATUS_META: { value: BookingStatus; color: string; icon: any }[] = [
  { value: "pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  { value: "confirmed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: CheckCircle2 },
  { value: "ticketed", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", icon: Ticket },
  { value: "traveling", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Plane },
  { value: "completed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  { value: "cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
];

const TYPE_ICONS: Record<BookingType, any> = {
  tour: MapPin,
  ticket: Ticket,
  hotel: Hotel,
  visa: Stamp,
  package: Package,
};

const getStatusMeta = (s: BookingStatus) => STATUS_META.find((x) => x.value === s) || STATUS_META[0];

const emptyForm = {
  type: "tour" as BookingType,
  title: "",
  clientId: "",
  clientName: "",
  agentId: "",
  destination: "",
  travelerCount: 1,
  amount: 0,
  cost: 0,
  status: "pending" as BookingStatus,
  travelDateFrom: "",
  travelDateTo: "",
  internalNotes: "",
};

const Bookings = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<Booking[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [travelDateFrom, setTravelDateFrom] = useState<Date | undefined>();
  const [travelDateTo, setTravelDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);
  const [approvedQuotations, setApprovedQuotations] = useState<Quotation[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookingApi.list();
      setItems(data as any);
    } catch (err: any) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const profit = useMemo(() => form.amount - form.cost, [form.amount, form.cost]);
  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const booking = { ...form, profit: form.amount - form.cost };
    if (editingId) {
      bookingApi.update(editingId, booking).then(() => {
        setItems((prev) => prev.map((b) => b.id === editingId ? { ...b, ...booking } : b));
        toast({ title: t("bookingsForm.bookingUpdated") });
      }).catch((err: any) => {
        toast({ title: t("bookingsForm.updateFailed"), description: err.message, variant: "destructive" });
      });
    } else {
      bookingApi.create(booking).then((created: any) => {
        setItems((prev) => [...prev, created]);
        toast({ title: t("bookingsForm.bookingCreated") });
        sendBookingSms({
          bookingId: created.id,
          bookingType: created.type,
          bookingStatus: created.status,
          bookingAmount: created.amount,
          clientName: created.clientName || created.clientId,
          clientPhone: "",
          company: "Travel Agency",
        }).then((res) => {
          if (res.sent) toast({ title: t("bookingsForm.smsSent") });
        }).catch(() => {});
      }).catch((err: any) => {
        toast({ title: t("bookingsForm.createFailed"), description: err.message, variant: "destructive" });
      });
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (b: Booking) => {
    setForm({
      type: b.type,
      title: b.title || "",
      clientId: b.clientId,
      clientName: b.clientName || "",
      agentId: b.agentId,
      destination: b.destination || "",
      travelerCount: b.travelerCount || 1,
      amount: b.amount,
      cost: b.cost,
      status: b.status,
      travelDateFrom: b.travelDateFrom || "",
      travelDateTo: b.travelDateTo || "",
      internalNotes: b.internalNotes || "",
    });
    setEditingId(b.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    bookingApi.delete(id).then(() => {
      setItems((prev) => prev.filter((b) => b.id !== id));
      toast({ title: t("bookingsForm.bookingDeleted"), variant: "destructive" });
    }).catch((err: any) => {
      toast({ title: t("bookingsForm.deleteFailed"), description: err.message, variant: "destructive" });
    });
  };

  const handleOpenQuotationDialog = async () => {
    setQuotationDialogOpen(true);
    setLoadingQuotations(true);
    try {
      const all = await quotationApi.list();
      setApprovedQuotations((all as Quotation[]).filter((q) => q.status === "approved"));
    } catch {
      setApprovedQuotations([]);
    } finally {
      setLoadingQuotations(false);
    }
  };

  const handleConvertQuotation = async (quotation: Quotation) => {
    try {
      const booking = await quotationApi.convertToBooking(quotation.id);
      setItems((prev) => [booking, ...prev]);
      setQuotationDialogOpen(false);
      toast({
        title: t("bookingsForm.convertedTitle"),
        description: t("bookingsForm.convertedDesc", { name: quotation.title || quotation.destination }),
      });
      navigate(`/bookings/${booking.id}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: t("bookingsForm.conversionFailed"), description: err.message });
    }
  };

  const filtered = useMemo(() => {
    return items.filter((b) => {
      const matchSearch = !search ||
        b.title?.toLowerCase().includes(search.toLowerCase()) ||
        b.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        b.destination?.toLowerCase().includes(search.toLowerCase()) ||
        b.clientId?.toLowerCase().includes(search.toLowerCase()) ||
        b.packageTitleSnapshot?.toLowerCase().includes(search.toLowerCase()) ||
        b.packageCodeSnapshot?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      const matchPayment = paymentFilter === "all" || b.paymentStatus === paymentFilter;
      const matchDest = !destinationFilter || (b.destination || "").toLowerCase().includes(destinationFilter.toLowerCase());
      const matchTravelFrom = !travelDateFrom || (b.travelDateFrom && new Date(b.travelDateFrom) >= travelDateFrom);
      const matchTravelTo = !travelDateTo || (b.travelDateFrom && new Date(b.travelDateFrom) <= travelDateTo);
      return matchSearch && matchStatus && matchPayment && matchDest && matchTravelFrom && matchTravelTo;
    });
  }, [items, search, statusFilter, paymentFilter, destinationFilter, travelDateFrom, travelDateTo]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (destinationFilter) count++;
    if (travelDateFrom) count++;
    if (travelDateTo) count++;
    return count;
  }, [destinationFilter, travelDateFrom, travelDateTo]);

  const now = new Date();
  const upcomingTravel = useMemo(
    () => items.filter((b) => b.travelDateFrom && isAfter(parseISO(b.travelDateFrom), now) && isBefore(parseISO(b.travelDateFrom), addDays(now, 14)) && b.status !== "cancelled" && b.status !== "completed").length,
    [items]
  );

  const unpaidBookings = useMemo(
    () => items.filter((b) => (b.paymentStatus === "unpaid" || b.paymentStatus === "partial") && b.status !== "cancelled").length,
    [items]
  );

  const totals = useMemo(() => {
    const totalAmount = items.reduce((s, b) => s + b.amount, 0);
    const totalCost = items.reduce((s, b) => s + b.cost, 0);
    const totalPaid = items.reduce((s, b) => s + (b.paidAmount || 0), 0);
    return { amount: totalAmount, cost: totalCost, profit: totalAmount - totalCost, paid: totalPaid, due: totalAmount - totalPaid };
  }, [items]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    STATUS_META.forEach((s) => {
      counts[s.value] = items.filter((b) => b.status === s.value).length;
    });
    return counts;
  }, [items]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Plane className="h-8 w-8" /> {t("sidebar.bookings")}
            </h1>
            <p className="text-muted-foreground">{t("pages.bookingsSubtitle")}</p>
          </div>
          <div className="flex gap-2">
            <PermissionGate module="bookings" action="create">
              <Button variant="outline" onClick={handleOpenQuotationDialog}>
                <FileText className="mr-2 h-4 w-4" /> {t("pages.fromQuotation")}
              </Button>
            </PermissionGate>
            <PermissionGate module="bookings" action="create">
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />{t("pages.newBooking")}</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingId ? t("bookingsForm.editBooking") : t("bookingsForm.newBooking")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("bookingsForm.bookingTitle")}</Label>
                      <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("bookingsForm.titlePlaceholder")} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.type")}</Label>
                        <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as BookingType }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tour">{t("bookingsForm.types.tour")}</SelectItem>
                            <SelectItem value="ticket">{t("bookingsForm.types.ticket")}</SelectItem>
                            <SelectItem value="hotel">{t("bookingsForm.types.hotel")}</SelectItem>
                            <SelectItem value="visa">{t("bookingsForm.types.visa")}</SelectItem>
                            <SelectItem value="package">{t("bookingsForm.types.package")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.status")}</Label>
                        <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as BookingStatus }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{t(`bookingsForm.statuses.${s.value}`)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.clientName")}</Label>
                        <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} placeholder={t("bookingsForm.clientPlaceholder")} required />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.agentStaff")}</Label>
                        <Input value={form.agentId} onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))} placeholder={t("bookingsForm.agentPlaceholder")} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.destination")}</Label>
                        <Input value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder={t("bookingsForm.destinationFormPlaceholder")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.travelers")}</Label>
                        <Input type="number" min={1} value={form.travelerCount} onChange={(e) => setForm((f) => ({ ...f, travelerCount: +e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.travelFrom")}</Label>
                        <Input type="date" value={form.travelDateFrom} onChange={(e) => setForm((f) => ({ ...f, travelDateFrom: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.travelTo")}</Label>
                        <Input type="date" value={form.travelDateTo} onChange={(e) => setForm((f) => ({ ...f, travelDateTo: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.sellingAmount")}</Label>
                        <Input type="number" min={0} step={0.01} value={form.amount || ""} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} required />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.cost")}</Label>
                        <Input type="number" min={0} step={0.01} value={form.cost || ""} onChange={(e) => setForm((f) => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} required />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("bookingsForm.profit")}</Label>
                        <div className={`flex h-10 items-center rounded-md border px-3 text-sm font-semibold ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                          ৳{profit.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("bookingsForm.internalNotes")}</Label>
                      <Input value={form.internalNotes} onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))} placeholder={t("bookingsForm.notesPlaceholder")} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">{editingId ? t("bookingsForm.update") : t("bookingsForm.create")}</Button>
                      <DialogClose asChild><Button type="button" variant="outline">{t("bookingsForm.cancel")}</Button></DialogClose>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </PermissionGate>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("bookingsForm.totalBookings")}</div>
                <Plane className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("bookingsForm.revenue")}</div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">৳{totals.amount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("bookingsForm.profitLabel")}</div>
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">৳{totals.profit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className={unpaidBookings > 0 ? "border-amber-300 dark:border-amber-600" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("bookingsForm.unpaid")}</div>
                <AlertTriangle className={`h-4 w-4 ${unpaidBookings > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              </div>
              <p className="text-2xl font-bold">{unpaidBookings}</p>
            </CardContent>
          </Card>
          <Card className={upcomingTravel > 0 ? "border-blue-300 dark:border-blue-600" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{t("bookingsForm.upcoming14")}</div>
                <CalendarIcon className={`h-4 w-4 ${upcomingTravel > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
              </div>
              <p className="text-2xl font-bold">{upcomingTravel}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>
              {t("bookingsForm.all")} ({statusCounts.all})
            </Button>
            {STATUS_META.map((s) => (
              <Button key={s.value} variant={statusFilter === s.value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s.value)}>
                {t(`bookingsForm.statuses.${s.value}`)} ({statusCounts[s.value] || 0})
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 max-w-sm flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("bookingsForm.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder={t("bookingsForm.payment")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("bookingsForm.payments.all")}</SelectItem>
                <SelectItem value="unpaid">{t("bookingsForm.payments.unpaid")}</SelectItem>
                <SelectItem value="partial">{t("bookingsForm.payments.partial")}</SelectItem>
                <SelectItem value="paid">{t("bookingsForm.payments.paid")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)} className="gap-1.5">
              <Filter className="h-4 w-4" /> {t("bookingsForm.filters")}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{activeFilterCount}</Badge>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setDestinationFilter(""); setTravelDateFrom(undefined); setTravelDateTo(undefined); }}>
                {t("bookingsForm.clearFilters")}
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("bookingsForm.destination")}</Label>
                  <Input className="h-8 text-xs" placeholder={t("bookingsForm.destinationPlaceholder")} value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("bookingsForm.travelDateFrom")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-8 text-xs", !travelDateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {travelDateFrom ? format(travelDateFrom, "PP") : t("bookingsForm.any")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={travelDateFrom} onSelect={setTravelDateFrom} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("bookingsForm.travelDateTo")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-8 text-xs", !travelDateTo && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {travelDateTo ? format(travelDateTo, "PP") : t("bookingsForm.any")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={travelDateTo} onSelect={setTravelDateTo} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <LoadingState rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchBookings} />
        ) : items.length === 0 ? (
          <EmptyState icon={Plane} title={t("bookingsForm.noBookingsYet")} description={t("bookingsForm.noBookingsDesc")} actionLabel={t("bookingsForm.newBooking")} onAction={() => setDialogOpen(true)} />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("bookingsForm.booking")}</TableHead>
                    <TableHead>{t("bookingsForm.client")}</TableHead>
                    <TableHead>{t("bookingsForm.destination")}</TableHead>
                    <TableHead>{t("bookingsForm.travelDate")}</TableHead>
                    <TableHead className="text-right">{t("bookingsForm.amount")}</TableHead>
                    <TableHead className="text-right">{t("bookingsForm.profitLabel")}</TableHead>
                    <TableHead>{t("bookingsForm.payment")}</TableHead>
                    <TableHead>{t("bookingsForm.status")}</TableHead>
                    <TableHead className="w-[120px]">{t("bookingsForm.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("bookingsForm.noBookingsFound")}</TableCell></TableRow>
                  ) : (
                    filtered.map((b) => {
                      const meta = getStatusMeta(b.status);
                      const TypeIcon = TYPE_ICONS[b.type] || Plane;
                      return (
                        <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TypeIcon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm truncate max-w-[220px]">{b.title || t("bookingsForm.bookingTypeFallback", { type: t(`bookingsForm.types.${b.type}`) })}</p>
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  <p className="text-xs text-muted-foreground">{t(`bookingsForm.types.${b.type}`)}</p>
                                  {b.serviceType ? <Badge variant="outline" className="text-[10px]">{getServiceTypeLabel(b.serviceType)}</Badge> : null}
                                  {b.packageCodeSnapshot ? <Badge variant="secondary" className="text-[10px]">{b.packageCodeSnapshot}</Badge> : null}
                                </div>
                                {b.packageTitleSnapshot ? <p className="text-[10px] text-muted-foreground truncate max-w-[220px] mt-1">{b.packageTitleSnapshot}</p> : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{b.clientName || b.clientId?.slice(0, 8) || "—"}</TableCell>
                          <TableCell>
                            {b.destination ? (
                              <div className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{b.destination}</div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{b.travelDateFrom || "—"}</TableCell>
                          <TableCell className="text-right font-medium">৳{b.amount.toLocaleString()}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${b.profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                            ৳{b.profit.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {b.paymentStatus ? (
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                b.paymentStatus === "paid" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                b.paymentStatus === "partial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" :
                                "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              )}>{t(`bookingsForm.payments.${b.paymentStatus}`)}</span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>{t(`bookingsForm.statuses.${b.status}`)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" title={t("bookingsForm.view")} onClick={() => navigate(`/bookings/${b.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <PermissionGate module="bookings" action="edit">
                                <Button variant="ghost" size="icon" title={t("bookingsForm.edit")} onClick={() => handleEdit(b)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </PermissionGate>
                              <PermissionGate module="bookings" action="delete">
                                <Button variant="ghost" size="icon" title={t("bookingsForm.delete")} onClick={() => handleDelete(b.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
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
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={quotationDialogOpen} onOpenChange={setQuotationDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("bookingsForm.createFromQuotation")}</DialogTitle>
          </DialogHeader>
          {loadingQuotations ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t("bookingsForm.loadingQuotations")}</div>
          ) : approvedQuotations.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">{t("bookingsForm.noApprovedQuotations")}</p>
              <p className="text-xs text-muted-foreground">{t("bookingsForm.mustBeApproved")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("bookingsForm.selectQuotation")}</p>
              {approvedQuotations.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleConvertQuotation(q)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{q.title || q.destination}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {q.clientName && <span>{q.clientName}</span>}
                      {q.destination && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{q.destination}</span>}
                      <span>{t("bookingsForm.travelersCount", { count: q.travelerCount })}</span>
                    </div>
                    {(q.serviceType || q.packageTitleSnapshot) ? (
                      <div className="flex flex-wrap items-center gap-1 mt-2">
                        {q.serviceType ? <Badge variant="outline" className="text-[10px]">{getServiceTypeLabel(q.serviceType)}</Badge> : null}
                        {q.packageCodeSnapshot ? <Badge variant="secondary" className="text-[10px]">{q.packageCodeSnapshot}</Badge> : null}
                        {q.packageTitleSnapshot ? <p className="text-[10px] text-muted-foreground truncate">{q.packageTitleSnapshot}</p> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-medium">৳{q.grandTotal?.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">v{q.version}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Bookings;
