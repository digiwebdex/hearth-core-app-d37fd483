import { useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, Upload, FileText, Printer, Check } from "lucide-react";
import { portalApi, portalFileUrl, type PortalInvoiceSummary, type PortalBookingDetail } from "@/lib/portalApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatMoney, formatDate } from "../lib/format";

// ── Booking status tracker ── maps the booking status to a 4-stage journey.
const STAGES = ["booked", "confirmed", "inProgress", "completed"] as const;
function stageIndex(status: string): number {
  const s = status.toLowerCase();
  if (/cancel/.test(s)) return -1;
  if (/complete|delivered|traveled/.test(s)) return 3;
  if (/ticketed|traveling|in.?progress|processing|ongoing/.test(s)) return 2;
  if (/confirm/.test(s)) return 1;
  return 0; // inquiry / pending / booked
}

function StatusTracker({ status }: { status: string }) {
  const { t } = useTranslation();
  const idx = stageIndex(status);
  const labels: Record<string, string> = {
    booked: t("portal.stageBooked", { defaultValue: "Booked" }),
    confirmed: t("portal.stageConfirmed", { defaultValue: "Confirmed" }),
    inProgress: t("portal.stageInProgress", { defaultValue: "In progress" }),
    completed: t("portal.stageCompleted", { defaultValue: "Completed" }),
  };
  if (idx === -1) return <Badge variant="destructive" className="capitalize">{t("portal.cancelled", { defaultValue: "Cancelled" })}</Badge>;
  return (
    <div className="flex items-center">
      {STAGES.map((st, i) => {
        const done = i <= idx;
        return (
          <div key={st} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs ${done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"}`}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`mt-1 text-[11px] ${done ? "text-foreground" : "text-muted-foreground"}`}>{labels[st]}</span>
            </div>
            {i < STAGES.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${i < idx ? "bg-primary" : "bg-muted-foreground/20"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Invoice → printable (browser "Save as PDF") — reuses the sanitized invoice JSON, no backend PDF needed. ──
function printInvoice(inv: PortalInvoiceSummary, booking: PortalBookingDetail) {
  const rows = inv.installments.map((k) => `<tr><td>${k.label}${k.dueDate ? " · " + new Date(k.dueDate).toLocaleDateString() : ""}</td><td style="text-align:right">${formatMoney(k.paidAmount)} / ${formatMoney(k.amount)}</td><td>${k.status}</td></tr>`).join("");
  const w = window.open("", "_blank", "width=800,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Invoice ${inv.invoiceNumber || inv.id}</title>
    <style>body{font-family:Inter,system-ui,sans-serif;padding:32px;color:#0f172a}h1{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:left}.tot{display:flex;justify-content:space-between;margin-top:16px;font-weight:600}.muted{color:#64748b;font-size:13px}</style>
    </head><body>
    <h1>Invoice ${inv.invoiceNumber || inv.id.slice(0, 8)}</h1>
    <div class="muted">${booking.tenantName || ""} · ${booking.title || booking.destination || ""}</div>
    <div class="muted">Issued: ${inv.issuedDate ? new Date(inv.issuedDate).toLocaleDateString() : "—"} · Due: ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"} · Status: ${inv.status}</div>
    ${rows ? `<table><thead><tr><th>Installment</th><th style="text-align:right">Paid / Amount</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
    <div class="tot"><span>Total</span><span>${formatMoney(inv.totalAmount)}</span></div>
    <div class="tot"><span>Paid</span><span>${formatMoney(inv.paidAmount)}</span></div>
    <div class="tot"><span>Due</span><span>${formatMoney(inv.dueAmount)}</span></div>
    <script>window.onload=function(){window.print()}</script>
    </body></html>`);
  w.document.close();
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-booking", id],
    queryFn: () => portalApi.bookingDetail(id!),
    enabled: Boolean(id),
  });
  const documents = useQuery({
    queryKey: ["portal-booking-docs", id],
    queryFn: () => portalApi.bookingDocuments(id!),
    enabled: Boolean(id),
  });

  const upload = useMutation({
    mutationFn: (file: File) => portalApi.uploadDocument(id!, file, { category: "passport" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portal-booking-docs", id] }); toast({ title: t("portal.docUploaded", { defaultValue: "Document uploaded" }) }); },
    onError: (e: Error) => toast({ title: t("portal.uploadFailed", { defaultValue: "Upload failed" }), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/bookings"><ArrowLeft className="h-4 w-4 mr-1" />{t("portal.backToBookings")}</Link>
      </Button>

      {isLoading && <Skeleton className="h-64 w-full" />}
      {error && <p className="text-destructive">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{data.title || data.destination || t("portal.bookingFallback")}</h1>
              <p className="text-sm text-muted-foreground">
                {data.destination}{data.travelDateFrom ? ` · ${formatDate(data.travelDateFrom)}` : ""}{data.travelDateTo ? ` → ${formatDate(data.travelDateTo)}` : ""}
              </p>
              {data.tenantName && <p className="text-xs text-muted-foreground mt-1">{t("portal.agency")}: {data.tenantName}</p>}
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="capitalize">{data.status}</Badge>
              <Badge className="capitalize">{data.paymentStatus}</Badge>
            </div>
          </div>

          {/* Booking tracking */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t("portal.tracking", { defaultValue: "Tracking" })}</CardTitle></CardHeader>
            <CardContent><StatusTracker status={data.status} /></CardContent>
          </Card>

          {/* Payment summary */}
          <Card>
            <CardHeader><CardTitle className="text-base">{t("portal.paymentSummary")}</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              <div><div className="text-muted-foreground">{t("portal.total")}</div><div className="font-medium">{formatMoney(data.amount)}</div></div>
              <div><div className="text-muted-foreground">{t("portal.paid")}</div><div className="font-medium">{formatMoney(data.paidAmount)}</div></div>
              <div><div className="text-muted-foreground">{t("portal.due")}</div><div className={`font-medium ${data.dueAmount > 0 ? "text-destructive" : ""}`}>{formatMoney(data.dueAmount)}</div></div>
            </CardContent>
          </Card>

          {data.travelers.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("portal.travelers")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.travelers.map((tr) => (
                  <div key={tr.id} className="text-sm">{tr.name}{tr.nationality ? <span className="text-muted-foreground"> · {tr.nationality}</span> : null}</div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Invoices + download */}
          {data.invoices.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("portal.invoices")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {data.invoices.map((inv) => (
                  <div key={inv.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{inv.invoiceNumber || inv.id.slice(0, 8)}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{inv.status}</Badge>
                        <Button variant="outline" size="sm" onClick={() => printInvoice(inv, data)}>
                          <Printer className="h-3.5 w-3.5 mr-1" />{t("portal.downloadInvoice", { defaultValue: "Download" })}
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatMoney(inv.paidAmount)} / {formatMoney(inv.totalAmount)}
                      {inv.dueAmount > 0 && <span className="text-destructive ml-2">{t("portal.due")}: {formatMoney(inv.dueAmount)}</span>}
                    </div>
                    {inv.installments.length > 0 && (
                      <div className="space-y-1 pt-1 border-t">
                        <div className="text-xs font-medium text-muted-foreground">{t("portal.installments")}</div>
                        {inv.installments.map((k) => (
                          <div key={k.id} className="flex justify-between text-xs gap-2">
                            <span>{k.label}{k.dueDate ? ` · ${formatDate(k.dueDate)}` : ""}</span>
                            <span>{formatMoney(k.paidAmount)} / {formatMoney(k.amount)} · {k.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Documents & Tickets — list (download) + upload (passport etc.) */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t("portal.documentsTickets", { defaultValue: "Documents & Tickets" })}</CardTitle>
              <>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.currentTarget.value = ""; }} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                  <Upload className="h-3.5 w-3.5 mr-1" />{upload.isPending ? t("common.saving", { defaultValue: "Saving…" }) : t("portal.upload", { defaultValue: "Upload" })}
                </Button>
              </>
            </CardHeader>
            <CardContent>
              {documents.isLoading ? <Skeleton className="h-16 w-full" /> : (documents.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">{t("portal.noDocuments", { defaultValue: "No documents yet. Upload your passport or download tickets your agency shares here." })}</p>
              ) : (
                <div className="space-y-2">
                  {documents.data!.map((doc) => {
                    const latest = doc.versions?.[doc.versions.length - 1];
                    return (
                      <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm truncate">{doc.title}</div>
                            <div className="text-xs text-muted-foreground capitalize">{doc.category} · {formatDate(doc.createdAt)}</div>
                          </div>
                        </div>
                        {latest?.url && (
                          <a href={portalFileUrl(latest.url)} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm"><Download className="h-4 w-4 mr-1" />{t("portal.download", { defaultValue: "Download" })}</Button>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trip updates */}
          {data.timeline.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("portal.updates")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.timeline.map((ev) => (
                  <div key={ev.id} className="text-sm border-l-2 pl-3 border-primary/30">
                    <div>{ev.content}</div>
                    <div className="text-xs text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
