import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  bookingApi, type Booking, type BookingStatus, type BookingSegment,
  type BookingTraveler, type BookingChecklistItem, type BookingTimelineEvent, type BookingDocument,
} from "@/lib/api";
import { bookingPresetPath, bookingTypeToPreset } from "@/lib/bookingRoutePresets";
import { mergeServiceDetailsIntoBooking } from "@/lib/bookingServiceDetails";
import { BookingOpsPanel, SERVICE_OPS_TYPES } from "@/components/bookings/BookingOpsPanel";
import {
  ArrowLeft, MapPin, CalendarIcon, Users, DollarSign, Plane, Hotel,
  Car, Stamp, Package, Bike, Plus, Trash2, Upload, FileText, Clock,
  CheckCircle2, MessageSquare, CreditCard, Paperclip, ClipboardList,
  User, AlertTriangle, Download,
} from "lucide-react";

const STATUS_META: { value: BookingStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "ticketed", label: "Ticketed", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { value: "traveling", label: "Traveling", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const SEGMENT_ICONS: Record<string, any> = {
  hotel: Hotel, flight: Plane, transfer: Car, visa: Stamp, activity: Bike, package: Package,
};

const TIMELINE_ICONS: Record<string, any> = {
  status_change: Clock, note: MessageSquare, payment: CreditCard,
  document: Paperclip, checklist: ClipboardList, system: Plane,
};

const getStatusMeta = (s: BookingStatus) => STATUS_META.find((x) => x.value === s) || STATUS_META[0];
const makeId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const BookingDetails = () => {
  const { id, segment } = useParams<{ id?: string; segment?: string }>();
  const bookingId = id || segment;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const initialTab = searchParams.get("tab") || "segments";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [segments, setSegments] = useState<BookingSegment[]>([]);
  const [travelers, setTravelers] = useState<BookingTraveler[]>([]);
  const [checklist, setChecklist] = useState<BookingChecklistItem[]>([]);
  const [timeline, setTimeline] = useState<BookingTimelineEvent[]>([]);
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form states
  const [newNote, setNewNote] = useState("");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [segmentDialog, setSegmentDialog] = useState(false);
  const [travelerDialog, setTravelerDialog] = useState(false);
  const [segForm, setSegForm] = useState<Partial<BookingSegment>>({ type: "hotel", description: "", cost: 0, sellingPrice: 0, status: "pending" });
  const [travForm, setTravForm] = useState<Partial<BookingTraveler>>({ name: "", passportNumber: "", nationality: "" });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const [b, segs, travs, chk, tl, docs] = await Promise.all([
        bookingApi.get(bookingId),
        bookingApi.getSegments(bookingId).catch(() => []),
        bookingApi.getTravelers(bookingId).catch(() => []),
        bookingApi.getChecklist(bookingId).catch(() => []),
        bookingApi.getTimeline(bookingId).catch(() => []),
        bookingApi.getDocuments(bookingId).catch(() => []),
      ]);
      setBooking(mergeServiceDetailsIntoBooking(b));
      setSegments(segs);
      setTravelers(travs);
      setChecklist(chk);
      setTimeline(tl);
      setDocuments(docs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (status: BookingStatus) => {
    if (!booking) return;
    try {
      await bookingApi.updateStatus(booking.id, status);
      setBooking((p) => p ? { ...p, status } : p);
      toast({ title: `Status updated to ${getStatusMeta(status).label}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleAddSegment = async () => {
    if (!bookingId || !segForm.description) return;
    try {
      const seg = await bookingApi.addSegment(bookingId, segForm as any);
      setSegments((p) => [...p, seg]);
      setSegForm({ type: "hotel", description: "", cost: 0, sellingPrice: 0, status: "pending" });
      setSegmentDialog(false);
      toast({ title: "Segment added" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteSegment = async (segId: string) => {
    if (!bookingId) return;
    try {
      await bookingApi.deleteSegment(bookingId, segId);
      setSegments((p) => p.filter((s) => s.id !== segId));
      toast({ title: "Segment removed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleAddTraveler = async () => {
    if (!bookingId || !travForm.name) return;
    try {
      const trav = await bookingApi.addTraveler(bookingId, travForm as any);
      setTravelers((p) => [...p, trav]);
      setTravForm({ name: "", passportNumber: "", nationality: "" });
      setTravelerDialog(false);
      toast({ title: "Traveler added" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteTraveler = async (tId: string) => {
    if (!bookingId) return;
    try {
      await bookingApi.deleteTraveler(bookingId, tId);
      setTravelers((p) => p.filter((t) => t.id !== tId));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleToggleChecklist = async (item: BookingChecklistItem) => {
    if (!bookingId) return;
    try {
      await bookingApi.updateChecklistItem(bookingId, item.id, !item.done);
      setChecklist((p) => p.map((c) => c.id === item.id ? { ...c, done: !c.done } : c));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleAddCheckItem = async () => {
    if (!bookingId || !newCheckItem.trim()) return;
    try {
      const item = await bookingApi.addChecklistItem(bookingId, { label: newCheckItem.trim() });
      setChecklist((p) => [...p, item]);
      setNewCheckItem("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleAddNote = async () => {
    if (!bookingId || !newNote.trim()) return;
    try {
      const event = await bookingApi.addTimelineEvent(bookingId, { type: "note", content: newNote.trim() });
      setTimeline((p) => [event, ...p]);
      setNewNote("");
      toast({ title: "Note added" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!bookingId || !e.target.files?.length) return;
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    try {
      const doc = await bookingApi.uploadDocument(bookingId, formData);
      setDocuments((p) => [...p, doc]);
      toast({ title: "Document uploaded" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!bookingId) return;
    try {
      await bookingApi.deleteDocument(bookingId, docId);
      setDocuments((p) => p.filter((d) => d.id !== docId));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  if (loading) return <DashboardLayout><LoadingState rows={8} /></DashboardLayout>;
  if (error || !booking) return <DashboardLayout><ErrorState message={error || "Booking not found"} onRetry={fetchData} /></DashboardLayout>;

  const statusMeta = getStatusMeta(booking.status);
  const segmentCost = segments.reduce((s, seg) => s + (seg.cost || 0), 0);
  const segmentSelling = segments.reduce((s, seg) => s + (seg.sellingPrice || 0), 0);
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(booking ? bookingPresetPath(bookingTypeToPreset(booking.type)) : "/bookings")}
              className="mb-1"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Bookings
            </Button>
            <h1 className="text-2xl font-bold">{booking.title || `${booking.type} Booking`}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
              <Badge variant="outline" className="capitalize">{booking.type}</Badge>
              {booking.destination && (
                <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {booking.destination}</span>
              )}
              {booking.travelDateFrom && (
                <span className="text-sm text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {booking.travelDateFrom}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PermissionGate module="bookings" action="edit">
              <Select value={booking.status} onValueChange={(v) => handleStatusChange(v as BookingStatus)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_META.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </PermissionGate>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-xl font-bold">৳{booking.amount.toLocaleString()}</p>
              </div>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cost</p>
                <p className="text-xl font-bold">৳{booking.cost.toLocaleString()}</p>
              </div>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Profit</p>
                <p className={`text-xl font-bold ${booking.profit >= 0 ? "text-green-600" : "text-destructive"}`}>৳{booking.profit.toLocaleString()}</p>
              </div>
              <DollarSign className="h-5 w-5 text-green-600" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Travelers</p>
                <p className="text-xl font-bold">{travelers.length || booking.travelerCount || 1}</p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Checklist</p>
                <p className="text-xl font-bold">{doneCount}/{checklist.length}</p>
              </div>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap">
            {booking && SERVICE_OPS_TYPES.has(booking.type) ? (
              <TabsTrigger value="operations">Operations</TabsTrigger>
            ) : null}
            <TabsTrigger value="segments">Segments ({segments.length})</TabsTrigger>
            <TabsTrigger value="travelers">Travelers ({travelers.length})</TabsTrigger>
            <TabsTrigger value="checklist">Checklist ({doneCount}/{checklist.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline ({timeline.length})</TabsTrigger>
          </TabsList>

          {booking && SERVICE_OPS_TYPES.has(booking.type) ? (
            <TabsContent value="operations">
              <BookingOpsPanel booking={booking} onUpdated={(updated) => setBooking(updated)} />
            </TabsContent>
          ) : null}

          {/* ── SEGMENTS ── */}
          <TabsContent value="segments" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Trip Segments</h3>
              <PermissionGate module="bookings" action="edit">
                <Dialog open={segmentDialog} onOpenChange={setSegmentDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Add Segment</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Trip Segment</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select value={segForm.type || "hotel"} onValueChange={(v) => setSegForm((f) => ({ ...f, type: v as any }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hotel">Hotel</SelectItem>
                              <SelectItem value="flight">Flight</SelectItem>
                              <SelectItem value="transfer">Transfer</SelectItem>
                              <SelectItem value="visa">Visa</SelectItem>
                              <SelectItem value="activity">Activity</SelectItem>
                              <SelectItem value="package">Package</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={segForm.status || "pending"} onValueChange={(v) => setSegForm((f) => ({ ...f, status: v as any }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Description *</Label>
                        <Input value={segForm.description || ""} onChange={(e) => setSegForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Novotel Bangkok — Deluxe Room, 3 Nights" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Supplier</Label>
                          <Input value={segForm.supplier || ""} onChange={(e) => setSegForm((f) => ({ ...f, supplier: e.target.value }))} placeholder="e.g. Novotel Hotels" />
                        </div>
                        <div className="space-y-2">
                          <Label>Supplier Ref</Label>
                          <Input value={segForm.supplierRef || ""} onChange={(e) => setSegForm((f) => ({ ...f, supplierRef: e.target.value }))} placeholder="e.g. CONF-12345" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input type="date" value={segForm.startDate || ""} onChange={(e) => setSegForm((f) => ({ ...f, startDate: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Input type="date" value={segForm.endDate || ""} onChange={(e) => setSegForm((f) => ({ ...f, endDate: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Cost (৳)</Label>
                          <Input type="number" value={segForm.cost || 0} onChange={(e) => setSegForm((f) => ({ ...f, cost: +e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Selling Price (৳)</Label>
                          <Input type="number" value={segForm.sellingPrice || 0} onChange={(e) => setSegForm((f) => ({ ...f, sellingPrice: +e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Details / Notes</Label>
                        <Textarea value={segForm.details || ""} onChange={(e) => setSegForm((f) => ({ ...f, details: e.target.value }))} placeholder="Additional details..." rows={2} />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddSegment} className="flex-1">Add Segment</Button>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </PermissionGate>
            </div>

            {segments.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No segments added yet. Add hotel, flight, transfer, and other trip components.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {segments.map((seg) => {
                  const Icon = SEGMENT_ICONS[seg.type] || Plane;
                  return (
                    <Card key={seg.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">{seg.description}</h4>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                  seg.status === "confirmed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                  seg.status === "cancelled" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                                  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                }`}>{seg.status || "pending"}</span>
                              </div>
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="capitalize">{seg.type}</span>
                                {seg.supplier && <span>Supplier: {seg.supplier}</span>}
                                {seg.supplierRef && <span>Ref: {seg.supplierRef}</span>}
                                {seg.startDate && <span>{seg.startDate}{seg.endDate ? ` → ${seg.endDate}` : ""}</span>}
                              </div>
                              {seg.details && <p className="text-xs text-muted-foreground mt-1">{seg.details}</p>}
                              <div className="flex gap-3 mt-1.5 text-xs">
                                <span>Cost: ৳{(seg.cost || 0).toLocaleString()}</span>
                                <span>Selling: ৳{(seg.sellingPrice || 0).toLocaleString()}</span>
                                <span className="text-green-600">Profit: ৳{((seg.sellingPrice || 0) - (seg.cost || 0)).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <PermissionGate module="bookings" action="delete">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteSegment(seg.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {segments.length > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="max-w-xs ml-auto space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Segments Cost</span><span>৳{segmentCost.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Segments Selling</span><span>৳{segmentSelling.toLocaleString()}</span></div>
                        <Separator />
                        <div className="flex justify-between font-medium text-green-600"><span>Segments Profit</span><span>৳{(segmentSelling - segmentCost).toLocaleString()}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── TRAVELERS ── */}
          <TabsContent value="travelers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Traveler Details</h3>
              <PermissionGate module="bookings" action="edit">
                <Dialog open={travelerDialog} onOpenChange={setTravelerDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Add Traveler</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Traveler</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Full Name *</Label>
                        <Input value={travForm.name || ""} onChange={(e) => setTravForm((f) => ({ ...f, name: e.target.value }))} placeholder="As per passport" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Passport Number</Label>
                          <Input value={travForm.passportNumber || ""} onChange={(e) => setTravForm((f) => ({ ...f, passportNumber: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Passport Expiry</Label>
                          <Input type="date" value={travForm.passportExpiry || ""} onChange={(e) => setTravForm((f) => ({ ...f, passportExpiry: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nationality</Label>
                          <Input value={travForm.nationality || ""} onChange={(e) => setTravForm((f) => ({ ...f, nationality: e.target.value }))} placeholder="e.g. Bangladeshi" />
                        </div>
                        <div className="space-y-2">
                          <Label>Date of Birth</Label>
                          <Input type="date" value={travForm.dateOfBirth || ""} onChange={(e) => setTravForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input value={travForm.phone || ""} onChange={(e) => setTravForm((f) => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input value={travForm.email || ""} onChange={(e) => setTravForm((f) => ({ ...f, email: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddTraveler} className="flex-1">Add Traveler</Button>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </PermissionGate>
            </div>

            {travelers.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No travelers added. Add passenger details and passport information.</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Passport</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Nationality</TableHead>
                        <TableHead>DOB</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {travelers.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="text-sm">{t.passportNumber || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {t.passportExpiry ? (
                              <span className={new Date(t.passportExpiry) < new Date() ? "text-destructive font-medium" : ""}>
                                {t.passportExpiry}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{t.nationality || "—"}</TableCell>
                          <TableCell className="text-sm">{t.dateOfBirth || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.phone || t.email || "—"}</TableCell>
                          <TableCell>
                            <PermissionGate module="bookings" action="delete">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteTraveler(t.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </PermissionGate>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── CHECKLIST ── */}
          <TabsContent value="checklist" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Operations Checklist
                  <Badge variant="outline" className="ml-auto">{doneCount}/{checklist.length} done</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                    <Checkbox checked={item.done} onCheckedChange={() => handleToggleChecklist(item)} />
                    <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
                    {item.doneAt && <span className="text-xs text-muted-foreground">{item.doneAt.slice(0, 10)}</span>}
                  </div>
                ))}
                {checklist.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No checklist items. Add tasks for the operations team.</p>
                )}
                <Separator />
                <div className="flex gap-2">
                  <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} placeholder="e.g. Confirm hotel reservation" onKeyDown={(e) => e.key === "Enter" && handleAddCheckItem()} />
                  <Button size="sm" onClick={handleAddCheckItem} disabled={!newCheckItem.trim()}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DOCUMENTS ── */}
          <TabsContent value="documents" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Booking Documents & Vouchers</h3>
              <PermissionGate module="bookings" action="edit">
                <label className="cursor-pointer">
                  <Button size="sm" asChild><span><Upload className="mr-1 h-3.5 w-3.5" /> Upload</span></Button>
                  <input type="file" className="hidden" onChange={handleUpload} />
                </label>
              </PermissionGate>
            </div>
            {documents.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No documents uploaded. Upload e-tickets, hotel vouchers, visa copies, etc.</CardContent></Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.type} · {doc.uploadedAt?.slice(0, 10)}</p>
                        </div>
                        <div className="flex gap-1">
                          {doc.url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={doc.url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /></a>
                            </Button>
                          )}
                          <PermissionGate module="bookings" action="delete">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteDoc(doc.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── TIMELINE ── */}
          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Add Note</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note, status update, or internal comment..." rows={2} className="flex-1" />
                  <Button onClick={handleAddNote} disabled={!newNote.trim()} className="self-end">Add</Button>
                </div>
              </CardContent>
            </Card>

            {timeline.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No timeline events yet.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {timeline.map((event) => {
                  const Icon = TIMELINE_ICONS[event.type] || Clock;
                  return (
                    <Card key={event.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">{event.content}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="capitalize">{event.type.replace("_", " ")}</span>
                              {event.createdByName && <span>· {event.createdByName}</span>}
                              <span>· {event.createdAt?.slice(0, 16).replace("T", " ")}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default BookingDetails;
