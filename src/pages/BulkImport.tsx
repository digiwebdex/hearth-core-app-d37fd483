import { useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Users, Plane, CheckCircle2, XCircle, FileText, AlertCircle } from "lucide-react";

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

const SAMPLE_CLIENTS = `Name,Phone,Email,Passport Number,Nationality,Address
John Smith,+880171234567,john@example.com,A12345678,Bangladeshi,"Dhaka, Bangladesh"
Sarah Ahmed,+880181234567,sarah@example.com,B98765432,Bangladeshi,"Chittagong, Bangladesh"
Karim Hossain,+880191234567,,C55555555,Bangladeshi,`;

const SAMPLE_BOOKINGS = `Title,Client Name,Destination,Travel Date From,Travel Date To,PNR,Amount,Service Type
Umrah Package 2026,John Smith,Makkah,2026-09-01,2026-09-15,ABC123,85000,hajj_umrah
Dubai Tour,Sarah Ahmed,Dubai,2026-07-10,2026-07-17,DEF456,45000,international
Cox's Bazar Trip,Karim Hossain,Cox's Bazar,2026-08-01,2026-08-03,GHI789,12000,domestic`;

type PreviewData = {
  headers: string[];
  totalRows: number;
  preview: Record<string, string>[];
  type: string;
};

type ImportResult = {
  created: number;
  failed: number;
  failedRows: { row: Record<string, string>; reason: string }[];
};

function FileUploadZone({ onText, sampleCsv, sampleName }: { onText: (t: string, name: string) => void; sampleCsv: string; sampleName: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => onText(String(e.target?.result || ""), file.name);
    reader.readAsText(file);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
    >
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm font-medium">Drop CSV here or click to browse</p>
      <p className="text-xs text-muted-foreground mt-1">Accepts .csv or .txt</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={e => { e.stopPropagation(); onText(sampleCsv, sampleName); }}>
        Load sample CSV
      </Button>
    </div>
  );
}

function ImportTab({ type, sampleCsv, sampleName, previewKeys }: {
  type: "clients" | "bookings";
  sampleCsv: string;
  sampleName: string;
  previewKeys: { key: string; label: string }[];
}) {
  const { toast } = useToast();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const loadText = (text: string, name: string) => {
    setCsvText(text);
    setFileName(name);
    setPreview(null);
    setResult(null);
  };

  const doPreview = async () => {
    if (!csvText.trim()) { toast({ variant: "destructive", title: "No CSV content" }); return; }
    setPreviewing(true);
    try {
      const data = await apiFetch("/bulk-import/preview", { method: "POST", body: JSON.stringify({ csvText, type }) });
      setPreview(data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Preview failed", description: err.message });
    } finally { setPreviewing(false); }
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const data = await apiFetch(`/bulk-import/${type}`, { method: "POST", body: JSON.stringify({ csvText }) });
      setResult(data);
      toast({ title: `Import complete`, description: `${data.created} ${type} created, ${data.failed} failed` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import failed", description: err.message });
    } finally { setImporting(false); }
  };

  const reset = () => { setCsvText(""); setFileName(""); setPreview(null); setResult(null); };

  if (result) {
    return (
      <div className="space-y-4">
        <Card className={result.failed === 0 ? "border-green-300 bg-green-50/50 dark:bg-green-950/20" : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"}>
          <CardContent className="p-6 flex items-center gap-4">
            {result.failed === 0 ? <CheckCircle2 className="h-10 w-10 text-green-600 shrink-0" /> : <AlertCircle className="h-10 w-10 text-amber-600 shrink-0" />}
            <div>
              <p className="text-xl font-bold">{result.created} {type} imported successfully</p>
              {result.failed > 0 && <p className="text-sm text-muted-foreground mt-0.5">{result.failed} rows failed — see details below</p>}
            </div>
          </CardContent>
        </Card>

        {result.failed > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm text-destructive">Failed rows ({result.failed})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Row data</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                <TableBody>
                  {result.failedRows.map((fr, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-mono">{JSON.stringify(fr.row).slice(0, 100)}…</TableCell>
                      <TableCell className="text-xs text-destructive">{fr.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        <Button variant="outline" onClick={reset}>Import another file</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FileUploadZone onText={loadText} sampleCsv={sampleCsv} sampleName={sampleName} />

      {csvText && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{fileName || "pasted CSV"}</span>
            <span className="text-muted-foreground">— {csvText.split("\n").filter(Boolean).length - 1} data rows</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={reset}>Clear</Button>
            <Button size="sm" onClick={doPreview} disabled={previewing}>{previewing ? "Previewing…" : "Preview"}</Button>
          </div>
        </div>
      )}

      {preview && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Preview — {preview.totalRows} rows total (showing first 5)</CardTitle>
              <Button onClick={doImport} disabled={importing}>
                <Upload className="h-4 w-4 mr-2" />
                {importing ? "Importing…" : `Import all ${preview.totalRows} ${type}`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {previewKeys.map(k => <TableHead key={k.key}>{k.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.preview.map((row, i) => (
                  <TableRow key={i}>
                    {previewKeys.map(k => (
                      <TableCell key={k.key} className="text-sm">{(row as Record<string,string>)[k.key] || <span className="text-muted-foreground">—</span>}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BulkImport() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Upload className="h-7 w-7" /> Bulk Import
          </h1>
          <p className="text-muted-foreground mt-1">Import clients and bookings in bulk from CSV or Excel-exported files</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Users, label: "Upload a CSV file", desc: "Drag & drop or browse" },
            { icon: FileText, label: "Preview rows", desc: "Check before committing" },
            { icon: CheckCircle2, label: "Import", desc: "Records created instantly" },
          ].map(({ icon: Icon, label, desc }) => (
            <Card key={label} className="text-center">
              <CardContent className="p-4">
                <Icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="clients">
          <TabsList>
            <TabsTrigger value="clients" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Import Clients
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-1.5">
              <Plane className="h-4 w-4" /> Import Bookings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">Required & Optional Columns</CardTitle>
                  <Badge variant="outline" className="text-xs">flexible headers</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { col: "Name", req: true }, { col: "Phone", req: false }, { col: "Email", req: false },
                    { col: "Passport Number", req: false }, { col: "Nationality", req: false }, { col: "Address", req: false },
                    { col: "Notes", req: false },
                  ].map(({ col, req }) => (
                    <div key={col} className="flex items-center gap-1.5">
                      {req ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span>{col} {req && <span className="text-destructive">*</span>}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <ImportTab
              type="clients"
              sampleCsv={SAMPLE_CLIENTS}
              sampleName="sample-clients.csv"
              previewKeys={[
                { key: "name", label: "Name" },
                { key: "phone", label: "Phone" },
                { key: "email", label: "Email" },
                { key: "passportNumber", label: "Passport" },
                { key: "nationality", label: "Nationality" },
              ]}
            />
          </TabsContent>

          <TabsContent value="bookings" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">Required & Optional Columns</CardTitle>
                  <Badge variant="outline" className="text-xs">flexible headers</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { col: "Title / Service", req: true }, { col: "Client Name", req: true }, { col: "Destination", req: false },
                    { col: "Travel Date From", req: false }, { col: "Travel Date To", req: false }, { col: "PNR / Supplier Ref", req: false },
                    { col: "Amount", req: false }, { col: "Service Type", req: false },
                  ].map(({ col, req }) => (
                    <div key={col} className="flex items-center gap-1.5">
                      {req ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span>{col} {req && <span className="text-destructive">*</span>}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">If the client doesn't exist, a new client record is created automatically.</p>
              </CardContent>
            </Card>
            <ImportTab
              type="bookings"
              sampleCsv={SAMPLE_BOOKINGS}
              sampleName="sample-bookings.csv"
              previewKeys={[
                { key: "title", label: "Title" },
                { key: "clientName", label: "Client" },
                { key: "destination", label: "Destination" },
                { key: "travelDateFrom", label: "Departure" },
                { key: "supplierRef", label: "PNR" },
                { key: "amount", label: "Amount" },
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
