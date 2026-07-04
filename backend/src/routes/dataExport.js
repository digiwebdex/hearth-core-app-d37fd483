const router = require("express").Router();
const { authenticate, requireRole } = require("../middleware/auth");
const { prisma } = require("../middleware/auth");
const { execFile } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

router.use(authenticate);

// ── helpers ──────────────────────────────────────────────────────────────────

function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? "" : String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function dateRange(from, to) {
  if (!from && !to) return null;
  const gte = from ? new Date(from) : undefined;
  const lte = to ? (() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d; })() : undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

// ── Daily CSV export ──────────────────────────────────────────────────────────

router.get("/csv", async (req, res) => {
  const { from, to } = req.query;
  const tenantId = req.tenantId;
  const range = dateRange(from, to);
  const createdAt = range || undefined;

  try {
    const [clients, bookings, invoices, payments, leads] = await Promise.all([
      prisma.client.findMany({
        where: { tenantId, ...(createdAt ? { createdAt } : {}) },
        select: { name: true, phone: true, email: true, nationality: true, clientType: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.booking.findMany({
        where: { tenantId, ...(createdAt ? { createdAt } : {}) },
        select: { id: true, title: true, serviceType: true, type: true, status: true, destination: true, amount: true, cost: true, profit: true, paidAmount: true, dueAmount: true, travelDateFrom: true, travelerCount: true, supplierName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { tenantId, ...(createdAt ? { createdAt } : {}) },
        select: { invoiceNumber: true, bookingTitle: true, clientName: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.findMany({
        where: { tenantId, ...(createdAt ? { createdAt } : {}) },
        select: { amount: true, method: true, notes: true, transactionRef: true, date: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.lead.findMany({
        where: { tenantId, ...(createdAt ? { createdAt } : {}) },
        select: { name: true, phone: true, email: true, status: true, destination: true, budget: true, source: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const sections = [
      { title: "CLIENTS", rows: clients },
      { title: "BOOKINGS", rows: bookings },
      { title: "INVOICES", rows: invoices },
      { title: "PAYMENTS", rows: payments },
      { title: "LEADS", rows: leads },
    ];

    const label = from && to ? `${from}_to_${to}` : from ? `from_${from}` : "all";
    const csvParts = sections
      .filter((s) => s.rows.length)
      .map((s) => `### ${s.title} (${s.rows.length} records)\n${toCSV(s.rows)}`);

    const csv = csvParts.join("\n\n");
    const filename = `hearth_export_${label}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Full Excel workbook export — Summary dashboard + one sheet per menu ────────
// "All info": every module the tenant has, with every field, is included.

const BRAND = "FFE8890C";
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
const d10 = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const MONEY_FMT = "#,##0";
const isMoneyKey = (k) => /(amount|cost|profit|price|balance|budget|salary|selling|grandtotal|payable|receivable|paid|due|credit|fare)/i.test(k) && !/count|score|rate/i.test(k);
const titleize = (k) => k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const cellVal = (v) => (v instanceof Date ? d10(v) : v && typeof v === "object" ? JSON.stringify(v) : v);

// Build one sheet from raw rows, including every scalar field (JSON stringified).
function fullSheet(wb, name, rows, maps = {}) {
  if (!rows || !rows.length) return 0;
  const enriched = rows.map((r) => {
    const o = { ...r };
    if (maps.users && o.assignedTo) o.assignedToName = maps.users[o.assignedTo] || "";
    if (maps.users && o.receivedBy) o.receivedByName = maps.users[o.receivedBy] || "";
    if (maps.clients && o.clientId && !o.clientName) o.clientName = maps.clients[o.clientId] || "";
    return o;
  });
  const drop = new Set(["tenantId", "updatedAt"]);
  const keys = [...new Set(enriched.flatMap((r) => Object.keys(r)))].filter((k) => !drop.has(k));
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = keys.map((k) => ({ header: titleize(k), key: k, width: Math.min(32, Math.max(12, titleize(k).length + 2)) }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = HEADER_FILL; head.height = 20;
  for (const r of enriched) ws.addRow(keys.reduce((a, k) => { a[k] = cellVal(r[k]); return a; }, {}));
  keys.forEach((k, i) => { if (isMoneyKey(k)) ws.getColumn(i + 1).numFmt = MONEY_FMT; });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
  return rows.length;
}

const EXPORT_MODULES = [
  ["Clients", "client"], ["Client Family", "clientFamilyMember"], ["Wallet Ledger", "walletTransaction"],
  ["Leads", "lead"], ["Vendors", "vendor"], ["Vendor Bills", "vendorBill"],
  ["Agents", "agent"], ["Agent Ledger", "agentTransaction"], ["Visa Stock", "visaStock"],
  ["Quotations", "quotation"], ["Bookings", "booking"],
  ["Invoices", "invoice"], ["Invoice Installments", "invoiceInstallment"], ["Payments", "payment"],
  ["Expenses", "expense"], ["Ledger", "transaction"], ["Accounts", "account"], ["Tasks", "task"],
  ["Complaints", "complaint"], ["Campaigns", "campaign"], ["Travel Packages", "travelPackage"],
  ["Hajj Packages", "hajjPackage"], ["Hajj Groups", "hajjGroup"], ["Hajj Pilgrims", "hajjPilgrim"],
  ["Group Tours", "groupTour"], ["MICE Events", "miceEvent"], ["Visa Applications", "visaApplication"],
  ["Support Tickets", "supportTicket"], ["Loyalty Accounts", "loyaltyAccount"],
  ["Loyalty Ledger", "loyaltyTransaction"], ["Referrals", "referralCode"], ["Staff Profiles", "staffProfile"],
];

router.get("/workbook", async (req, res) => {
  const tenantId = req.tenantId;
  const range = dateRange(req.query.from, req.query.to);
  const createdAt = range || undefined;

  async function grab(model) {
    try { return await prisma[model].findMany({ where: { tenantId, ...(createdAt ? { createdAt } : {}) }, orderBy: { createdAt: "desc" } }); }
    catch {
      // Retry without the date filter; if the model can't be tenant-scoped, skip it
      // entirely — never fall back to an unscoped query (would leak other tenants).
      try { return await prisma[model].findMany({ where: { tenantId } }); }
      catch { return []; }
    }
  }

  try {
    const ExcelJS = require("exceljs");
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true, name: true } });
    const clientsAll = await prisma.client.findMany({ where: { tenantId }, select: { id: true, name: true } });
    const maps = {
      users: Object.fromEntries(users.map((u) => [u.id, u.name])),
      clients: Object.fromEntries(clientsAll.map((c) => [c.id, c.name])),
    };

    const data = {};
    for (const [, model] of EXPORT_MODULES) data[model] = await grab(model);
    const D = (m) => data[m] || [];
    const sum = (m, k) => D(m).reduce((s, x) => s + (Number(x[k]) || 0), 0);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TravelAgencyWeb";

    // ── Sheet 1: Summary (dashboard) ──
    const s = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
    s.columns = [{ width: 36 }, { width: 20 }];
    const title = s.addRow([`${tenant?.name || "Agency"} — Full Data Export`]);
    title.font = { bold: true, size: 16, color: { argb: BRAND } };
    s.mergeCells("A1:B1");
    const meta = s.addRow([`Exported ${d10(new Date())}${req.query.from || req.query.to ? `  ·  Range ${req.query.from || "…"} to ${req.query.to || "…"}` : "  ·  All time"}`]);
    meta.font = { color: { argb: "FF888880" }, size: 10 };
    s.mergeCells("A2:B2");
    s.addRow([]);
    const section = (label) => { const r = s.addRow([label]); r.font = { bold: true, color: { argb: "FFFFFFFF" } }; r.fill = HEADER_FILL; s.mergeCells(`A${r.number}:B${r.number}`); };
    const metric = (label, value, isMoney) => { const r = s.addRow([label, value]); if (isMoney) r.getCell(2).numFmt = MONEY_FMT; r.getCell(2).alignment = { horizontal: "right" }; };

    section("Sales & operations");
    metric("Total clients", D("client").length);
    metric("Total leads", D("lead").length);
    metric("Total quotations", D("quotation").length);
    metric("Total bookings", D("booking").length);
    metric("Confirmed bookings", D("booking").filter((b) => b.status === "confirmed").length);
    metric("Total sales value", sum("booking", "amount"), true);
    metric("Total profit", sum("booking", "profit"), true);
    s.addRow([]);
    section("Money");
    metric("Total invoiced", sum("invoice", "totalAmount"), true);
    metric("Total collected", sum("payment", "amount"), true);
    metric("Outstanding due", sum("invoice", "dueAmount"), true);
    metric("Total expenses", sum("expense", "amount"), true);
    metric("Net (collected − expenses)", sum("payment", "amount") - sum("expense", "amount"), true);
    s.addRow([]);
    section("Catalog & operations");
    metric("Travel packages", D("travelPackage").length);
    metric("Hajj pilgrims", D("hajjPilgrim").length);
    metric("Group tours", D("groupTour").length);
    metric("MICE events", D("miceEvent").length);
    metric("Visa applications", D("visaApplication").length);
    metric("Visa stock — in stock", D("visaStock").filter((v) => v.status === "available" || v.status === "processing").length);
    metric("Visa stock — sold profit", D("visaStock").filter((v) => v.status === "sold" || v.status === "completed").reduce((sum2, v) => sum2 + (Number(v.profit) || 0), 0), true);
    metric("Support tickets", D("supportTicket").length);
    s.addRow([]);
    section("Contacts & CRM");
    metric("Vendors / suppliers", D("vendor").length);
    metric("Agents", D("agent").length);
    metric("Tasks", D("task").length);
    metric("Complaints", D("complaint").length);
    metric("Campaigns", D("campaign").length);

    // ── One sheet per module (only those with data) ──
    const included = [];
    for (const [name, model] of EXPORT_MODULES) {
      if (fullSheet(wb, name, data[model], maps)) included.push(`${name} (${data[model].length})`);
    }
    s.addRow([]);
    section("Sheets in this file");
    for (const line of included) s.addRow([line]);

    const label = req.query.from && req.query.to ? `${req.query.from}_to_${req.query.to}` : "all";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="hearth_full_export_${label}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Full DB backup (tenant_owner only, pg_dump) ───────────────────────────────

router.post("/db-backup", requireRole("tenant_owner", "super_admin"), async (req, res) => {
  // Parse connection from DATABASE_URL
  const url = process.env.DATABASE_URL || "";
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) return res.status(500).json({ message: "Cannot parse DATABASE_URL" });

  const [, user, password, host, port, dbname] = match;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `hearth_backup_${timestamp}.sql`;
  const tmpFile = path.join(os.tmpdir(), filename);

  const env = { ...process.env, PGPASSWORD: password };

  execFile(
    "pg_dump",
    ["-h", host, "-p", port, "-U", user, "-F", "p", "--no-owner", "--no-acl", "-f", tmpFile, dbname],
    { env, timeout: 120000 },
    (err) => {
      if (err) {
        console.error("[DB-BACKUP] pg_dump error:", err.message);
        return res.status(500).json({ message: "pg_dump failed: " + err.message });
      }
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      const stream = fs.createReadStream(tmpFile);
      stream.pipe(res);
      stream.on("end", () => fs.unlink(tmpFile, () => {}));
      stream.on("error", () => res.end());
    }
  );
});

// ── Backup status / last-backup info ─────────────────────────────────────────

router.get("/backup-info", requireRole("tenant_owner", "super_admin"), (_req, res) => {
  const backupDir = "/var/backups/hearth-core";
  fs.readdir(backupDir, (err, files) => {
    if (err) return res.json({ lastBackup: null, count: 0 });
    const dumps = files.filter((f) => f.endsWith(".dump") || f.endsWith(".sql")).sort();
    const last = dumps[dumps.length - 1] || null;
    res.json({ lastBackup: last, count: dumps.length, dir: backupDir });
  });
});

module.exports = router;
