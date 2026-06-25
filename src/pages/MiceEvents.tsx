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
import { Plus, RefreshCw, ArrowLeft, Trash2, MapPin, Calendar, Users } from "lucide-react";
import { miceApi, type MiceEvent, type MiceEventItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const statusColor: Record<string, string> = {
  inquiry: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  ongoing: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

const EVENT_TYPES = ["conference", "seminar", "incentive_trip", "exhibition", "gala_dinner", "team_building", "product_launch", "other"];
const ITEM_TYPES = ["venue", "catering", "av_equipment", "accommodation", "transport", "decoration", "printing", "photography", "speaker_fee", "other"];

const emptyEvent = { title: "", eventType: "conference", clientId: "", venue: "", city: "", country: "", startDate: "", endDate: "", pax: "50", budget: "", status: "inquiry", notes: "" };
const emptyItem = { itemType: "venue", description: "", quantity: "1", unitCost: "", vendorId: "", notes: "" };

function fmt(n: number) { return `৳ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }

export default function MiceEvents() {
  const { toast } = useToast();
  const [events, setEvents] = useState<MiceEvent[]>([]);
  const [selected, setSelected] = useState<MiceEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyEvent);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [addingItem, setAddingItem] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await miceApi.list({ search: searchQ || undefined }));
    } catch { toast({ title: "Failed to load events", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [searchQ]);

  const loadDetail = useCallback(async (id: string) => {
    try { setSelected(await miceApi.get(id)); }
    catch { toast({ title: "Failed to load event", variant: "destructive" }); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createEvent() {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      await miceApi.create({
        title: form.title, eventType: form.eventType, clientId: form.clientId || undefined,
        venue: form.venue || undefined, city: form.city || undefined, country: form.country || undefined,
        startDate: form.startDate || undefined, endDate: form.endDate || undefined,
        pax: parseInt(form.pax) || 1, budget: parseFloat(form.budget) || 0,
        status: form.status, notes: form.notes || undefined,
      });
      toast({ title: "MICE event created" });
      setShowCreate(false);
      setForm(emptyEvent);
      load();
    } catch { toast({ title: "Failed to create", variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function addItem() {
    if (!selected) return;
    setAddingItem(true);
    try {
      await miceApi.addItem(selected.id, {
        itemType: itemForm.itemType, description: itemForm.description || undefined,
        quantity: parseInt(itemForm.quantity) || 1, unitCost: parseFloat(itemForm.unitCost) || 0,
        vendorId: itemForm.vendorId || undefined, notes: itemForm.notes || undefined,
      });
      toast({ title: "Item added" });
      setShowAddItem(false);
      setItemForm(emptyItem);
      loadDetail(selected.id);
    } catch { toast({ title: "Failed to add item", variant: "destructive" }); }
    finally { setAddingItem(false); }
  }

  async function deleteItem(itemId: string) {
    if (!selected) return;
    try {
      await miceApi.deleteItem(selected.id, itemId);
      toast({ title: "Item removed" });
      loadDetail(selected.id);
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  }

  const totalBudget = selected?.items?.reduce((s, i) => s + i.totalCost, 0) || 0;

  if (selected) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => { setSelected(null); load(); }}>
              <ArrowLeft className="w-4 h-4 mr-1" />Back
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{selected.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-0.5">
                <span className="capitalize">{selected.eventType.replace("_", " ")}</span>
                {selected.venue && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selected.venue}</span>}
                {selected.city && <span>{selected.city}{selected.country ? `, ${selected.country}` : ""}</span>}
                {selected.startDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(selected.startDate).toLocaleDateString()}</span>}
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor[selected.status] || ""}`}>{selected.status}</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{selected.pax}</p><p className="text-xs text-muted-foreground mt-1">Attendees (PAX)</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{fmt(selected.budget || 0)}</p><p className="text-xs text-muted-foreground mt-1">Allocated Budget</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{fmt(totalBudget)}</p><p className="text-xs text-muted-foreground mt-1">Items Total Cost</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Event Budget Items</CardTitle>
              <Button size="sm" onClick={() => setShowAddItem(true)}><Plus className="w-4 h-4 mr-1.5" />Add Item</Button>
            </CardHeader>
            <CardContent className="p-0">
              {!selected.items || selected.items.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No items yet. Add venue, catering, AV, etc. to build the budget breakdown.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-4 py-2 font-medium">Description</th>
                      <th className="text-right px-4 py-2 font-medium">Qty</th>
                      <th className="text-right px-4 py-2 font-medium">Unit Cost</th>
                      <th className="text-right px-4 py-2 font-medium">Total</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5 capitalize font-medium">{item.itemType.replace("_", " ")}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{item.description || "—"}</td>
                        <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(item.unitCost)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{fmt(item.totalCost)}</td>
                        <td className="px-4 py-2.5">
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteItem(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/20">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 font-semibold text-right">Total</td>
                      <td className="px-4 py-2 font-bold text-right">{fmt(totalBudget)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Budget Item</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Item Type</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={itemForm.itemType} onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Description</Label><Input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" min={1} value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Unit Cost (৳)</Label><Input type="number" min={0} value={itemForm.unitCost} onChange={(e) => setItemForm({ ...itemForm, unitCost: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Notes</Label><Input value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
              <Button onClick={addItem} disabled={addingItem}>{addingItem ? "Adding..." : "Add Item"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">MICE Events</h1>
            <p className="text-muted-foreground text-sm mt-1">Meetings, Incentives, Conferences & Exhibitions management</p>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Input className="w-52 h-8 text-sm" placeholder="Search events..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />New Event</Button>
          </div>
        </div>

        {loading ? <Skeleton className="h-60 w-full" /> : events.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <p className="font-medium">No MICE events yet</p>
            <p className="text-sm mt-1">Create your first conference, seminar, or incentive trip event.</p>
          </CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => (
              <Card key={ev.id} className="hover:border-primary/40 cursor-pointer transition-colors" onClick={() => loadDetail(ev.id)}>
                <CardContent className="pt-4 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold leading-tight">{ev.title}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusColor[ev.status] || ""}`}>{ev.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">{ev.eventType.replace("_", " ")}</p>
                  {ev.client && <p className="text-sm text-muted-foreground">{ev.client.name}</p>}
                  {(ev.city || ev.venue) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.venue || ""}{ev.venue && ev.city ? " · " : ""}{ev.city}</p>
                  )}
                  {ev.startDate && <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(ev.startDate).toLocaleDateString()}</p>}
                  <div className="flex justify-between pt-1 border-t text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground"><Users className="w-3.5 h-3.5" />{ev.pax} pax</span>
                    {ev.budget > 0 && <span className="font-medium">{fmt(ev.budget)}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create MICE Event</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1.5"><Label>Event Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Event Type</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {Object.keys(statusColor).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Venue</Label><Input placeholder="Hotel / Convention center name" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Attendees (PAX)</Label><Input type="number" min={1} value={form.pax} onChange={(e) => setForm({ ...form, pax: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Budget (৳)</Label><Input type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createEvent} disabled={creating}>{creating ? "Creating..." : "Create Event"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
