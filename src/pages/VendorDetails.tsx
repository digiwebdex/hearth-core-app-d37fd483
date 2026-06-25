import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import PermissionGate from "@/components/PermissionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Store, Building2, Plane, Car, Globe, Users, MapPin,
  Plus, CreditCard, Phone, Mail, MessageSquare, CheckCircle2,
  Clock, AlertTriangle, DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InlineEmpty } from "@/components/EmptyState";
import {
  vendorApi, bookingApi,
  type Vendor, type VendorCategory, type VendorBill, type VendorBillStatus,
  type VendorBillPayment, type VendorNote, type Booking,
} from "@/lib/api";
import LoadingState from "@/components/LoadingState";

const CATEGORIES: Record<VendorCategory, { label: string; icon: any }> = {
  hotel: { label: "Hotel", icon: Building2 },
  airline: { label: "Airline", icon: Plane },
  transport: { label: "Transport", icon: Car },
  visa_partner: { label: "Visa Partner", icon: Globe },
  guide: { label: "Guide", icon: Users },
  tour_operator: { label: "Tour Operator", icon: MapPin },
  other: { label: "Other", icon: Store },
};

const BILL_STATUS_META: Record<VendorBillStatus, { label: string; color: string }> = {
  unpaid: { label: "Unpaid", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  partial: { label: "Partially Paid", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  paid: { label: "Paid", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  overdue: { label: "Overdue", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
};

const NOTE_TYPES = [
  { value: "note", label: "Note" },
  { value: "call", label: "Phone Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "issue", label: "Issue" },
];

const VendorDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [notes, setNotes] = useState<VendorNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [payBillDialogOpen, setPayBillDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<VendorBill | null>(null);

  // Forms
  const [billForm, setBillForm] = useState({
    bookingId: "", bookingTitle: "", description: "", totalAmount: 0,
    dueDate: "", invoiceRef: "", notes: "",
  });
  const [billPayForm, setBillPayForm] = useState({
    amount: 0, method: "bank", reference: "", date: new Date().toISOString().split("T")[0], notes: "",
  });
  const [noteForm, setNoteForm] = useState({ content: "", type: "note" });

  // Booking list for bill creation
  const [bookings, setBookings] = useState<Booking[]>([]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [v, b, n] = await Promise.all([
        vendorApi.get(id),
        vendorApi.getBills(id).catch(() => []),
        vendorApi.getNotes(id).catch(() => []),
      ]);
      setVendor(v);
      setBills(b);
      setNotes(n);
    } catch {
      toast({ title: "Vendor not found", variant: "destructive" });
      navigate("/vendors");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Add Bill ──
  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      const bill = await vendorApi.addBill(id, {
        vendorId: id,
        vendorName: vendor?.name,
        bookingId: billForm.bookingId || undefined,
        bookingTitle: billForm.bookingTitle || undefined,
        description: billForm.description,
        totalAmount: billForm.totalAmount,
        paidAmount: 0,
        dueAmount: billForm.totalAmount,
        status: "unpaid",
        dueDate: billForm.dueDate || undefined,
        invoiceRef: billForm.invoiceRef || undefined,
        notes: billForm.notes || undefined,
        tenantId: vendor?.tenantId || "",
      } as any);
      setBills((prev) => [...prev, bill]);
      setBillForm({ bookingId: "", bookingTitle: "", description: "", totalAmount: 0, dueDate: "", invoiceRef: "", notes: "" });
      setBillDialogOpen(false);
      toast({ title: "Vendor bill created" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  // ── Pay Bill ──
  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedBill) return;
    const payAmount = Math.min(billPayForm.amount, selectedBill.dueAmount);
    if (payAmount <= 0) return;
    try {
      await vendorApi.addBillPayment(id, selectedBill.id, {
        amount: payAmount,
        method: billPayForm.method,
        reference: billPayForm.reference,
        date: billPayForm.date,
        notes: billPayForm.notes,
      });
      setBills((prev) => prev.map((b) => {
        if (b.id !== selectedBill.id) return b;
        const newPaid = b.paidAmount + payAmount;
        const newDue = b.totalAmount - newPaid;
        const newStatus: VendorBillStatus = newDue <= 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
        return { ...b, paidAmount: newPaid, dueAmount: Math.max(0, newDue), status: newStatus };
      }));
      setBillPayForm({ amount: 0, method: "bank", reference: "", date: new Date().toISOString().split("T")[0], notes: "" });
      setPayBillDialogOpen(false);
      setSelectedBill(null);
      toast({ title: "Payment recorded", description: `৳${payAmount.toLocaleString()} paid to ${vendor?.name}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  // ── Add Note ──
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      const note = await vendorApi.addNote(id, { content: noteForm.content, type: noteForm.type });
      setNotes((prev) => [note, ...prev]);
      setNoteForm({ content: "", type: "note" });
      setNoteDialogOpen(false);
      toast({ title: "Note added" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  // ── Totals ──
  const billTotals = {
    total: bills.reduce((s, b) => s + b.totalAmount, 0),
    paid: bills.reduce((s, b) => s + b.paidAmount, 0),
    due: bills.reduce((s, b) => s + b.dueAmount, 0),
  };

  if (loading) {
    return <DashboardLayout><LoadingState rows={8} /></DashboardLayout>;
  }

  if (!vendor) return null;

  const catMeta = CATEGORIES[vendor.category] || CATEGORIES.other;
  const CatIcon = catMeta.icon;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <CatIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{vendor.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{catMeta.label}</Badge>
                <Badge variant={vendor.status === "active" ? "default" : "secondary"} className="capitalize">{vendor.status || "active"}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Contact + Financial Summary */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {vendor.contactPerson && <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" />{vendor.contactPerson}</div>}
              {vendor.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{vendor.phone}</div>}
              {vendor.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{vendor.email}</div>}
              {vendor.address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{vendor.address}</div>}
              {vendor.serviceAreas && <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-muted-foreground" />{vendor.serviceAreas}</div>}
              {!vendor.contactPerson && !vendor.phone && !vendor.email && (
                <InlineEmpty title={t("emptyStates.noContactInfo")} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Financial Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Billed</span><span className="font-semibold">৳{billTotals.total.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className="font-semibold text-green-600">৳{billTotals.paid.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Outstanding</span><span className="font-semibold text-destructive">৳{billTotals.due.toLocaleString()}</span></div>
              <Progress value={billTotals.total > 0 ? (billTotals.paid / billTotals.total) * 100 : 0} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <PermissionGate module="vendors" action="edit">
                <Button size="sm" className="w-full" onClick={async () => {
                  setBillDialogOpen(true);
                  try { const bks = await bookingApi.list(); setBookings(bks); } catch { setBookings([]); }
                }}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Bill / Payable
                </Button>
              </PermissionGate>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setNoteDialogOpen(true)}>
                <MessageSquare className="mr-1 h-3.5 w-3.5" /> Add Note
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Bills / Notes */}
        <Tabs defaultValue="bills">
          <TabsList>
            <TabsTrigger value="bills">Bills & Payables ({bills.length})</TabsTrigger>
            <TabsTrigger value="notes">Interaction History ({notes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="mt-4">
            {bills.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <InlineEmpty title={t("emptyStates.noVendorBills")} hint={t("emptyStates.noVendorBillsHint")} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Booking</TableHead>
                        <TableHead>Invoice Ref</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bills.map((b) => {
                        const meta = BILL_STATUS_META[b.status] || BILL_STATUS_META.unpaid;
                        return (
                          <TableRow key={b.id}>
                            <TableCell className="font-medium text-sm">{b.description}</TableCell>
                            <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">{b.bookingTitle || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{b.invoiceRef || "—"}</TableCell>
                            <TableCell className="text-right font-medium">৳{b.totalAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-green-600">৳{b.paidAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-destructive font-semibold">৳{b.dueAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{b.dueDate || "—"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>{meta.label}</span>
                            </TableCell>
                            <TableCell>
                              {b.status !== "paid" && (
                                <PermissionGate module="vendors" action="edit">
                                  <Button variant="ghost" size="sm" onClick={() => { setSelectedBill(b); setPayBillDialogOpen(true); }}>
                                    <CreditCard className="mr-1 h-3.5 w-3.5" /> Pay
                                  </Button>
                                </PermissionGate>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            {notes.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <InlineEmpty title={t("emptyStates.noVendorHistory")} hint={t("emptyStates.noVendorHistoryHint")} />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {notes.map((n) => (
                  <Card key={n.id}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{n.content}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="text-[10px] capitalize">{n.type}</Badge>
                            {n.createdByName && <span>· {n.createdByName}</span>}
                            <span>· {n.createdAt?.slice(0, 16).replace("T", " ")}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ═══ ADD BILL DIALOG ═══ */}
        <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Vendor Bill</DialogTitle></DialogHeader>
            <form onSubmit={handleAddBill} className="space-y-4">
              <div className="space-y-2">
                <Label>Linked Booking (optional)</Label>
                <Select value={billForm.bookingId} onValueChange={(v) => {
                  const bk = bookings.find((b) => b.id === v);
                  setBillForm((f) => ({ ...f, bookingId: v, bookingTitle: bk?.title || `${bk?.type} — ${bk?.destination || "Trip"}` }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select booking..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No booking</SelectItem>
                    {bookings.map((bk) => (
                      <SelectItem key={bk.id} value={bk.id}>
                        {bk.title || `${bk.type} — ${bk.destination || "Trip"}`} ({bk.clientName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Input value={billForm.description} onChange={(e) => setBillForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. 3 nights accommodation — Deluxe Room" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (৳) *</Label>
                  <Input type="number" min={0.01} step={0.01} value={billForm.totalAmount || ""} onChange={(e) => setBillForm((f) => ({ ...f, totalAmount: parseFloat(e.target.value) || 0 }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={billForm.dueDate} onChange={(e) => setBillForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vendor Invoice Ref</Label>
                <Input value={billForm.invoiceRef} onChange={(e) => setBillForm((f) => ({ ...f, invoiceRef: e.target.value }))} placeholder="e.g. HTL-2024-0456" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={billForm.notes} onChange={(e) => setBillForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." rows={2} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Create Bill</Button>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ═══ PAY BILL DIALOG ═══ */}
        <Dialog open={payBillDialogOpen} onOpenChange={(open) => { setPayBillDialogOpen(open); if (!open) setSelectedBill(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment to Vendor</DialogTitle></DialogHeader>
            {selectedBill && (
              <div className="mb-3 rounded-md border p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Bill:</span><span className="font-medium">{selectedBill.description}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span>৳{selectedBill.totalAmount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid so far:</span><span className="text-green-600">৳{selectedBill.paidAmount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Remaining:</span><span className="text-destructive font-semibold">৳{selectedBill.dueAmount.toLocaleString()}</span></div>
              </div>
            )}
            <form onSubmit={handlePayBill} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (৳)</Label>
                  <Input type="number" min={0.01} step={0.01} max={selectedBill?.dueAmount} value={billPayForm.amount || ""} onChange={(e) => setBillPayForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={billPayForm.method} onValueChange={(v) => setBillPayForm((f) => ({ ...f, method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={billPayForm.date} onChange={(e) => setBillPayForm((f) => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input value={billPayForm.reference} onChange={(e) => setBillPayForm((f) => ({ ...f, reference: e.target.value }))} placeholder="TXN / cheque no." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={billPayForm.notes} onChange={(e) => setBillPayForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional..." />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Record Payment</Button>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ═══ ADD NOTE DIALOG ═══ */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vendor Note</DialogTitle></DialogHeader>
            <form onSubmit={handleAddNote} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={noteForm.type} onValueChange={(v) => setNoteForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Content *</Label>
                <Textarea value={noteForm.content} onChange={(e) => setNoteForm((f) => ({ ...f, content: e.target.value }))} placeholder="e.g. Called to confirm room availability for December bookings..." rows={3} required />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Add Note</Button>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Bank Details (if any) */}
        {vendor.bankDetails && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bank / Payment Details</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vendor.bankDetails}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default VendorDetails;
