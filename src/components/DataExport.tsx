import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Download, FileSpreadsheet, Loader2, Database, Calendar, ArchiveRestore,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";
const tok = () => localStorage.getItem("token") || "";

interface BackupInfo { lastBackup: string | null; count: number; }

const CSV_SECTIONS = [
  { label: "Clients",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  { label: "Bookings", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  { label: "Invoices", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  { label: "Payments", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  { label: "Leads",    color: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
];

async function downloadBlob(res: Response, fallback: string) {
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const filename = cd.match(/filename="([^"]+)"/)?.[1] || fallback;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  return filename;
}

export default function DataExport() {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate]     = useState(today);
  const [csvLoading, setCsvLoading]     = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);

  useEffect(() => {
    fetch(`${API}/export/backup-info`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then((r) => r.ok ? r.json() : null).then((d) => d && setBackupInfo(d)).catch(() => {});
  }, []);

  async function doCSV(all = false) {
    setCsvLoading(true);
    try {
      const url = all ? `${API}/export/csv` : `${API}/export/csv?from=${fromDate}&to=${toDate}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tok()}` } });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
      const fname = await downloadBlob(res, `hearth_export_${today}.csv`);
      toast({ title: "CSV downloaded", description: fname });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally { setCsvLoading(false); }
  }

  async function doBackup() {
    setBackupLoading(true);
    try {
      const res = await fetch(`${API}/export/db-backup`, {
        method: "POST", headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
      const fname = await downloadBlob(res, `hearth_backup_${today}.sql`);
      toast({ title: "Database backup downloaded", description: fname });
    } catch (e: any) {
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
    } finally { setBackupLoading(false); }
  }

  return (
    <div className="space-y-6">

      {/* ── CSV Export ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Export Data as CSV
          </CardTitle>
          <CardDescription>
            Download clients, bookings, invoices, payments and leads as a spreadsheet file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {CSV_SECTIONS.map((s) => (
              <span key={s.label} className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${s.color}`}>
                {s.label}
              </span>
            ))}
          </div>

          <Separator />

          {/* Date range */}
          <div>
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Filter by Date Range
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => doCSV(false)} disabled={csvLoading} className="gap-2">
              {csvLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Date Range CSV
            </Button>
            <Button variant="outline" onClick={() => doCSV(true)} disabled={csvLoading} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Full DB Backup ── */}
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-amber-600" />
            Full Database Backup
          </CardTitle>
          <CardDescription>
            Download a complete SQL dump of your database. Use to restore or migrate all agency data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {backupInfo && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white dark:bg-muted px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ArchiveRestore className="h-4 w-4" />
                Server auto-backups stored:
                <strong className="text-foreground">{backupInfo.count} files</strong>
              </span>
              {backupInfo.lastBackup && (
                <Badge variant="outline" className="font-mono text-xs">{backupInfo.lastBackup}</Badge>
              )}
            </div>
          )}

          <div className="rounded-lg bg-amber-100/70 dark:bg-amber-900/20 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
            ⚠️ This file contains your complete agency data. Keep it secure — do not share it.
          </div>

          <Button
            onClick={doBackup}
            disabled={backupLoading}
            variant="outline"
            className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
          >
            {backupLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating backup…</>
              : <><Download className="h-4 w-4" /> Download Full SQL Backup</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
