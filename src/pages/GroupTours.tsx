import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Users, ArrowLeft, Trash2, MapPin, Calendar } from "lucide-react";
import { groupTourApi, type GroupTour } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const statusColor: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-800",
  ongoing: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

const emptyForm = { name: "", destination: "", departureDate: "", returnDate: "", capacity: "30", status: "upcoming", notes: "" };

export default function GroupTours() {
  const { toast } = useToast();
  const [tours, setTours] = useState<GroupTour[]>([]);
  const [selected, setSelected] = useState<GroupTour | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({ bookingId: "", seatNumber: "", roomNumber: "", roomType: "", notes: "" });
  const [addingBooking, setAddingBooking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTours(await groupTourApi.list());
    } catch { toast({ title: "Failed to load group tours", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const t = await groupTourApi.get(id);
      setSelected(t);
    } catch { toast({ title: "Failed to load tour details", variant: "destructive" }); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createTour() {
    if (!form.name.trim()) { toast({ title: "Tour name is required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      await groupTourApi.create({
        name: form.name,
        destination: form.destination || undefined,
        departureDate: form.departureDate || undefined,
        returnDate: form.returnDate || undefined,
        capacity: parseInt(form.capacity) || 30,
        status: form.status,
        notes: form.notes || undefined,
      });
      toast({ title: "Group tour created" });
      setShowCreate(false);
      setForm(emptyForm);
      load();
    } catch { toast({ title: "Failed to create tour", variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function addBooking() {
    if (!selected || !bookingForm.bookingId.trim()) { toast({ title: "Booking ID is required", variant: "destructive" }); return; }
    setAddingBooking(true);
    try {
      await groupTourApi.addBooking(selected.id, {
        bookingId: bookingForm.bookingId.trim(),
        seatNumber: bookingForm.seatNumber || undefined,
        roomNumber: bookingForm.roomNumber || undefined,
        roomType: bookingForm.roomType || undefined,
        notes: bookingForm.notes || undefined,
      });
      toast({ title: "Booking added to tour" });
      setShowAddBooking(false);
      setBookingForm({ bookingId: "", seatNumber: "", roomNumber: "", roomType: "", notes: "" });
      loadDetail(selected.id);
    } catch { toast({ title: "Failed to add booking", variant: "destructive" }); }
    finally { setAddingBooking(false); }
  }

  async function removeBooking(bookingId: string) {
    if (!selected) return;
    try {
      await groupTourApi.removeBooking(selected.id, bookingId);
      toast({ title: "Booking removed" });
      loadDetail(selected.id);
    } catch { toast({ title: "Failed to remove booking", variant: "destructive" }); }
  }

  if (selected) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelected(null); load(); }}>
              <ArrowLeft className="w-4 h-4 mr-1" />Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">{selected.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                {selected.destination && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selected.destination}</span>}
                {selected.departureDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(selected.departureDate).toLocaleDateString()} – {selected.returnDate ? new Date(selected.returnDate).toLocaleDateString() : "?"}</span>}
              </div>
            </div>
            <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor[selected.status]}`}>{selected.status}</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{selected.bookings?.length || 0}</p><p className="text-xs text-muted-foreground mt-1">Booked Travelers</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{selected.capacity}</p><p className="text-xs text-muted-foreground mt-1">Total Capacity</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{Math.max(0, selected.capacity - (selected.bookings?.length || 0))}</p><p className="text-xs text-muted-foreground mt-1">Seats Available</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Traveler Manifest</CardTitle>
              <Button size="sm" onClick={() => setShowAddBooking(true)}><Plus className="w-4 h-4 mr-1.5" />Add Booking</Button>
            </CardHeader>
            <CardContent className="p-0">
              {!selected.bookings || selected.bookings.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No bookings assigned yet. Add bookings to build the group manifest.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Seat</th>
                      <th className="text-left px-4 py-2 font-medium">Client</th>
                      <th className="text-left px-4 py-2 font-medium">Travelers</th>
                      <th className="text-left px-4 py-2 font-medium">Room</th>
                      <th className="text-left px-4 py-2 font-medium">Room Type</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.bookings.map((gb) => (
                      <tr key={gb.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-sm">{gb.seatNumber || "—"}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{gb.booking?.client?.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{gb.booking?.client?.phone}</p>
                        </td>
                        <td className="px-4 py-2.5">{gb.booking?.travelers?.length || 0} pax</td>
                        <td className="px-4 py-2.5">{gb.roomNumber || "—"}</td>
                        <td className="px-4 py-2.5 capitalize">{gb.roomType || "—"}</td>
                        <td className="px-4 py-2.5">
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeBooking(gb.bookingId)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={showAddBooking} onOpenChange={setShowAddBooking}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Booking to Group</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Booking ID *</Label>
                <Input placeholder="Paste booking ID" value={bookingForm.bookingId} onChange={(e) => setBookingForm({ ...bookingForm, bookingId: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Seat Number</Label><Input placeholder="e.g. A12" value={bookingForm.seatNumber} onChange={(e) => setBookingForm({ ...bookingForm, seatNumber: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Room Number</Label><Input placeholder="e.g. 304" value={bookingForm.roomNumber} onChange={(e) => setBookingForm({ ...bookingForm, roomNumber: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Room Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={bookingForm.roomType} onChange={(e) => setBookingForm({ ...bookingForm, roomType: e.target.value })}>
                  <option value="">Select room type</option>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="triple">Triple</option>
                  <option value="quad">Quad</option>
                  <option value="suite">Suite</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label>Notes</Label><Input value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddBooking(false)}>Cancel</Button>
              <Button onClick={addBooking} disabled={addingBooking}>{addingBooking ? "Adding..." : "Add to Group"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Group Tours</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage group travel manifests, seat and room assignments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />New Tour</Button>
          </div>
        </div>

        {loading ? <Skeleton className="h-60 w-full" /> : tours.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No group tours yet</p>
            <p className="text-sm mt-1">Create a group tour to start managing traveler manifests.</p>
          </CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tours.map((t) => (
              <Card key={t.id} className="hover:border-primary/40 cursor-pointer transition-colors" onClick={() => loadDetail(t.id).then(() => {})}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold leading-tight">{t.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[t.status]}`}>{t.status}</span>
                  </div>
                  {t.destination && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t.destination}</p>}
                  {t.departureDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(t.departureDate).toLocaleDateString()} {t.returnDate && `→ ${new Date(t.returnDate).toLocaleDateString()}`}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm pt-1 border-t">
                    <span className="flex items-center gap-1 text-muted-foreground"><Users className="w-3.5 h-3.5" />{(t as any)._count?.bookings || 0} booked</span>
                    <span className="text-muted-foreground">{t.capacity} capacity</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Group Tour</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Tour Name *</Label><Input placeholder="e.g. Umrah Group January 2025" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Destination</Label><Input placeholder="e.g. Mecca, Saudi Arabia" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Departure</Label><Input type="date" value={form.departureDate} onChange={(e) => setForm({ ...form, departureDate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Return</Label><Input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createTour} disabled={creating}>{creating ? "Creating..." : "Create Tour"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
