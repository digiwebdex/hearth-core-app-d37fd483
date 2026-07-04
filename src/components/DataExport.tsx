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

const SHEETS = [
  "Summary", "Clients", "Leads", "Vendors", "Agents", "Quotations", "Bookings",
  "Invoices", "Payments", "Expenses", "Ledger", "Accounts", "Tasks", "Complaints",
  "Campaigns", "Packages", "Hajj", "Visa", "Tours", "Support", "…every module",
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
  const [xlsxLoading, setXlsxLoading]   = useState(false);
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

  async function doExcel(all = false) {
    setXlsxLoading(true);
    try {
      const url = all ? `${API}/export/workbook` : `${API}/export/workbook?from=${fromDate}&to=${toDate}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tok()}` } });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
      const fname = await downloadBlob(res, `hearth_export_${today}.xlsx`);
      toast({ title: "Excel workbook downloaded", description: fname });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally { setXlsxLoading(false); }
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

      {/* ── Excel / CSV Export ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Export data to Excel
          </CardTitle>
          <CardDescription>
            One organised Excel workbook: a <strong>Summary</strong> dashboard sheet first, then a sheet for <strong>every module</strong> — with <strong>all fields</strong> for each record. Complete, and easy to read.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Sheet tags */}
          <div className="flex flex-wrap gap-1.5">
            {SHEETS.map((s) => (
              <span key={s} className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${s === "Summary" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {s}
              </span>
            ))}
          </div>

          <Separator />

          {/* Date range */}
          <div>
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Filter by date range (optional)
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
            <Button onClick={() => doExcel(true)} disabled={xlsxLoading} className="gap-2">
              {xlsxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Download full Excel (all sheets)
            </Button>
            <Button variant="outline" onClick={() => doExcel(false)} disabled={xlsxLoading} className="gap-2">
              <Download className="h-4 w-4" />
              Excel for date range
            </Button>
          </div>

          <Separator />
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Prefer a plain file?</span>
            <Button variant="ghost" size="sm" onClick={() => doCSV(true)} disabled={csvLoading} className="gap-2 h-8">
              {csvLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download CSV instead
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
