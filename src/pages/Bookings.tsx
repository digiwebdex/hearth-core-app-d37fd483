import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useMatch, useNavigate, useSearchParams } from "react-router-dom";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useWizard } from "@/hooks/useWizard";
import { WizardStepper } from "@/components/WizardStepper";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, isAfter, isBefore, addDays, parseISO } from "date-fns";
import {
  Plus, Pencil, Trash2, Plane, Search, Eye, DollarSign,
  CalendarIcon, MapPin, AlertTriangle, Clock, CheckCircle2, XCircle,
  Ticket, Hotel, Stamp, Package, Filter, FileText, GraduationCap, HardHat, Car, Shield, HelpCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getTenantBookingTypes, getTenantBookingPresets } from "@/lib/bookingTypeOptions";
import { parseLeadBookingPrefill } from "@/lib/leadNavigation";
import { bookingApi, quotationApi, leadApi, type Booking, type BookingStatus, type BookingType, type Quotation } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { getServiceTypeLabel } from "@/lib/serviceTypes";
import { TicketFields } from "@/components/bookings/TicketFields";
import { TourFields } from "@/components/bookings/TourFields";
import { HotelFields } from "@/components/bookings/HotelFields";
import { VisaFields } from "@/components/bookings/VisaFields";
import { PackageFields } from "@/components/bookings/PackageFields";
import { StudentFields } from "@/components/bookings/StudentFields";
import { ManpowerFields } from "@/components/bookings/ManpowerFields";
import { TransportFields } from "@/components/bookings/TransportFields";
import { InsuranceFields } from "@/components/bookings/InsuranceFields";
import { AgentSelect } from "@/components/bookings/AgentSelect";
import { ClientSelect } from "@/components/bookings/ClientSelect";
import { emptyForm, type BookingFormState } from "@/components/bookings/types";
import {
  buildServiceDetailsFromForm,
  applyServiceDetailsToForm,
  mergeServiceDetailsIntoBooking,
  DEFAULT_OPS_STATUS,
} from "@/lib/bookingServiceDetails";
import {
  bookingMatchesPreset,
  bookingPresetPath,
  bookingPresetToTypeFilter,
  isBookingPreset,
  type BookingPresetId,
} from "@/lib/bookingRoutePresets";

const STATUS_META: { value: BookingStatus; color: string; icon: any }[] = [
  { value: "inquiry", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: HelpCircle },
  { value: "pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  { value: "confirmed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: CheckCircle2 },
  { value: "ticketed", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", icon: Ticket },
  { value: "traveling", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Plane },
  { value: "completed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  { value: "cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
];

const TYPE_ICONS: Record<BookingType, typeof MapPin> = {
  tour: MapPin,
  ticket: Ticket,
  hotel: Hotel,
  visa: Stamp,
  package: Package,
  student: GraduationCap,
  manpower: HardHat,
  transport: Car,
  corporate: Plane,
  insurance: Shield,
};

const getStatusMeta = (s: BookingStatus) => STATUS_META.find((x) => x.value === s) || STATUS_META[0];

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function maskPassport(passport: string): string {
  const p = passport.trim();
  if (!p) return "";
  if (p.length === 1) return `${p}****`;
  return `${p[0]}****${p[p.length - 1]}`;
}

function getBookingTypeInfo(b: Booking): string {
  switch (b.type) {
    case "ticket": {
      const flight = b.flightNumber || "";
      const airline = b.airline || b.supplierName || "";
      const pnr = b.pnrNumber || b.supplierRef || "";
      return [flight, airline, pnr].filter(Boolean).join(" · ");
    }
    case "hotel": {
      const name = b.hotelName || b.supplierName || "";
      const inDate = b.checkInDate || b.travelDateFrom || "";
      const outDate = b.checkOutDate || b.travelDateTo || "";
      return [name, inDate, outDate].filter(Boolean).join(" · ");
    }
    case "visa": {
      const country = b.visaCountry || b.destination || "";
      const passport = b.passportNumber ? maskPassport(b.passportNumber) : "";
      return [country, passport].filter(Boolean).join(" · ");
    }
    case "tour": {
      const dest = b.destination || "";
      const op = b.tourOperator || b.supplierName || "";
      return [dest, op].filter(Boolean).join(" · ");
    }
    case "package": {
      const code = b.packageCodeSnapshot || "";
      const title = b.packageTitleSnapshot || "";
      return [code, title].filter(Boolean).join(" · ");
    }
    case "student": {
      const institute = b.instituteName || b.supplierName || "";
      const program = b.courseProgram || b.supplierRef || "";
      const country = b.visaCountry || b.destination || "";
      return [institute, program, country].filter(Boolean).join(" · ");
    }
    case "manpower": {
      const country = b.workCountry || b.destination || "";
      const employer = b.employer || b.supplierName || "";
      const job = b.jobTitle || b.supplierRef || "";
      return [country, employer, job].filter(Boolean).join(" · ");
    }
    case "transport": {
      const route = b.routeDescription || b.destination || "";
      const pickup = b.pickupLocation || "";
      return [route, pickup].filter(Boolean).join(" · ");
    }
    case "insurance": {
      const plan = (b as Booking & { insurancePlan?: string }).insurancePlan || b.supplierName || "";
      const policy = (b as Booking & { policyNumber?: string }).policyNumber || b.supplierRef || "";
      const dest = (b as Booking & { insuranceDestination?: string }).insuranceDestination || b.destination || "";
      return [plan, dest, policy].filter(Boolean).join(" · ");
    }
    default:
      return "";
  }
}

function formToApiPayload(form: BookingFormState, extra?: { clientPhone?: string; clientEmail?: string }) {
  const profit = form.amount - form.cost;
  const base = {
    type: form.type,
    title: form.title,
    clientId: form.clientId || undefined,
    clientName: form.clientName,
    clientPhone: form.clientPhone || extra?.clientPhone || undefined,
    clientEmail: form.clientEmail || extra?.clientEmail || undefined,
    agentId: form.agentId,
    amount: form.amount,
    cost: form.cost,
    profit,
    status: form.status,
    travelerCount: form.travelerCount,
    internalNotes: form.internalNotes,
    packageId: form.packageId || undefined,
    packageTitleSnapshot: form.packageTitleSnapshot || undefined,
    packageCodeSnapshot: form.packageCodeSnapshot || undefined,
  };

  switch (form.type) {
    case "ticket":
      return {
        ...base,
        destination: form.toCity || form.destination || undefined,
        travelDateFrom: form.departureDate || form.travelDateFrom || undefined,
        travelDateTo: form.returnDate || form.travelDateTo || undefined,
        supplierName: form.airline || undefined,
        supplierRef: form.pnrNumber || form.flightNumber || undefined,
      };
    case "hotel":
      return {
        ...base,
        destination: form.hotelCity || form.hotelName || form.destination || undefined,
        travelDateFrom: form.checkInDate || form.travelDateFrom || undefined,
        travelDateTo: form.checkOutDate || form.travelDateTo || undefined,
        supplierName: form.hotelName || undefined,
        supplierRef: form.confirmationNumber || undefined,
      };
    case "visa":
      return {
        ...base,
        destination: form.visaCountry || form.destination || undefined,
      };
    case "tour":
      return {
        ...base,
        destination: form.destination || undefined,
        travelDateFrom: form.travelDateFrom || undefined,
        travelDateTo: form.travelDateTo || undefined,
        supplierName: form.tourOperator || undefined,
      };
    case "package":
      return {
        ...base,
        destination: form.destination || undefined,
        travelDateFrom: form.travelDateFrom || undefined,
        travelDateTo: form.travelDateTo || undefined,
        packageId: form.packageId || undefined,
      };
    case "student":
      return {
        ...base,
        destination: form.visaCountry || undefined,
        supplierName: form.instituteName || undefined,
        supplierRef: form.courseProgram || undefined,
        travelDateFrom: form.enrollmentDate || undefined,
      };
    case "manpower":
      return {
        ...base,
        destination: form.workCountry || undefined,
        supplierName: form.employer || undefined,
        supplierRef: form.jobTitle || undefined,
      };
    case "transport":
      return {
        ...base,
        destination: form.routeDescription || form.dropoffLocation || undefined,
        travelDateFrom: form.pickupDate || form.travelDateFrom || undefined,
        supplierName: form.transportVendor || undefined,
        supplierRef: form.vehicleType || undefined,
      };
    case "insurance":
      return {
        ...base,
        destination: form.insuranceDestination || undefined,
        travelDateFrom: form.coverageStart || form.travelDateFrom || undefined,
        travelDateTo: form.coverageEnd || form.travelDateTo || undefined,
        travelerCount: form.insuredCount || form.travelerCount,
        supplierName: form.insurancePlan || form.insuranceProvider || undefined,
        supplierRef: form.policyNumber || undefined,
      };
    default:
      return {
        ...base,
        destination: form.destination || undefined,
        travelDateFrom: form.travelDateFrom || undefined,
        travelDateTo: form.travelDateTo || undefined,
      };
  }
}

function withServicePayload(form: BookingFormState, extra?: { clientPhone?: string; clientEmail?: string }) {
  const serviceDetails = buildServiceDetailsFromForm(form);
  return {
    ...formToApiPayload(form, extra),
    serviceDetails,
    opsStatus: String(serviceDetails.workflowStatus || DEFAULT_OPS_STATUS),
  };
}

function bookingToForm(b: Booking): BookingFormState {
  const merged = mergeServiceDetailsIntoBooking(b);
  const form: BookingFormState = {
    ...emptyForm,
    id: merged.id,
    type: merged.type,
    title: merged.title || "",
    clientId: merged.clientId,
    clientName: merged.clientName || "",
    clientPhone: (merged as Booking & { clientPhone?: string }).clientPhone || "",
    clientEmail: (merged as Booking & { clientEmail?: string }).clientEmail || "",
    agentId: merged.agentId || "",
    amount: merged.amount,
    cost: merged.cost,
    status: merged.status,
    travelDateFrom: merged.travelDateFrom || "",
    travelDateTo: merged.travelDateTo || "",
    travelerCount: merged.travelerCount || 1,
    internalNotes: merged.internalNotes || "",
    packageId: merged.packageId || "",
    packageTitleSnapshot: merged.packageTitleSnapshot || "",
    packageCodeSnapshot: merged.packageCodeSnapshot || "",
    destination: merged.destination || "",
    flightNumber: merged.flightNumber || merged.supplierRef || "",
    airline: merged.airline || merged.supplierName || "",
    pnrNumber: merged.pnrNumber || merged.supplierRef || "",
    departureDate: merged.departureDate || merged.travelDateFrom || "",
    returnDate: merged.returnDate || merged.travelDateTo || "",
    tourOperator: merged.tourOperator || merged.supplierName || "",
    hotelName: merged.hotelName || merged.supplierName || "",
    checkInDate: merged.checkInDate || merged.travelDateFrom || "",
    checkOutDate: merged.checkOutDate || merged.travelDateTo || "",
    visaCountry: merged.visaCountry || merged.destination || "",
    passportNumber: merged.passportNumber || "",
    passportExpiry: merged.passportExpiry || "",
    instituteName: merged.instituteName || (merged.type === "student" ? merged.supplierName || "" : ""),
    courseProgram: merged.courseProgram || (merged.type === "student" ? merged.supplierRef || "" : ""),
    enrollmentDate: merged.enrollmentDate || (merged.type === "student" ? merged.travelDateFrom || "" : ""),
    workCountry: merged.workCountry || (merged.type === "manpower" ? merged.destination || "" : ""),
    employer: merged.employer || (merged.type === "manpower" ? merged.supplierName || "" : ""),
    jobTitle: merged.jobTitle || (merged.type === "manpower" ? merged.supplierRef || "" : ""),
    contractDuration: merged.contractDuration || "",
    medicalStatus: (merged.medicalStatus as BookingFormState["medicalStatus"]) || "pending",
    bmetRegistration: merged.bmetRegistration || "",
    routeDescription: merged.routeDescription || merged.destination || "",
    pickupLocation: merged.pickupLocation || "",
    dropoffLocation: merged.dropoffLocation || "",
    pickupDate: merged.pickupDate || merged.travelDateFrom || "",
    pickupTime: merged.pickupTime || "",
    vehicleType: merged.vehicleType || merged.supplierRef || "",
    driverName: merged.driverName || "",
    driverPhone: merged.driverPhone || "",
    transportVendor: merged.transportVendor || merged.supplierName || "",
    insurancePlan: (merged as Record<string, unknown>).insurancePlan as string || (merged.type === "insurance" ? merged.supplierName || "" : ""),
    insuranceProvider: (merged as Record<string, unknown>).insuranceProvider as string || "",
    insuranceDestination: (merged as Record<string, unknown>).insuranceDestination as string || (merged.type === "insurance" ? merged.destination || "" : ""),
    coverageStart: (merged as Record<string, unknown>).coverageStart as string || merged.travelDateFrom || "",
    coverageEnd: (merged as Record<string, unknown>).coverageEnd as string || merged.travelDateTo || "",
    insuredCount: Number((merged as Record<string, unknown>).insuredCount) || merged.travelerCount || 1,
    policyNumber: (merged as Record<string, unknown>).policyNumber as string || (merged.type === "insurance" ? merged.supplierRef || "" : ""),
  };
  return applyServiceDetailsToForm(form, merged.serviceDetails || undefined);
}

/** One row in the New Booking wizard's review/summary step. */
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

const Bookings = () => {
  const { t, i18n } = useTranslation();
  const isBnLang = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [items, setItems] = useState<Booking[]>([]);
  const [form, setForm] = useState<BookingFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [travelDateFrom, setTravelDateFrom] = useState<Date | undefined>();
  const [travelDateTo, setTravelDateTo] = useState<Date | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);
  const [approvedQuotations, setApprovedQuotations] = useState<Quotation[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const { toast } = useToast();
  const { tenant } = useAuth();
  const allowedBookingTypes = useMemo(
    () => getTenantBookingTypes(tenant?.enabledServiceTypes, tenant?.enabledSubcategories),
    [tenant?.enabledServiceTypes, tenant?.enabledSubcategories],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leadPrefillId, setLeadPrefillId] = useState("");
  const leadClientMeta = useRef({ phone: "", email: "" });
  const presetMatch = useMatch("/bookings/:segment");
  const routeSegment = presetMatch?.params.segment;
  const activePreset: BookingPresetId =
    routeSegment && isBookingPreset(routeSegment)
      ? routeSegment
      : location.pathname === "/bookings"
        ? "all"
        : "all";

  const goToBookingPreset = (preset: BookingPresetId) => {
    navigate(bookingPresetPath(preset));
    setTypeFilter(bookingPresetToTypeFilter(preset));
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookingApi.list();
      setItems((data as Booking[]).map((b) => mergeServiceDetailsIntoBooking(b)));
    } catch (err: any) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    const prefill = parseLeadBookingPrefill(searchParams);
    if (!prefill) return;
    const type = allowedBookingTypes.includes(prefill.type) ? prefill.type : (allowedBookingTypes[0] || "tour");
    setForm({
      ...emptyForm,
      type,
      clientName: prefill.clientName,
      title: prefill.destination ? `${prefill.destination} Booking` : `${prefill.clientName} Booking`,
      destination: prefill.destination,
      amount: prefill.amount,
      cost: prefill.amount ? Math.round(prefill.amount * 0.85) : 0,
      travelerCount: prefill.travelerCount,
      travelDateFrom: prefill.travelDateFrom,
      travelDateTo: prefill.travelDateTo,
    });
    setLeadPrefillId(prefill.leadId);
    leadClientMeta.current = { phone: prefill.clientPhone, email: prefill.clientEmail };
    setDialogOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, allowedBookingTypes]);

  useEffect(() => {
    if (routeSegment && isBookingPreset(routeSegment)) {
      setTypeFilter(bookingPresetToTypeFilter(routeSegment));
    } else if (location.pathname === "/bookings") {
      setTypeFilter("all");
    }
  }, [routeSegment, location.pathname]);

  const profit = useMemo(() => form.amount - form.cost, [form.amount, form.cost]);
  // New Booking is a 4-step wizard: Service → Customer → Pricing → Review.
  const wizard = useWizard(4);
  const canProceed = (step: number): boolean => {
    if (step === 1) return !!form.clientName;        // Customer step requires a client
    if (step === 2) return form.amount > 0;           // Pricing step requires a selling amount
    return true;
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    wizard.reset();
  };

  const openCreate = () => {
    resetForm();
    const defaultType = allowedBookingTypes[0] || "tour";
    setForm({ ...emptyForm, type: defaultType });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = withServicePayload(form, leadClientMeta.current);
    if (editingId) {
      bookingApi.update(editingId, payload).then((updated: Booking) => {
        setItems((prev) => prev.map((b) => (b.id === editingId ? mergeServiceDetailsIntoBooking({ ...b, ...updated }) : b)));
        toast({ title: t("bookingsForm.bookingUpdated") });
      }).catch((err: any) => {
        toast({ title: t("bookingsForm.updateFailed"), description: err.message, variant: "destructive" });
      });
    } else {
      bookingApi.create(payload).then(async (created: Booking) => {
        setItems((prev) => [...prev, mergeServiceDetailsIntoBooking(created)]);
        if (leadPrefillId) {
          await leadApi.updateStatus(leadPrefillId, "won").catch(() => {});
          setLeadPrefillId("");
        }
        toast({ title: t("bookingsForm.bookingCreated") });
      }).catch((err: any) => {
        toast({ title: t("bookingsForm.createFailed"), description: err.message, variant: "destructive" });
      });
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (b: Booking) => {
    setForm(bookingToForm(b));
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
      const matchType =
        activePreset !== "all"
          ? bookingMatchesPreset(b, activePreset)
          : typeFilter === "all" || b.type === typeFilter;
      const matchPayment = paymentFilter === "all" || b.paymentStatus === paymentFilter;
      const matchDest = !destinationFilter || (b.destination || "").toLowerCase().includes(destinationFilter.toLowerCase());
      const matchTravelFrom = !travelDateFrom || (b.travelDateFrom && new Date(b.travelDateFrom) >= travelDateFrom);
      const matchTravelTo = !travelDateTo || (b.travelDateFrom && new Date(b.travelDateFrom) <= travelDateTo);
      return matchSearch && matchStatus && matchType && matchPayment && matchDest && matchTravelFrom && matchTravelTo;
    });
  }, [items, search, statusFilter, typeFilter, activePreset, paymentFilter, destinationFilter, travelDateFrom, travelDateTo]);

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

  const totalCount = items.length;
  const tourCount = useMemo(() => items.filter((b) => b.type === "tour").length, [items]);
  const ticketCount = useMemo(() => items.filter((b) => b.type === "ticket").length, [items]);
  const hotelCount = useMemo(() => items.filter((b) => b.type === "hotel").length, [items]);
  const visaCount = useMemo(() => items.filter((b) => b.type === "visa").length, [items]);
  const studentCount = useMemo(() => items.filter((b) => b.type === "student").length, [items]);
  const manpowerCount = useMemo(() => items.filter((b) => b.type === "manpower").length, [items]);
  const hajjCount = useMemo(() => items.filter((b) => bookingMatchesPreset(b, "hajj")).length, [items]);
  const umrahCount = useMemo(() => items.filter((b) => bookingMatchesPreset(b, "umrah")).length, [items]);

  const categoryCounts: Record<BookingPresetId, number> = {
    all: totalCount,
    tour: tourCount,
    flight: ticketCount,
    hotel: hotelCount,
    visa: visaCount,
    hajj: hajjCount,
    umrah: umrahCount,
    student: studentCount,
    manpower: manpowerCount,
  };

  const pageTitle =
    activePreset === "all"
      ? t("sidebar.bookings")
      : t(`bookingsForm.categories.${activePreset}`);

  const categoryPresets = useMemo(
    () => getTenantBookingPresets(tenant?.enabledServiceTypes, tenant?.enabledSubcategories),
    [tenant?.enabledServiceTypes, tenant?.enabledSubcategories],
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Plane className="h-8 w-8" /> {pageTitle}
            </h1>
            <p className="text-muted-foreground">
              {activePreset === "all" ? t("pages.bookingsSubtitle") : t("pages.bookingsCategorySubtitle", { category: pageTitle })}
            </p>
          </div>
          <div className="flex gap-2">
            <PermissionGate module="bookings" action="create">
              <Button variant="outline" onClick={handleOpenQuotationDialog}>
                <FileText className="mr-2 h-4 w-4" /> {t("pages.fromQuotation")}
              </Button>
            </PermissionGate>
            <PermissionGate module="bookings" action="create">
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />{t("pages.newBooking")}</Button>
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
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("bookingsForm.filterStatus")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>
                {t("bookingsForm.allStatuses")} ({statusCounts.all})
              </Button>
              {STATUS_META.map((s) => (
                <Button key={s.value} variant={statusFilter === s.value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s.value)}>
                  {t(`bookingsForm.statuses.${s.value}`)} ({statusCounts[s.value] || 0})
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("bookingsForm.filterCategory")}</p>
            <div className="flex gap-2 flex-wrap">
              <Tab active={activePreset === "all"} onClick={() => goToBookingPreset("all")}>
                {t("bookingsForm.categories.all")} ({categoryCounts.all})
              </Tab>
              {categoryPresets.map((preset) => (
                <Tab key={preset} active={activePreset === preset} onClick={() => goToBookingPreset(preset)}>
                  {t(`bookingsForm.categories.${preset}`)} ({categoryCounts[preset]})
                </Tab>
              ))}
            </div>
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
                                </div>
                                {getBookingTypeInfo(b) ? (
                                  <p className="text-[10px] text-muted-foreground truncate max-w-[220px] mt-1">{getBookingTypeInfo(b)}</p>
                                ) : null}
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

      {/* Create / Edit booking — sectioned slide-over drawer */}
      <Sheet open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>{editingId ? t("bookingsForm.editBooking") : t("bookingsForm.newBooking")}</SheetTitle>
            <SheetDescription>
              {isBnLang
                ? "ধাপে ধাপে পূরণ করুন — সার্ভিস, কাস্টমার, মূল্য ও রিভিউ।"
                : "Step through: service, customer, pricing, then review."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={(e) => { if (!wizard.isLast) { e.preventDefault(); return; } handleSubmit(e); }} className="mt-4 space-y-4">
            <WizardStepper
              steps={isBnLang ? ["সার্ভিস", "কাস্টমার", "মূল্য", "রিভিউ"] : ["Service", "Customer", "Pricing", "Review"]}
              current={wizard.step}
              onStepClick={wizard.goTo}
            />
            {wizard.step === 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isBnLang ? "১. সার্ভিসের তথ্য" : "1. Service details"}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("bookingsForm.type")}</Label>
                  <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as BookingType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allowedBookingTypes.map((bt) => (
                        <SelectItem key={bt} value={bt}>{t(`bookingsForm.types.${bt}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("bookingsForm.status")}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as BookingStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(editingId ? STATUS_META : STATUS_META.filter((s) => s.value === "inquiry" || s.value === "pending" || s.value === "confirmed")).map((s) => (
                        <SelectItem key={s.value} value={s.value}>{t(`bookingsForm.statuses.${s.value}`, { defaultValue: s.value })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("bookingsForm.bookingTitle")}</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("bookingsForm.titlePlaceholder")} />
              </div>
              {form.type === "ticket" && <TicketFields form={form} setForm={setForm} />}
              {form.type === "tour" && <TourFields form={form} setForm={setForm} />}
              {form.type === "hotel" && <HotelFields form={form} setForm={setForm} />}
              {form.type === "visa" && <VisaFields form={form} setForm={setForm} />}
              {form.type === "transport" && <TransportFields form={form} setForm={setForm} />}
              {form.type === "insurance" && <InsuranceFields form={form} setForm={setForm} />}
              {form.type === "package" && <PackageFields form={form} setForm={setForm} />}
              {form.type === "student" && <StudentFields form={form} setForm={setForm} />}
              {form.type === "manpower" && <ManpowerFields form={form} setForm={setForm} />}
              {(form.type === "tour" || form.type === "package") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("bookingsForm.travelFrom")}</Label>
                    <DatePicker value={form.travelDateFrom} onChange={(iso) => setForm((f) => ({ ...f, travelDateFrom: iso }))} placeholder={isBnLang ? "তারিখ" : "Pick a date"} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("bookingsForm.travelTo")}</Label>
                    <DatePicker value={form.travelDateTo} onChange={(iso) => setForm((f) => ({ ...f, travelDateTo: iso }))} placeholder={isBnLang ? "তারিখ" : "Pick a date"} />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("bookingsForm.travelers")}</Label>
                <Input type="number" min={1} value={form.travelerCount} onChange={(e) => setForm((f) => ({ ...f, travelerCount: +e.target.value }))} />
              </div>
            </section>
            )}

            {wizard.step === 1 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isBnLang ? "২. কাস্টমার ও এজেন্ট" : "2. Customer & Agent"}
              </p>
              <ClientSelect
                value={{ clientId: form.clientId, clientName: form.clientName, clientPhone: form.clientPhone, clientEmail: form.clientEmail }}
                onChange={(v) => setForm((f) => ({ ...f, clientId: v.clientId, clientName: v.clientName, clientPhone: v.clientPhone || "", clientEmail: v.clientEmail || "" }))}
              />
              {form.clientName && !form.clientId ? (
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-dashed p-3 bg-muted/30">
                  <div className="space-y-2">
                    <Label className="text-xs">{isBnLang ? "ফোন (নতুন ক্লায়েন্ট)" : "Phone (new client)"}</Label>
                    <Input value={form.clientPhone} onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))} placeholder="01XXXXXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{isBnLang ? "ইমেইল (ঐচ্ছিক)" : "Email (optional)"}</Label>
                    <Input type="email" value={form.clientEmail} onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))} placeholder="name@email.com" />
                  </div>
                </div>
              ) : null}
              <AgentSelect value={form.agentId} onChange={(agentId) => setForm((f) => ({ ...f, agentId }))} />
            </section>
            )}

            {wizard.step === 2 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isBnLang ? "৩. মূল্য" : "3. Pricing"}
              </p>
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
            </section>
            )}

            {wizard.step === 3 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isBnLang ? "৪. রিভিউ" : "4. Review"}
              </p>
              <div className="rounded-lg border divide-y text-sm">
                <ReviewRow label={isBnLang ? "সার্ভিস" : "Service"} value={t(`bookingsForm.types.${form.type}`, { defaultValue: form.type })} />
                {form.title ? <ReviewRow label={isBnLang ? "টাইটেল" : "Title"} value={form.title} /> : null}
                <ReviewRow label={isBnLang ? "ক্লায়েন্ট" : "Client"} value={form.clientName || "—"} />
                <ReviewRow label={isBnLang ? "ট্রাভেলার" : "Travelers"} value={String(form.travelerCount)} />
                <ReviewRow label={isBnLang ? "বিক্রয় মূল্য" : "Selling"} value={`৳${(form.amount || 0).toLocaleString()}`} />
                <ReviewRow label={isBnLang ? "খরচ" : "Cost"} value={`৳${(form.cost || 0).toLocaleString()}`} />
                <ReviewRow label={isBnLang ? "লাভ" : "Profit"} value={`৳${profit.toLocaleString()}`} />
                <ReviewRow label={isBnLang ? "স্ট্যাটাস" : "Status"} value={t(`bookingsForm.statuses.${form.status}`, { defaultValue: form.status })} />
              </div>
            </section>
            )}

            <div className="flex gap-2 border-t pt-4 sticky bottom-0 bg-background">
              {!wizard.isFirst && (
                <Button type="button" variant="outline" onClick={wizard.back}>
                  {isBnLang ? "পূর্ববর্তী" : "Back"}
                </Button>
              )}
              {!wizard.isLast ? (
                <Button type="button" className="flex-1" disabled={!canProceed(wizard.step)} onClick={() => wizard.next(canProceed(wizard.step))}>
                  {isBnLang ? "পরবর্তী" : "Next"}
                </Button>
              ) : (
                <Button type="submit" className="flex-1" disabled={!form.clientName || form.amount <= 0}>
                  {editingId ? t("bookingsForm.update") : t("bookingsForm.create")}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                {t("bookingsForm.cancel")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

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
