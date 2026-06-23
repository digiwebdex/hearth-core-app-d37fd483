import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getTenantServiceTypes, getTenantQuotationItemTypes } from "@/lib/bookingTypeOptions";
import {
  quotationApi, type QuotationItem, type QuotationItemType,
  type ItineraryDay, type QuotationStatus,
} from "@/lib/api";
import { travelPackageApi, type TravelPackage } from "@/lib/travelPackageApi";
import { SERVICE_TYPES, getServiceTypeLabel, type ServiceType } from "@/lib/serviceTypes";
import {
  ArrowLeft, Save, Plus, Trash2, Hotel, Plane, Stamp, Car, Map, Bike,
  Shield, DollarSign, Percent, Receipt, CalendarIcon, ChevronUp, ChevronDown, FileText,
} from "lucide-react";
import MasterDataSelect from "@/components/MasterDataSelect";
import QuotationCatalogPicker from "@/components/QuotationCatalogPicker";

const ITEM_TYPES: { value: QuotationItemType; labelKey: string; icon: any }[] = [
  { value: "hotel", labelKey: "hotel", icon: Hotel },
  { value: "flight", labelKey: "flight", icon: Plane },
  { value: "visa", labelKey: "visa", icon: Stamp },
  { value: "transport", labelKey: "transport", icon: Car },
  { value: "tour", labelKey: "tour", icon: Map },
  { value: "activity", labelKey: "activity", icon: Bike },
  { value: "insurance", labelKey: "insurance", icon: Shield },
  { value: "service_fee", labelKey: "service_fee", icon: DollarSign },
  { value: "discount", labelKey: "discount", icon: Percent },
  { value: "tax", labelKey: "tax", icon: Receipt },
];

const makeId = () => `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const emptyItem = (day?: number): QuotationItem => ({
  id: makeId(), type: "hotel", day, description: "", details: "", supplier: "",
  costPrice: 0, markupPercent: 15, sellingPrice: 0, quantity: 1, nights: 1, subtotal: 0,
});

const emptyDay = (num: number): ItineraryDay => ({
  dayNumber: num, date: "", title: `Day ${num}`, description: "",
  meals: "", accommodation: "", activities: [],
});

const calcSellingPrice = (cost: number, markup: number) => Math.round(cost * (1 + markup / 100));
const calcSubtotal = (price: number, qty: number) => price * qty;

const mapServiceTypeToItemType = (serviceType: ServiceType): QuotationItemType => {
  switch (serviceType) {
    case "air_ticket":
      return "flight";
    case "visa":
      return "visa";
    case "hotel":
      return "hotel";
    case "transport":
      return "transport";
    default:
      return "tour";
  }
};

const QuotationBuilder = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const { toast } = useToast();
  const { tenant } = useAuth();

  const allowedServiceTypes = useMemo(
    () => getTenantServiceTypes(tenant?.enabledServiceTypes, tenant?.enabledSubcategories),
    [tenant?.enabledServiceTypes, tenant?.enabledSubcategories],
  );
  const allowedItemTypes = useMemo(
    () => getTenantQuotationItemTypes(tenant?.enabledServiceTypes, tenant?.enabledSubcategories),
    [tenant?.enabledServiceTypes, tenant?.enabledSubcategories],
  );
  const visibleItemTypes = useMemo(
    () => ITEM_TYPES.filter((it) => allowedItemTypes.includes(it.value)),
    [allowedItemTypes],
  );

  const packagePrefillId = searchParams.get("packageId");

  const [title, setTitle] = useState("Thailand Family Tour — 5 Nights / 6 Days");
  const [destination, setDestination] = useState("Bangkok & Pattaya, Thailand");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [leadName, setLeadName] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("tour_international");
  const [packageId, setPackageId] = useState<string>("none");
  const [packageTitleSnapshot, setPackageTitleSnapshot] = useState("");
  const [packageCodeSnapshot, setPackageCodeSnapshot] = useState("");
  const [availablePackages, setAvailablePackages] = useState<TravelPackage[]>([]);
  const [travelerCount, setTravelerCount] = useState(2);
  const [travelFrom, setTravelFrom] = useState<Date | undefined>();
  const [travelTo, setTravelTo] = useState<Date | undefined>();
  const [validUntil, setValidUntil] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "• 50% advance payment required at the time of booking confirmation.\n• Balance payment due 15 days before departure.\n• Cancellation charges apply as per company policy.\n• Passport must be valid for at least 6 months from travel date.\n• Prices are subject to change based on availability and exchange rates.\n• Travel insurance is strongly recommended for all passengers."
  );
  const [items, setItems] = useState<QuotationItem[]>([
    { id: makeId(), type: "flight", description: "Dhaka → Bangkok (Round Trip) — Thai Airways", details: "Economy class, 30kg baggage", supplier: "Thai Airways", costPrice: 32000, markupPercent: 10, sellingPrice: 35200, quantity: 2, subtotal: 70400 },
    { id: makeId(), type: "hotel", description: "Novotel Bangkok Sukhumvit — Deluxe Room", details: "Breakfast included, city view", supplier: "Novotel Hotels", costPrice: 5500, markupPercent: 20, sellingPrice: 6600, quantity: 1, nights: 3, subtotal: 19800 },
    { id: makeId(), type: "hotel", description: "Hilton Pattaya — Sea View Room", details: "Breakfast included, beachfront", supplier: "Hilton Hotels", costPrice: 7000, markupPercent: 20, sellingPrice: 8400, quantity: 1, nights: 2, subtotal: 16800 },
    { id: makeId(), type: "transport", description: "Airport Transfer — Bangkok (Round Trip)", details: "Private sedan, meet & greet", supplier: "Local Transport Co.", costPrice: 2000, markupPercent: 25, sellingPrice: 2500, quantity: 2, subtotal: 5000 },
    { id: makeId(), type: "tour", description: "Bangkok City Tour — Grand Palace, Wat Pho, Wat Arun", details: "Full day with English guide, lunch included", supplier: "Siam Tours", costPrice: 3500, markupPercent: 30, sellingPrice: 4550, quantity: 2, subtotal: 9100 },
    { id: makeId(), type: "activity", description: "Coral Island Tour with Speedboat", details: "Snorkeling, parasailing, lunch on island", supplier: "Pattaya Adventures", costPrice: 2800, markupPercent: 25, sellingPrice: 3500, quantity: 2, subtotal: 7000 },
    { id: makeId(), type: "visa", description: "Thailand Visa on Arrival Assistance", details: "Document preparation, fast track", supplier: "In-house", costPrice: 500, markupPercent: 100, sellingPrice: 1000, quantity: 2, subtotal: 2000 },
    { id: makeId(), type: "insurance", description: "Travel Insurance — 7 Days Coverage", details: "Medical, trip cancellation, baggage loss", supplier: "Guardian Life", costPrice: 800, markupPercent: 25, sellingPrice: 1000, quantity: 2, subtotal: 2000 },
    { id: makeId(), type: "service_fee", description: "Service & Processing Fee", supplier: "In-house", costPrice: 0, markupPercent: 0, sellingPrice: 3000, quantity: 1, subtotal: 3000 },
  ]);
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([
    { dayNumber: 1, title: "Arrival in Bangkok", description: "Arrive at Suvarnabhumi Airport. Meet & greet by our representative. Private transfer to Novotel Bangkok Sukhumvit. Check-in and rest. Evening free for exploring nearby street food markets and Sukhumvit nightlife.", meals: "Dinner on own", accommodation: "Novotel Bangkok Sukhumvit" },
    { dayNumber: 2, title: "Bangkok City Tour", description: "Full-day guided tour of Bangkok's iconic landmarks. Visit the magnificent Grand Palace, the ancient Wat Pho with its famous Reclining Buddha, and cross the river to the stunning Wat Arun (Temple of Dawn). Lunch at a riverside Thai restaurant.", meals: "Breakfast, Lunch", accommodation: "Novotel Bangkok Sukhumvit" },
    { dayNumber: 3, title: "Bangkok → Pattaya", description: "After breakfast, check out and private transfer to Pattaya (approx. 2 hours). Check in at Hilton Pattaya. Afternoon free to explore Walking Street, enjoy the beachfront promenade, or relax at the hotel pool.", meals: "Breakfast", accommodation: "Hilton Pattaya" },
    { dayNumber: 4, title: "Coral Island Excursion", description: "Speedboat to Coral Island (Koh Larn). Full day of beach activities including snorkeling in crystal-clear waters, optional parasailing, and a delicious seafood lunch on the island. Return to hotel by late afternoon.", meals: "Breakfast, Lunch", accommodation: "Hilton Pattaya" },
    { dayNumber: 5, title: "Free Day & Shopping", description: "Day at leisure. Optional visits to Nong Nooch Tropical Garden, Sanctuary of Truth, or shopping at Central Festival Pattaya Beach mall. Pack and prepare for departure.", meals: "Breakfast", accommodation: "Hilton Pattaya" },
    { dayNumber: 6, title: "Departure", description: "After breakfast, check out from hotel. Private transfer to Suvarnabhumi Airport for your return flight to Dhaka. End of a memorable Thailand experience!", meals: "Breakfast", accommodation: "—" },
  ]);

  useEffect(() => {
    if (!allowedServiceTypes.includes(serviceType)) {
      setServiceType(allowedServiceTypes[0] || "custom");
    }
  }, [allowedServiceTypes, serviceType]);

  useEffect(() => {
    setPackagesLoading(true);
    travelPackageApi.list()
      .then((data) => setAvailablePackages(data))
      .catch(() => {})
      .finally(() => setPackagesLoading(false));
  }, []);

  useEffect(() => {
    if (!id) return;
    quotationApi.get(id).then((q: any) => {
      setTitle(q.title || "");
      setDestination(q.destination || "");
      setClientName(q.clientName || "");
      setClientId(q.clientId || "");
      setLeadName(q.leadName || "");
      setServiceType((q.serviceType as ServiceType) || "custom");
      setPackageId(q.packageId || "none");
      setPackageTitleSnapshot(q.packageTitleSnapshot || "");
      setPackageCodeSnapshot(q.packageCodeSnapshot || "");
      setTravelerCount(q.travelerCount || 2);
      setTravelFrom(q.travelDateFrom ? new Date(q.travelDateFrom) : undefined);
      setTravelTo(q.travelDateTo ? new Date(q.travelDateTo) : undefined);
      setValidUntil(q.validUntil ? new Date(q.validUntil) : undefined);
      setNotes(q.notes || "");
      setTerms(q.termsAndConditions || "");
      if (q.items?.length) setItems(q.items);
      if (q.itinerary?.length) setItinerary(q.itinerary);
      setLoading(false);
    }).catch(() => {
      toast({ variant: "destructive", title: t("quotationBuilder.errorLoading") });
      setLoading(false);
    });
  }, [id, toast, t]);

  const filteredPackages = useMemo(() => {
    return availablePackages.filter((item) => serviceType === "custom" || item.serviceType === serviceType);
  }, [availablePackages, serviceType]);

  const selectedPackage = useMemo(
    () => availablePackages.find((pkg) => pkg.id === packageId) || null,
    [availablePackages, packageId]
  );

  useEffect(() => {
    if (!selectedPackage) return;
    setPackageTitleSnapshot(selectedPackage.title || "");
    setPackageCodeSnapshot(selectedPackage.code || "");
  }, [selectedPackage]);

  const applyPackageTemplate = (pkg: TravelPackage, full?: any) => {
    const normalizedServiceType = (pkg.serviceType as ServiceType) || serviceType;
    const itemType = mapServiceTypeToItemType(normalizedServiceType);
    const suggestedTravelers = Math.max(1, Number(full?.pricing?.[0]?.travelerMin || 1));
    const unitPrice = Number(full?.pricing?.[0]?.price || full?.basePrice || pkg.basePrice || 0);
    const itemNights = itemType === "hotel" ? Math.max(1, Number(full?.durationNights || pkg.durationNights || 1)) : 1;
    const itemQty = suggestedTravelers;

    setServiceType(normalizedServiceType);
    setPackageTitleSnapshot(pkg.title || "");
    setPackageCodeSnapshot(pkg.code || "");
    setTitle(pkg.title || "");
    setDestination(pkg.destination || "");
    setTravelerCount(suggestedTravelers);

    if (Array.isArray(full?.days) && full.days.length > 0) {
      setItinerary(full.days.map((day: any, index: number) => ({
        dayNumber: Number(day.dayNumber || index + 1),
        date: "",
        title: day.title || `Day ${index + 1}`,
        description: day.description || "",
        meals: "",
        accommodation: day.overnightLocation || "",
        activities: [],
      })));
    } else {
      const totalDays = Math.max(1, Number(full?.durationDays || pkg.durationDays || 1));
      setItinerary(Array.from({ length: totalDays }, (_, index) => emptyDay(index + 1)));
    }

    if (unitPrice > 0) {
      const subtotal = calcSubtotal(unitPrice, itemQty * (itemType === "hotel" ? itemNights : 1));
      setItems([
        {
          id: makeId(),
          type: itemType,
          description: pkg.title || "",
          details: full?.summary || pkg.summary || "",
          supplier: "Package Template",
          costPrice: unitPrice,
          markupPercent: 0,
          sellingPrice: unitPrice,
          quantity: itemQty,
          nights: itemType === "hotel" ? itemNights : 1,
          subtotal,
        },
      ]);
    }
  };

  const handlePackageChange = async (value: string) => {
    setPackageId(value);
    if (value === "none") {
      setPackageTitleSnapshot("");
      setPackageCodeSnapshot("");
      return;
    }

    const pkg = availablePackages.find((item) => item.id === value);
    if (!pkg) return;

    try {
      const full = await travelPackageApi.get(value);
      applyPackageTemplate(pkg, full);
    } catch {
      applyPackageTemplate(pkg);
    }
  };

  useEffect(() => {
    if (isEdit || prefillApplied || !packagePrefillId || availablePackages.length === 0) return;
    setPrefillApplied(true);
    void handlePackageChange(packagePrefillId);
  }, [isEdit, prefillApplied, packagePrefillId, availablePackages]);

  const updateItem = (itemId: string, updates: Partial<QuotationItem>) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const merged = { ...item, ...updates };
      if ("costPrice" in updates || "markupPercent" in updates) {
        merged.sellingPrice = calcSellingPrice(merged.costPrice, merged.markupPercent);
      }
      merged.subtotal = calcSubtotal(merged.sellingPrice, merged.quantity * (merged.type === "hotel" ? (merged.nights || 1) : 1));
      return merged;
    }));
  };

  const addItem = (day?: number) => setItems((prev) => [...prev, emptyItem(day)]);
  const removeItem = (itemId: string) => setItems((prev) => prev.filter((i) => i.id !== itemId));

  const addDay = () => setItinerary((prev) => [...prev, emptyDay(prev.length + 1)]);
  const removeDay = (num: number) => setItinerary((prev) =>
    prev.filter((d) => d.dayNumber !== num).map((d, i) => ({ ...d, dayNumber: i + 1 }))
  );
  const updateDay = (num: number, updates: Partial<ItineraryDay>) => {
    setItinerary((prev) => prev.map((d) => d.dayNumber === num ? { ...d, ...updates } : d));
  };
  const moveDay = (num: number, dir: "up" | "down") => {
    setItinerary((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((d) => d.dayNumber === num);
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return arr;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return arr.map((d, i) => ({ ...d, dayNumber: i + 1 }));
    });
  };

  const totals = useMemo(() => {
    const lineItems = items.filter((i) => i.type !== "discount" && i.type !== "tax");
    const discounts = items.filter((i) => i.type === "discount");
    const taxes = items.filter((i) => i.type === "tax");
    const totalCost = lineItems.reduce((s, i) => s + i.costPrice * i.quantity * (i.type === "hotel" ? (i.nights || 1) : 1), 0);
    const totalSelling = lineItems.reduce((s, i) => s + i.subtotal, 0);
    const discountAmount = discounts.reduce((s, i) => s + i.subtotal, 0);
    const taxAmount = taxes.reduce((s, i) => s + i.subtotal, 0);
    const grandTotal = totalSelling - discountAmount + taxAmount;
    const totalProfit = totalSelling - totalCost;
    return { totalCost, totalSelling, totalProfit, discountAmount, taxAmount, grandTotal };
  }, [items]);

  const handleSave = async (status?: QuotationStatus) => {
    setSaving(true);
    const payload: any = {
      title,
      destination,
      clientId: clientId || undefined,
      clientName: clientName || undefined,
      leadName: leadName || undefined,
      serviceType,
      packageId: packageId === "none" ? undefined : packageId,
      packageTitleSnapshot: packageTitleSnapshot || undefined,
      packageCodeSnapshot: packageCodeSnapshot || undefined,
      travelerCount,
      travelDateFrom: travelFrom ? format(travelFrom, "yyyy-MM-dd") : undefined,
      travelDateTo: travelTo ? format(travelTo, "yyyy-MM-dd") : undefined,
      validUntil: validUntil ? format(validUntil, "yyyy-MM-dd") : undefined,
      notes,
      termsAndConditions: terms,
      items,
      itinerary,
      status: status || "draft",
      ...totals,
    };
    try {
      if (isEdit) {
        await quotationApi.update(id!, payload);
        toast({ title: t("quotationBuilder.updated") });
      } else {
        const created = await quotationApi.create(payload);
        toast({ title: t("quotationBuilder.created") });
        navigate(`/quotations/${created.id}`);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: t("quotationBuilder.error"), description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const DatePick = ({ label, date, onChange }: { label: string; date?: Date; onChange: (d?: Date) => void }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : t("quotationBuilder.pickDate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  if (loading) return <DashboardLayout><LoadingState rows={8} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/quotations")} className="mb-1">
              <ArrowLeft className="mr-1 h-4 w-4" /> {t("quotationBuilder.back")}
            </Button>
            <h1 className="text-2xl font-bold">{isEdit ? t("quotationBuilder.editTitle") : t("quotationBuilder.newTitle")}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {t("quotationBuilder.saveDraft")}
            </Button>
            <Button onClick={() => handleSave("sent")} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {t("quotationBuilder.saveSend")}
            </Button>
          </div>
        </div>

        {selectedPackage ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{getServiceTypeLabel(serviceType)}</Badge>
                  {packageCodeSnapshot ? <Badge variant="secondary">{packageCodeSnapshot}</Badge> : null}
                </div>
                <p className="text-sm font-medium mt-2">{packageTitleSnapshot || selectedPackage.title}</p>
                <p className="text-sm text-muted-foreground">{selectedPackage.destination || destination || t("quotationBuilder.details.destination")}</p>
              </div>
              <Button variant="outline" onClick={() => handlePackageChange(selectedPackage.id)}>
                <FileText className="mr-2 h-4 w-4" /> {t("pages.fromQuotation")}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">{t("quotationBuilder.tabs.details")}</TabsTrigger>
            <TabsTrigger value="itinerary">{t("quotationBuilder.tabs.itinerary", { count: itinerary.length })}</TabsTrigger>
            <TabsTrigger value="pricing">{t("quotationBuilder.tabs.pricing", { count: items.length })}</TabsTrigger>
            <TabsTrigger value="notes">{t("quotationBuilder.tabs.notes")}</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">{t("quotationBuilder.details.section")}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service Type</Label>
                    <Select value={serviceType} onValueChange={(value: ServiceType) => { setServiceType(value); setPackageId("none"); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allowedServiceTypes.map((type) => (
                          <SelectItem key={type} value={type}>{getServiceTypeLabel(type)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Package Template</Label>
                    <Select value={packageId} onValueChange={handlePackageChange}>
                      <SelectTrigger><SelectValue placeholder={packagesLoading ? "Loading packages..." : "Select package (optional)"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No package selected</SelectItem>
                        {filteredPackages.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>{pkg.code} — {pkg.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPackage ? (
                      <p className="text-xs text-muted-foreground">Using package: {selectedPackage.code} • {selectedPackage.currency || "BDT"} {Number(selectedPackage.basePrice || 0).toLocaleString()}</p>
                    ) : null}
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>{t("quotationBuilder.details.title")}</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("quotationBuilder.details.titlePh")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("quotationBuilder.details.clientName")}</Label>
                    <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t("quotationBuilder.details.clientNamePh")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("quotationBuilder.details.leadName")}</Label>
                    <Input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder={t("quotationBuilder.details.leadNamePh")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("quotationBuilder.details.destination")}</Label>
                    <MasterDataSelect category="city" value={destination} onChange={setDestination} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("quotationBuilder.details.travelers")}</Label>
                    <Input type="number" min={1} value={travelerCount} onChange={(e) => setTravelerCount(+e.target.value)} />
                  </div>
                  <DatePick label={t("quotationBuilder.details.travelFrom")} date={travelFrom} onChange={setTravelFrom} />
                  <DatePick label={t("quotationBuilder.details.travelTo")} date={travelTo} onChange={setTravelTo} />
                  <DatePick label={t("quotationBuilder.details.validUntil")} date={validUntil} onChange={setValidUntil} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="itinerary" className="space-y-4">
            {itinerary.map((day) => (
              <Card key={day.dayNumber}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{t("quotationBuilder.itinerary.dayBadge", { n: day.dayNumber })}</Badge>
                      <Input
                        className="h-8 font-medium border-none shadow-none px-1 text-base focus-visible:ring-0"
                        value={day.title}
                        onChange={(e) => updateDay(day.dayNumber, { title: e.target.value })}
                        placeholder={t("quotationBuilder.itinerary.dayTitlePh")}
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDay(day.dayNumber, "up")} disabled={day.dayNumber === 1}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDay(day.dayNumber, "down")} disabled={day.dayNumber === itinerary.length}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDay(day.dayNumber)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">{t("quotationBuilder.itinerary.description")}</Label>
                    <Textarea rows={3} value={day.description} onChange={(e) => updateDay(day.dayNumber, { description: e.target.value })} placeholder={t("quotationBuilder.itinerary.descriptionPh")} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">{t("quotationBuilder.itinerary.meals")}</Label>
                      <Input value={day.meals || ""} onChange={(e) => updateDay(day.dayNumber, { meals: e.target.value })} placeholder={t("quotationBuilder.itinerary.mealsPh")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">{t("quotationBuilder.itinerary.accommodation")}</Label>
                      <Input value={day.accommodation || ""} onChange={(e) => updateDay(day.dayNumber, { accommodation: e.target.value })} placeholder={t("quotationBuilder.itinerary.accommodationPh")} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addDay} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> {t("quotationBuilder.itinerary.addDay", { n: itinerary.length + 1 })}
            </Button>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t("quotationBuilder.pricing.lineItems")}</CardTitle>
                  <Button size="sm" onClick={() => addItem()}><Plus className="mr-1 h-3.5 w-3.5" /> {t("quotationBuilder.pricing.addItem")}</Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">{t("quotationBuilder.pricing.th.type")}</TableHead>
                      <TableHead className="min-w-[200px]">{t("quotationBuilder.pricing.th.description")}</TableHead>
                      <TableHead className="w-[100px]">{t("quotationBuilder.pricing.th.cost")}</TableHead>
                      <TableHead className="w-[80px]">{t("quotationBuilder.pricing.th.markup")}</TableHead>
                      <TableHead className="w-[100px]">{t("quotationBuilder.pricing.th.selling")}</TableHead>
                      <TableHead className="w-[60px]">{t("quotationBuilder.pricing.th.qty")}</TableHead>
                      <TableHead className="w-[60px]">{t("quotationBuilder.pricing.th.nights")}</TableHead>
                      <TableHead className="w-[100px]">{t("quotationBuilder.pricing.th.subtotal")}</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const Icon = visibleItemTypes.find((it) => it.value === item.type)?.icon || FileText;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Select value={item.type} onValueChange={(v) => updateItem(item.id, { type: v as QuotationItemType })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {visibleItemTypes.map((it) => (
                                  <SelectItem key={it.value} value={it.value}>
                                    <div className="flex items-center gap-1.5"><it.icon className="h-3 w-3" />{t(`quotationBuilder.itemTypes.${it.labelKey}`)}</div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <Input className="h-8 text-xs flex-1" value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder={t("quotationBuilder.pricing.descriptionPh")} />
                              </div>
                              <QuotationCatalogPicker
                                itemType={item.type}
                                onPick={(description, supplier) => updateItem(item.id, { description, supplier: supplier || item.supplier })}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input type="number" className="h-8 text-xs" value={item.costPrice} onChange={(e) => updateItem(item.id, { costPrice: +e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" className="h-8 text-xs" value={item.markupPercent} onChange={(e) => updateItem(item.id, { markupPercent: +e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" className="h-8 text-xs" value={item.sellingPrice} onChange={(e) => updateItem(item.id, { sellingPrice: +e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={1} className="h-8 text-xs" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: +e.target.value })} />
                          </TableCell>
                          <TableCell>
                            {item.type === "hotel" ? (
                              <Input type="number" min={1} className="h-8 text-xs" value={item.nights || 1} onChange={(e) => updateItem(item.id, { nights: +e.target.value })} />
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="font-medium text-sm">৳{item.subtotal.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="max-w-sm ml-auto space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("quotationBuilder.pricing.totals.totalCost")}</span>
                    <span>৳{totals.totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("quotationBuilder.pricing.totals.totalSelling")}</span>
                    <span>৳{totals.totalSelling.toLocaleString()}</span>
                  </div>
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>{t("quotationBuilder.pricing.totals.discount")}</span>
                      <span>-৳{totals.discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {totals.taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("quotationBuilder.pricing.totals.tax")}</span>
                      <span>+৳{totals.taxAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t("quotationBuilder.pricing.totals.grandTotal")}</span>
                    <span>৳{totals.grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>{t("quotationBuilder.pricing.totals.estProfit")}</span>
                    <span>৳{totals.totalProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("quotationBuilder.pricing.totals.profitMargin")}</span>
                    <span>{totals.totalSelling > 0 ? ((totals.totalProfit / totals.totalSelling) * 100).toFixed(1) : 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">{t("quotationBuilder.notes.internal")}</CardTitle></CardHeader>
              <CardContent>
                <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("quotationBuilder.notes.internalPh")} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">{t("quotationBuilder.notes.terms")}</CardTitle></CardHeader>
              <CardContent>
                <Textarea rows={8} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t("quotationBuilder.notes.termsPh")} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default QuotationBuilder;
