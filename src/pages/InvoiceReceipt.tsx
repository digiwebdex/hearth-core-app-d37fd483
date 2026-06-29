import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Printer, Download, Building2, Phone, Globe, MapPin,
  Calendar, User, Hash, CheckCircle2, Clock, XCircle, AlertTriangle,
  RotateCcw, Ban, CreditCard, FileText, Plane,
} from "lucide-react";
import { invoiceApi, type Invoice, type Payment } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bank: "Bank Transfer", card: "Card / POS",
  mobile_banking: "Mobile Banking", cheque: "Cheque", online: "Online",
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  unpaid:   { label: "Unpaid",   color: "#ef4444", bg: "#fef2f2", icon: XCircle },
  partial:  { label: "Partial",  color: "#f59e0b", bg: "#fffbeb", icon: Clock },
  paid:     { label: "Paid",     color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle2 },
  overdue:  { label: "Overdue",  color: "#ea580c", bg: "#fff7ed", icon: AlertTriangle },
  refunded: { label: "Refunded", color: "#9333ea", bg: "#faf5ff", icon: RotateCcw },
  cancelled:{ label: "Cancelled",color: "#6b7280", bg: "#f9fafb", icon: Ban },
};

const fmt = (n: number, cur = "৳") => `${cur}${n.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const InvoiceReceipt = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<"invoice" | "receipt" | "statement">("invoice");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      invoiceApi.get(id),
      invoiceApi.getPayments(id).catch(() => []),
    ]).then(([inv, pays]) => {
      setInvoice(inv);
      setPayments(pays);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading document…</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <FileText className="h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Invoice not found.</p>
        <Button variant="outline" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
        </Button>
      </div>
    );
  }

  const status = STATUS_CFG[invoice.status] || STATUS_CFG.unpaid;
  const StatusIcon = status.icon;
  const invoiceNo = invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
  const currency = tenant?.currency || "৳";
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = invoice.totalAmount - totalPaid;

  const docLabel = { invoice: "INVOICE", receipt: "PAYMENT RECEIPT", statement: "ACCOUNT STATEMENT" }[docType];
  const agencyAddress = [tenant?.address, tenant?.city, tenant?.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Toolbar (print:hidden) ── */}
      <div className="print:hidden sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>

          {/* Doc type switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
            {(["invoice", "receipt", "statement"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDocType(t)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                  docType === t
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Document ── */}
      <div className="max-w-[794px] mx-auto my-8 print:my-0 print:max-w-full" ref={printRef}>
        <div
          className="bg-white shadow-lg print:shadow-none"
          style={{ minHeight: "1123px", fontFamily: "'Segoe UI', Arial, sans-serif" }}
        >
          {/* ══ HEADER BAND ══ */}
          <div
            style={{
              background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
              padding: "32px 40px 28px",
              color: "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {/* Agency branding */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {tenant?.logo ? (
                  <img
                    src={tenant.logo}
                    alt={tenant.name}
                    style={{
                      height: "60px",
                      maxWidth: "140px",
                      objectFit: "contain",
                      background: "white",
                      borderRadius: "8px",
                      padding: "6px",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      background: "rgba(255,255,255,0.15)",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Plane style={{ width: "28px", height: "28px", color: "white" }} />
                  </div>
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "-0.3px" }}>
                    {tenant?.name || "Travel Agency"}
                  </h2>
                  {agencyAddress && (
                    <p style={{ margin: "3px 0 0", fontSize: "12px", opacity: 0.8 }}>
                      <MapPin style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
                      {agencyAddress}
                    </p>
                  )}
                  {tenant?.phone && (
                    <p style={{ margin: "2px 0 0", fontSize: "12px", opacity: 0.8 }}>
                      <Phone style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
                      {tenant.phone}
                    </p>
                  )}
                  {tenant?.website && (
                    <p style={{ margin: "2px 0 0", fontSize: "12px", opacity: 0.8 }}>
                      <Globe style={{ width: "11px", height: "11px", display: "inline", marginRight: "4px" }} />
                      {tenant.website}
                    </p>
                  )}
                </div>
              </div>

              {/* Doc type + number */}
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    letterSpacing: "2px",
                    opacity: 0.95,
                    lineHeight: 1,
                  }}
                >
                  {docLabel}
                </div>
                <div
                  style={{
                    marginTop: "10px",
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    display: "inline-block",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "11px", opacity: 0.7, letterSpacing: "0.5px" }}>DOCUMENT NO.</p>
                  <p style={{ margin: "2px 0 0", fontSize: "15px", fontWeight: 700, letterSpacing: "1px" }}>{invoiceNo}</p>
                </div>
                {/* Status badge */}
                <div style={{ marginTop: "10px" }}>
                  <span
                    style={{
                      background: status.bg,
                      color: status.color,
                      border: `1px solid ${status.color}30`,
                      borderRadius: "20px",
                      padding: "4px 14px",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <StatusIcon style={{ width: "12px", height: "12px" }} />
                    {status.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ META ROW ══ */}
          <div
            style={{
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              padding: "16px 40px",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
            }}
          >
            {[
              { icon: Calendar, label: "Issue Date", value: fmtDate(invoice.issuedDate || invoice.createdAt) },
              { icon: Calendar, label: "Due Date", value: fmtDate(invoice.dueDate) },
              { icon: User,     label: "Client",   value: invoice.clientName || "—" },
              { icon: Hash,     label: "Booking",  value: invoice.bookingTitle || invoice.bookingId?.slice(0, 8) || "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Icon style={{ width: "11px", height: "11px" }} />
                  {label.toUpperCase()}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* ══ BODY ══ */}
          <div style={{ padding: "28px 40px" }}>

            {/* ── Financial Summary ── */}
            <div style={{ marginBottom: "28px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "13px", fontWeight: 700, color: "#475569", letterSpacing: "0.5px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                <CreditCard style={{ width: "14px", height: "14px" }} /> Financial Summary
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#1e3a5f", color: "white" }}>
                    {["Description", "Amount"].map((h, i) => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: "12px", fontWeight: 600, textAlign: i === 0 ? "left" : "right", letterSpacing: "0.3px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 14px", fontSize: "13px", color: "#374151" }}>
                      {invoice.bookingTitle || "Travel Service"}{invoice.notes ? <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "8px" }}>— {invoice.notes}</span> : null}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: "13px", textAlign: "right", color: "#374151" }}>{fmt(invoice.subTotal ?? invoice.totalAmount, currency)}</td>
                  </tr>
                  {(invoice.taxAmount ?? 0) > 0 && (
                    <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                      <td style={{ padding: "10px 14px", fontSize: "13px", color: "#6b7280" }}>Tax / VAT {invoice.taxRate ? `(${invoice.taxRate}%)` : ""}</td>
                      <td style={{ padding: "10px 14px", fontSize: "13px", textAlign: "right", color: "#6b7280" }}>{fmt(invoice.taxAmount!, currency)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>Invoice Total</td>
                    <td style={{ padding: "12px 14px", fontSize: "14px", fontWeight: 700, color: "#1e293b", textAlign: "right" }}>{fmt(invoice.totalAmount, currency)}</td>
                  </tr>
                  <tr style={{ background: "#dcfce7" }}>
                    <td style={{ padding: "10px 14px", fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>Amount Paid</td>
                    <td style={{ padding: "10px 14px", fontSize: "13px", fontWeight: 700, color: "#16a34a", textAlign: "right" }}>{fmt(totalPaid, currency)}</td>
                  </tr>
                  <tr style={{ background: balance > 0 ? "#fef2f2" : "#f0fdf4" }}>
                    <td style={{ padding: "12px 14px", fontSize: "15px", fontWeight: 800, color: balance > 0 ? "#dc2626" : "#16a34a" }}>Balance Due</td>
                    <td style={{ padding: "12px 14px", fontSize: "15px", fontWeight: 800, color: balance > 0 ? "#dc2626" : "#16a34a", textAlign: "right" }}>{fmt(Math.abs(balance), currency)}{balance < 0 ? " (Credit)" : ""}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── Payment History (show for receipt/statement or if payments exist) ── */}
            {(docType !== "invoice" || payments.length > 0) && (
              <div style={{ marginBottom: "28px" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: "13px", fontWeight: 700, color: "#475569", letterSpacing: "0.5px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 style={{ width: "14px", height: "14px" }} /> Payment History
                </h3>
                {payments.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#94a3b8", padding: "14px", background: "#f8fafc", borderRadius: "8px", margin: 0 }}>No payments recorded.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#475569", color: "white" }}>
                        {["Date", "Method", "Reference", "Received By", "Amount"].map((h, i) => (
                          <th key={h} style={{ padding: "9px 12px", fontSize: "11px", fontWeight: 600, textAlign: i === 4 ? "right" : "left", letterSpacing: "0.3px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, idx) => (
                        <tr key={p.id} style={{ background: idx % 2 === 0 ? "white" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "9px 12px", fontSize: "12px", color: "#374151" }}>{fmtDate(p.date)}</td>
                          <td style={{ padding: "9px 12px", fontSize: "12px", color: "#374151" }}>
                            <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: "4px", padding: "2px 7px", fontSize: "11px", fontWeight: 600 }}>
                              {METHOD_LABELS[p.method] || p.method}
                            </span>
                          </td>
                          <td style={{ padding: "9px 12px", fontSize: "12px", color: "#6b7280", fontFamily: "monospace" }}>{p.transactionRef || "—"}</td>
                          <td style={{ padding: "9px 12px", fontSize: "12px", color: "#6b7280" }}>{(p as any).receivedByName || "—"}</td>
                          <td style={{ padding: "9px 12px", fontSize: "13px", fontWeight: 700, color: "#16a34a", textAlign: "right" }}>{fmt(p.amount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#dcfce7" }}>
                        <td colSpan={4} style={{ padding: "10px 12px", fontSize: "13px", fontWeight: 700, color: "#15803d" }}>Total Received</td>
                        <td style={{ padding: "10px 12px", fontSize: "14px", fontWeight: 800, color: "#15803d", textAlign: "right" }}>{fmt(totalPaid, currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {/* ── Statement summary (only for statement doc type) ── */}
            {docType === "statement" && (
              <div style={{ marginBottom: "28px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "20px 24px" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: "13px", fontWeight: 700, color: "#1d4ed8", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Account Summary
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  {[
                    { label: "Total Invoiced", value: fmt(invoice.totalAmount, currency), color: "#374151" },
                    { label: "Total Paid",     value: fmt(totalPaid, currency),           color: "#16a34a" },
                    { label: "Balance Due",    value: fmt(Math.abs(balance), currency),   color: balance > 0 ? "#dc2626" : "#16a34a" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "11px", color: "#64748b", letterSpacing: "0.5px" }}>{label.toUpperCase()}</p>
                      <p style={{ margin: "6px 0 0", fontSize: "20px", fontWeight: 800, color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Notes ── */}
            {invoice.notes && docType === "invoice" && (
              <div style={{ marginBottom: "20px", padding: "14px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#92400e", fontWeight: 700, letterSpacing: "0.5px" }}>NOTES</p>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#78350f" }}>{invoice.notes}</p>
              </div>
            )}

            {/* ── Balance due notice ── */}
            {balance > 0 && docType !== "receipt" && (
              <div style={{ marginBottom: "20px", padding: "14px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertTriangle style={{ width: "18px", height: "18px", color: "#dc2626", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "13px", color: "#991b1b" }}>
                  <strong>Balance of {fmt(balance, currency)} is due</strong>{invoice.dueDate ? ` by ${fmtDate(invoice.dueDate)}` : ""}.
                  Please contact us if you have any questions.
                </p>
              </div>
            )}
          </div>

          {/* ══ FOOTER ══ */}
          <div
            style={{
              marginTop: "auto",
              background: "#1e3a5f",
              color: "white",
              padding: "18px 40px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>{tenant?.name}</p>
              <p style={{ margin: "3px 0 0", fontSize: "11px", opacity: 0.7 }}>
                {[tenant?.phone, tenant?.website].filter(Boolean).join("  •  ")}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "11px", opacity: 0.6 }}>
                This is a computer-generated document and does not require a physical signature.
              </p>
              <p style={{ margin: "3px 0 0", fontSize: "11px", opacity: 0.5 }}>
                Generated: {new Date().toLocaleString("en-BD")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Print styles injected ── */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { margin: 0; background: white; }
        }
      `}</style>
    </div>
  );
};

export default InvoiceReceipt;
