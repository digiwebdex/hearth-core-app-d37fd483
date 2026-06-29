import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  HelpCircle, Phone, MessageCircle, CheckCircle2, Clock, CalendarClock,
  ChevronRight, Loader2, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bookingApi, type Booking, type BookingFollowUps } from "@/lib/api";

const waLink = (phone?: string, name?: string) => {
  if (!phone) return "#";
  const digits = phone.replace(/[^0-9]/g, "");
  const num = digits.startsWith("0") ? `88${digits}` : digits.startsWith("880") ? digits : `880${digits}`;
  const text = encodeURIComponent(`Assalamu Alaikum${name ? ` ${name}` : ""}, regarding your travel inquiry…`);
  return `https://wa.me/${num}?text=${text}`;
};

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : null;
const isOverdue = (d?: string | null) => d ? new Date(d) < new Date(new Date().setHours(0, 0, 0, 0)) : false;

const InquiryRow = ({ b, onAction }: { b: Booking; onAction: () => void }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState("");
  const [note, setNote] = useState(b.followUpNote || "");

  const phone = (b as any).clientPhone || "";
  const name = b.clientName || b.title || "Inquiry";

  const snooze = async (days?: number, explicit?: string) => {
    setBusy(true);
    try {
      let date = explicit;
      if (days != null) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        date = d.toISOString().slice(0, 10);
      }
      await bookingApi.updateFollowUp(b.id, { followUpDate: date || null, followUpNote: note || null });
      toast({ title: "Follow-up scheduled", description: `${name} — ${date ? fmtDate(date) : "no date"}` });
      setSnoozeOpen(false);
      onAction();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const convert = async () => {
    setBusy(true);
    try {
      await bookingApi.updateFollowUp(b.id, { status: "confirmed" });
      toast({ title: "Converted to booking", description: `${name} is now confirmed.` });
      onAction();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{name}</p>
          {phone && <span className="text-xs text-muted-foreground truncate">· {phone}</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {b.serviceType || b.type || "Inquiry"}
          {b.followUpNote ? ` — ${b.followUpNote}` : (b.followUpDate ? "" : " · no follow-up date set")}
        </p>
      </div>

      {b.followUpDate && (
        <Badge variant="outline" className={`text-xs whitespace-nowrap ${isOverdue(b.followUpDate) ? "border-destructive text-destructive" : ""}`}>
          <CalendarClock className="mr-1 h-3 w-3" />{fmtDate(b.followUpDate)}
        </Badge>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {phone && (
          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" asChild title="WhatsApp">
            <a href={waLink(phone, name)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a>
          </Button>
        )}
        <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Schedule follow-up" disabled={busy}>
              <Clock className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3" align="end">
            <p className="text-sm font-medium">Schedule next follow-up</p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => snooze(1)} disabled={busy}>Tomorrow</Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => snooze(3)} disabled={busy}>3 days</Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => snooze(7)} disabled={busy}>1 week</Button>
            </div>
            <Input type="date" value={snoozeDate} onChange={(e) => setSnoozeDate(e.target.value)} />
            <Input placeholder="Note (e.g. wants price for 4)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" className="w-full" onClick={() => snooze(undefined, snoozeDate)} disabled={busy || !snoozeDate}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save date"}
            </Button>
          </PopoverContent>
        </Popover>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" title="Convert to booking" onClick={convert} disabled={busy}>
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const InquiryFollowUpWidget = () => {
  const [data, setData] = useState<BookingFollowUps | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await bookingApi.getFollowUps();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-4 w-4 text-orange-500" /> Inquiries to follow up</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div></CardContent>
      </Card>
    );
  }

  const total = data?.counts.total ?? 0;
  const dueList = data?.due ?? [];
  const upcomingList = data?.upcoming ?? [];
  const noDateList = data?.noDate ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-orange-500" /> Inquiries to follow up
          {dueList.length > 0 && <Badge variant="destructive" className="ml-1">{dueList.length} due</Badge>}
        </CardTitle>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
            <p className="text-sm font-medium">All caught up</p>
            <p className="text-xs text-muted-foreground">No open inquiries. New "Inquiry" bookings will show here.</p>
          </div>
        ) : (
          <>
            {dueList.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Call today ({dueList.length})
                </p>
                {dueList.map((b) => <InquiryRow key={b.id} b={b} onAction={load} />)}
              </div>
            )}

            {noDateList.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Needs a follow-up date ({noDateList.length})</p>
                {noDateList.slice(0, 5).map((b) => <InquiryRow key={b.id} b={b} onAction={load} />)}
              </div>
            )}

            {upcomingList.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <CalendarClock className="h-3 w-3" /> Scheduled later ({upcomingList.length})
                </p>
                {upcomingList.slice(0, 3).map((b) => <InquiryRow key={b.id} b={b} onAction={load} />)}
              </div>
            )}

            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate("/bookings?status=inquiry")}>
              View all inquiries <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InquiryFollowUpWidget;
