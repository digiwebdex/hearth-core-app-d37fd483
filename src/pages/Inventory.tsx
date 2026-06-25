import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Edit2, Trash2, Hotel, Bus } from "lucide-react";
import { inventoryApi, type HotelContract, type TransportContract } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const hotelStatusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-600",
  expired: "bg-red-100 text-red-700",
};
const transportStatusColor: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  in_use: "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  retired: "bg-gray-100 text-gray-600",
};
const MEAL_PLANS = ["", "RO", "BB", "HB", "FB", "AI"];
const TRANSPORT_TYPES = ["bus", "minibus", "car", "van", "boat", "train", "aircraft"];

const emptyHotel = { hotelName: "", city: "", country: "", starRating: "", contractStart: "", contractEnd: "", totalRooms: "", allocatedRooms: "", ratePerNight: "", mealPlan: "", status: "active", notes: "" };
const emptyTransport = { transportType: "bus", vehicleModel: "", capacity: "", registrationNo: "", driverName: "", driverPhone: "", ratePerDay: "", ratePerTrip: "", contractStart: "", contractEnd: "", status: "available", notes: "" };

export default function Inventory() {
  const { toast } = useToast();
  const [tab, setTab] = useState("hotels");
  const [hotels, setHotels] = useState<HotelContract[]>([]);
  const [transport, setTransport] = useState<TransportContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHotel, setShowHotel] = useState(false);
  const [showTransport, setShowTransport] = useState(false);
  const [editHotel, setEditHotel] = useState<HotelContract | null>(null);
  const [editTransport, setEditTransport] = useState<TransportContract | null>(null);
  const [hotelForm, setHotelForm] = useState(emptyHotel);
  const [transportForm, setTransportForm] = useState(emptyTransport);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, t] = await Promise.all([inventoryApi.listHotels(), inventoryApi.listTransport()]);
      setHotels(h);
      setTransport(t);
    } catch { toast({ title: "Failed to load inventory", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openHotelCreate() { setHotelForm(emptyHotel); setEditHotel(null); setShowHotel(true); }
  function openHotelEdit(h: HotelContract) {
    setHotelForm({ hotelName: h.hotelName, city: h.city || "", country: h.country || "", starRating: h.starRating?.toString() || "", contractStart: h.contractStart ? h.contractStart.split("T")[0] : "", contractEnd: h.contractEnd ? h.contractEnd.split("T")[0] : "", totalRooms: h.totalRooms.toString(), allocatedRooms: h.allocatedRooms.toString(), ratePerNight: h.ratePerNight?.toString() || "", mealPlan: h.mealPlan || "", status: h.status, notes: h.notes || "" });
    setEditHotel(h); setShowHotel(true);
  }

  async function saveHotel() {
    if (!hotelForm.hotelName.trim()) { toast({ title: "Hotel name required", variant: "destructive" }); return; }
    setSaving(true);
    const data: Partial<HotelContract> = { hotelName: hotelForm.hotelName, city: hotelForm.city || undefined, country: hotelForm.country || undefined, starRating: hotelForm.starRating ? parseInt(hotelForm.starRating) : undefined, contractStart: hotelForm.contractStart || undefined, contractEnd: hotelForm.contractEnd || undefined, totalRooms: parseInt(hotelForm.totalRooms) || 0, allocatedRooms: parseInt(hotelForm.allocatedRooms) || 0, ratePerNight: hotelForm.ratePerNight ? parseFloat(hotelForm.ratePerNight) : undefined, mealPlan: hotelForm.mealPlan || undefined, status: hotelForm.status, notes: hotelForm.notes || undefined };
    try {
      if (editHotel) { await inventoryApi.updateHotel(editHotel.id, data); toast({ title: "Hotel updated" }); }
      else { await inventoryApi.createHotel(data); toast({ title: "Hotel contract added" }); }
      setShowHotel(false); load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function deleteHotel(id: string) {
    try { await inventoryApi.deleteHotel(id); toast({ title: "Deleted" }); load(); }
    catch { toast({ title: "Failed", variant: "destructive" }); }
  }

  function openTransportCreate() { setTransportForm(emptyTransport); setEditTransport(null); setShowTransport(true); }
  function openTransportEdit(t: TransportContract) {
    setTransportForm({ transportType: t.transportType, vehicleModel: t.vehicleModel || "", capacity: t.capacity.toString(), registrationNo: t.registrationNo || "", driverName: t.driverName || "", driverPhone: t.driverPhone || "", ratePerDay: t.ratePerDay?.toString() || "", ratePerTrip: t.ratePerTrip?.toString() || "", contractStart: t.contractStart ? t.contractStart.split("T")[0] : "", contractEnd: t.contractEnd ? t.contractEnd.split("T")[0] : "", status: t.status, notes: t.notes || "" });
    setEditTransport(t); setShowTransport(true);
  }

  async function saveTransport() {
    setSaving(true);
    const data: Partial<TransportContract> = { transportType: transportForm.transportType, vehicleModel: transportForm.vehicleModel || undefined, capacity: parseInt(transportForm.capacity) || 0, registrationNo: transportForm.registrationNo || undefined, driverName: transportForm.driverName || undefined, driverPhone: transportForm.driverPhone || undefined, ratePerDay: transportForm.ratePerDay ? parseFloat(transportForm.ratePerDay) : undefined, ratePerTrip: transportForm.ratePerTrip ? parseFloat(transportForm.ratePerTrip) : undefined, contractStart: transportForm.contractStart || undefined, contractEnd: transportForm.contractEnd || undefined, status: transportForm.status, notes: transportForm.notes || undefined };
    try {
      if (editTransport) { await inventoryApi.updateTransport(editTransport.id, data); toast({ title: "Transport updated" }); }
      else { await inventoryApi.createTransport(data); toast({ title: "Transport added" }); }
      setShowTransport(false); load();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function deleteTransport(id: string) {
    try { await inventoryApi.deleteTransport(id); toast({ title: "Deleted" }); load(); }
    catch { toast({ title: "Failed", variant: "destructive" }); }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Hotel contracts and transport fleet inventory</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="hotels"><Hotel className="w-4 h-4 mr-1.5" />Hotels ({hotels.length})</TabsTrigger>
            <TabsTrigger value="transport"><Bus className="w-4 h-4 mr-1.5" />Transport ({transport.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="hotels" className="mt-4 space-y-4">
            <div className="flex justify-end"><Button size="sm" onClick={openHotelCreate}><Plus className="w-4 h-4 mr-1.5" />Add Hotel</Button></div>
            {loading ? <Skeleton className="h-60 w-full" /> : hotels.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><p>No hotel contracts yet.</p></CardContent></Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hotels.map((h) => (
                  <Card key={h.id}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold">{h.hotelName}</p>
                          {h.starRating && <p className="text-xs text-yellow-500">{"★".repeat(h.starRating)}</p>}
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hotelStatusColor[h.status] || ""}`}>{h.status}</span>
                      </div>
                      {(h.city || h.country) && <p className="text-sm text-muted-foreground">{[h.city, h.country].filter(Boolean).join(", ")}</p>}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-muted-foreground">Rooms</p><p className="font-medium">{h.allocatedRooms} / {h.totalRooms}</p></div>
                        {h.ratePerNight && <div><p className="text-xs text-muted-foreground">Rate/Night</p><p className="font-medium">৳ {h.ratePerNight.toLocaleString()}</p></div>}
                        {h.mealPlan && <div><p className="text-xs text-muted-foreground">Meal Plan</p><p className="font-medium">{h.mealPlan}</p></div>}
                      </div>
                      <div className="flex gap-1 pt-1">
                        <Button variant="ghost" size="sm" className="h-7" onClick={() => openHotelEdit(h)}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={() => deleteHotel(h.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transport" className="mt-4 space-y-4">
            <div className="flex justify-end"><Button size="sm" onClick={openTransportCreate}><Plus className="w-4 h-4 mr-1.5" />Add Vehicle</Button></div>
            {loading ? <Skeleton className="h-60 w-full" /> : transport.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><p>No transport contracts yet.</p></CardContent></Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transport.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold capitalize">{t.transportType}{t.vehicleModel ? ` — ${t.vehicleModel}` : ""}</p>
                          {t.registrationNo && <p className="text-xs font-mono text-muted-foreground">{t.registrationNo}</p>}
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${transportStatusColor[t.status] || ""}`}>{t.status.replace("_", " ")}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-muted-foreground">Capacity</p><p className="font-medium">{t.capacity} seats</p></div>
                        {t.ratePerDay && <div><p className="text-xs text-muted-foreground">Rate/Day</p><p className="font-medium">৳ {t.ratePerDay.toLocaleString()}</p></div>}
                        {t.driverName && <div><p className="text-xs text-muted-foreground">Driver</p><p className="font-medium">{t.driverName}</p></div>}
                        {t.driverPhone && <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{t.driverPhone}</p></div>}
                      </div>
                      <div className="flex gap-1 pt-1">
                        <Button variant="ghost" size="sm" className="h-7" onClick={() => openTransportEdit(t)}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={() => deleteTransport(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Hotel dialog */}
      <Dialog open={showHotel} onOpenChange={setShowHotel}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editHotel ? "Edit Hotel Contract" : "Add Hotel Contract"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5"><Label>Hotel Name *</Label><Input value={hotelForm.hotelName} onChange={(e) => setHotelForm({ ...hotelForm, hotelName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>City</Label><Input value={hotelForm.city} onChange={(e) => setHotelForm({ ...hotelForm, city: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Country</Label><Input value={hotelForm.country} onChange={(e) => setHotelForm({ ...hotelForm, country: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Star Rating</Label><Input type="number" min={1} max={7} value={hotelForm.starRating} onChange={(e) => setHotelForm({ ...hotelForm, starRating: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Total Rooms</Label><Input type="number" min={0} value={hotelForm.totalRooms} onChange={(e) => setHotelForm({ ...hotelForm, totalRooms: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Allocated</Label><Input type="number" min={0} value={hotelForm.allocatedRooms} onChange={(e) => setHotelForm({ ...hotelForm, allocatedRooms: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Rate/Night (৳)</Label><Input type="number" min={0} value={hotelForm.ratePerNight} onChange={(e) => setHotelForm({ ...hotelForm, ratePerNight: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Meal Plan</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={hotelForm.mealPlan} onChange={(e) => setHotelForm({ ...hotelForm, mealPlan: e.target.value })}>
                  {MEAL_PLANS.map((m) => <option key={m} value={m}>{m || "Not included"}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Contract Start</Label><Input type="date" value={hotelForm.contractStart} onChange={(e) => setHotelForm({ ...hotelForm, contractStart: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Contract End</Label><Input type="date" value={hotelForm.contractEnd} onChange={(e) => setHotelForm({ ...hotelForm, contractEnd: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={hotelForm.status} onChange={(e) => setHotelForm({ ...hotelForm, status: e.target.value })}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="expired">Expired</option>
              </select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={hotelForm.notes} onChange={(e) => setHotelForm({ ...hotelForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHotel(false)}>Cancel</Button>
            <Button onClick={saveHotel} disabled={saving}>{saving ? "Saving..." : editHotel ? "Update" : "Add Hotel"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transport dialog */}
      <Dialog open={showTransport} onOpenChange={setShowTransport}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTransport ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Transport Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={transportForm.transportType} onChange={(e) => setTransportForm({ ...transportForm, transportType: e.target.value })}>
                  {TRANSPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Vehicle Model</Label><Input value={transportForm.vehicleModel} onChange={(e) => setTransportForm({ ...transportForm, vehicleModel: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Capacity (seats)</Label><Input type="number" min={1} value={transportForm.capacity} onChange={(e) => setTransportForm({ ...transportForm, capacity: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Registration No</Label><Input value={transportForm.registrationNo} onChange={(e) => setTransportForm({ ...transportForm, registrationNo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Driver Name</Label><Input value={transportForm.driverName} onChange={(e) => setTransportForm({ ...transportForm, driverName: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Driver Phone</Label><Input value={transportForm.driverPhone} onChange={(e) => setTransportForm({ ...transportForm, driverPhone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Rate/Day (৳)</Label><Input type="number" min={0} value={transportForm.ratePerDay} onChange={(e) => setTransportForm({ ...transportForm, ratePerDay: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Rate/Trip (৳)</Label><Input type="number" min={0} value={transportForm.ratePerTrip} onChange={(e) => setTransportForm({ ...transportForm, ratePerTrip: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Contract Start</Label><Input type="date" value={transportForm.contractStart} onChange={(e) => setTransportForm({ ...transportForm, contractStart: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Contract End</Label><Input type="date" value={transportForm.contractEnd} onChange={(e) => setTransportForm({ ...transportForm, contractEnd: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={transportForm.status} onChange={(e) => setTransportForm({ ...transportForm, status: e.target.value })}>
                <option value="available">Available</option><option value="in_use">In Use</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option>
              </select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={transportForm.notes} onChange={(e) => setTransportForm({ ...transportForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransport(false)}>Cancel</Button>
            <Button onClick={saveTransport} disabled={saving}>{saving ? "Saving..." : editTransport ? "Update" : "Add Vehicle"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
