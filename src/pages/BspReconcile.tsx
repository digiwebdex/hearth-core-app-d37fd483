import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, XCircle, Trash2, ChevronRight, Download } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
function authHeaders() {
  const token = localStorage.getItem("token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Request failed");
  return res.json();
}

type BspUpload = { id: string; fileName: string; period?: string; totalRecords: number; matchedCount: number; unmatchedCount: number; status: string; createdAt: string; };
type BspRecord = { id: string; ticketNumber?: string; passengerName?: string; airline?: string; issuedDate?: string; fare: number; tax: number; total: number; commission: number; netRemit: number; matchStatus: string; matchedBookingId?: string; matchedPnr?: string; matchNote?: string; };
type BspDetail = BspUpload & { records: BspRecord[] };

function money(v: number) { return (v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const SAMPLE_CSV = `TICKET NUMBER,PASSENGER NAME,AIRLINE,ISSUED DATE,FARE,TAX,TOTAL,COMMISSION,NET REMIT
0171234567890,John Smith,Biman,2026-06-10,15000,2500,17500,1050,16450
0172345678901,Sarah Ahmed,Emirates,2026-06-11,25000,3200,28200,1692,26508
0173456789012,Karim Hossain,Qatar,2026-06-12,18000,2800,20800,1248,19552`;

export default function BspReconcile() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<BspUpload[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<BspDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [period, setPeriod] = useState("");
  const [tab, setTab] = useState("upload");
  const [filterStatus, setFilterStatus] = useState("all");

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try { setUploads(await apiFetch("/bsp-reconcile")); }
    catch { toast({ variant: "destructive", title: "Failed to load BSP uploads" }); }
    finally { setLoadingList(false); }
  }, [toast]);

  useEffect(() => { loadList(); }, [loadList]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setCsvText(String(ev.target?.result || ""));
    reader.readAsText(file);
  };

  const doUpload = async () => {
    if (!csvText.trim()) { toast({ variant: "destructive", title: "Please select or paste a CSV file" }); return; }
    setUploading(true);
    try {
      const result = await apiFetch("/bsp-reconcile", {
        method: "POST",
        body: JSON.stringify({ csvText, fileName: fileName || "bsp-upload.csv", period }),
      });
      toast({ title: "BSP uploaded", description: `${result.totalRecords} records — ${result.matchedCount} matched, ${result.unmatchedCount} unmatched` });
      setCsvText(""); setFileName(""); setPeriod("");
      if (fileRef.current) fileRef.current.value = "";
      await loadList();
      setSelected(result);
      setTab("history");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally { setUploading(false); }
  };

  const openDetail = async (id: string) => {
    setLoadingDetail(true);
    try { setSelected(await apiFetch(`/bsp-reconcile/${id}`)); setTab("detail"); }
    catch { toast({ variant: "destructive", title: "Failed to load" }); }
    finally { setLoadingDetail(false); }
  };

  const deleteUpload = async (id: string) => {
    try {
      await apiFetch(`/bsp-reconcile/${id}`, { method: "DELETE" });
      setUploads(prev => prev.filter(u => u.id !== id));
      if (selected?.id === id) { setSelected(null); setTab("history"); }
      toast({ title: "Deleted" });
    } catch { toast({ variant: "destructive", title: "Delete failed" }); }
  };

  const exportCsv = () => {
    if (!selected) return;
    const rows = [
      ["Ticket Number","Passenger","Airline","Issued Date","Fare","Tax","Total","Commission","Net Remit","Match Status","Matched Booking"],
      ...selected.records.map(r => [r.ticketNumber||"",r.passengerName||"",r.airline||"",r.issuedDate||"",r.fare,r.tax,r.total,r.commission,r.netRemit,r.matchStatus,r.matchedBookingId||""]),
    ];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bsp-reconcile-${selected.id.slice(0,8)}.csv`;
    a.click();
  };

  const filteredRecords = selected?.records.filter(r => filterStatus === "all" || r.matchStatus === filterStatus) || [];

  const totalFare = selected?.records.reduce((s, r) => s + r.fare, 0) || 0;
  const totalTax = selected?.records.reduce((s, r) => s + r.tax, 0) || 0;
  const totalAmount = selected?.records.reduce((s, r) => s + r.total, 0) || 0;
  const totalNet = selected?.records.reduce((s, r) => s + r.netRemit, 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7" /> IATA / BSP Reconcile
          </h1>
          <p className="text-muted-foreground mt-1">Upload your BSP statement CSV to match issued tickets against bookings</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="upload">Upload New</TabsTrigger>
            <TabsTrigger value="history">History ({uploads.length})</TabsTrigger>
            {selected && <TabsTrigger value="detail">Report: {selected.fileName}</TabsTrigger>}
          </TabsList>

          {/* ── Upload tab ── */}
          <TabsContent value="upload" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Upload BSP CSV</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>CSV File</Label>
                    <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFileChange} className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>BSP Period (optional)</Label>
                      <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. June 2026" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>File name</Label>
                      <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="bsp-june-2026.csv" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Or paste CSV text directly</Label>
                    <textarea
                      className="w-full h-32 text-xs font-mono rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      value={csvText} onChange={e => setCsvText(e.target.value)}
                      placeholder="Paste CSV content here…"
                    />
                  </div>
                  <Button onClick={doUpload} disabled={uploading || !csvText.trim()} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />{uploading ? "Processing…" : "Upload & Reconcile"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Expected CSV Format</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">The system auto-detects flexible column names. Supported headers:</p>
                  <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono space-y-1">
                    <p className="font-semibold text-foreground">TICKET NUMBER, PASSENGER NAME, AIRLINE</p>
                    <p className="font-semibold text-foreground">ISSUED DATE, FARE, TAX, TOTAL</p>
                    <p className="font-semibold text-foreground">COMMISSION, NET REMIT</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Matching is done by ticket number against booking supplierRef, PNR fields, and ticket transaction records.</p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Sample CSV:</p>
                    <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">{SAMPLE_CSV}</pre>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => { setCsvText(SAMPLE_CSV); setFileName("sample-bsp.csv"); }}>
                      Load sample data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── History tab ── */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Matched</TableHead>
                      <TableHead className="text-center">Unmatched</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingList ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : uploads.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No BSP uploads yet</TableCell></TableRow>
                    ) : uploads.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium text-sm">{u.fileName}</TableCell>
                        <TableCell className="text-sm">{u.period || "—"}</TableCell>
                        <TableCell className="text-center">{u.totalRecords}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600 font-medium">{u.matchedCount}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={u.unmatchedCount > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{u.unmatchedCount}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(u.createdAt), "PP")}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => openDetail(u.id)} disabled={loadingDetail}>
                            View <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteUpload(u.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Detail tab ── */}
          {selected && (
            <TabsContent value="detail" className="mt-4 space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total tickets", value: selected.totalRecords, color: "" },
                  { label: "Matched", value: selected.matchedCount, color: "text-green-600" },
                  { label: "Unmatched", value: selected.unmatchedCount, color: "text-destructive" },
                  { label: "Match rate", value: `${selected.totalRecords ? Math.round(selected.matchedCount / selected.totalRecords * 100) : 0}%`, color: "" },
                ].map(({ label, value, color }) => (
                  <Card key={label}><CardContent className="p-4"><p className={`text-2xl font-bold ${color}`}>{value}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></CardContent></Card>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total fare", value: `${money(totalFare)}` },
                  { label: "Total tax", value: `${money(totalTax)}` },
                  { label: "Gross amount", value: `${money(totalAmount)}` },
                  { label: "Net remit (BSP)", value: `${money(totalNet)}` },
                ].map(({ label, value }) => (
                  <Card key={label}><CardContent className="p-4"><p className="text-lg font-bold">{value}</p><p className="text-xs text-muted-foreground mt-0.5">{label}</p></CardContent></Card>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {["all","matched","unmatched"].map(s => (
                    <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)} className="capitalize">{s} {s === "all" ? `(${selected.records.length})` : s === "matched" ? `(${selected.matchedCount})` : `(${selected.unmatchedCount})`}</Button>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="h-4 w-4 mr-1.5" /> Export CSV
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket #</TableHead>
                        <TableHead>Passenger</TableHead>
                        <TableHead>Airline</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Fare</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Net Remit</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No records</TableCell></TableRow>
                      ) : filteredRecords.map(r => (
                        <TableRow key={r.id} className={r.matchStatus === "unmatched" ? "bg-red-50/30 dark:bg-red-950/10" : ""}>
                          <TableCell className="font-mono text-xs">{r.ticketNumber || "—"}</TableCell>
                          <TableCell className="text-sm">{r.passengerName || "—"}</TableCell>
                          <TableCell className="text-sm">{r.airline || "—"}</TableCell>
                          <TableCell className="text-xs">{r.issuedDate || "—"}</TableCell>
                          <TableCell className="text-right text-sm">{money(r.fare)}</TableCell>
                          <TableCell className="text-right text-sm">{money(r.tax)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{money(r.total)}</TableCell>
                          <TableCell className="text-right text-sm">{money(r.netRemit)}</TableCell>
                          <TableCell>
                            {r.matchStatus === "matched" ? (
                              <Badge className="bg-green-100 text-green-700 border-green-300">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Matched
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300">
                                <XCircle className="h-3 w-3 mr-1" /> Unmatched
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
