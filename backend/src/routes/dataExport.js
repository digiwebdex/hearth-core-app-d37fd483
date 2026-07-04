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

// ── Full Excel workbook export (Summary dashboard + one sheet per module) ─────

const BRAND = "FFE8890C";
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
const d10 = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const money = "#,##0";

function addDataSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16 }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = HEADER_FILL;
  head.alignment = { vertical: "middle" };
  head.height = 20;
  for (const r of rows) ws.addRow(r);
  columns.forEach((c, i) => { if (c.money) ws.getColumn(i + 1).numFmt = money; });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return rows.length;
}

router.get("/workbook", async (req, res) => {
  const tenantId = req.tenantId;
  const range = dateRange(req.query.from, req.query.to);
  const createdAt = range || undefined;
  const w = createdAt ? { tenantId, createdAt } : { tenantId };

  try {
    const ExcelJS = require("exceljs");
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });

    const [clients, leads, vendors, agents, quotations, bookings, invoices, payments, expenses, transactions, tasks, complaints, campaigns, users] = await Promise.all([
      prisma.client.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.lead.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.vendor.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.agent.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.quotation.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.booking.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.invoice.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.payment.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.expense.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.transaction.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.task.findMany({ where: w, orderBy: { createdAt: "desc" } }),
      prisma.complaint.findMany({ where: w, orderBy: { createdAt: "desc" } }).catch(() => []),
      prisma.campaign.findMany({ where: w, orderBy: { createdAt: "desc" } }).catch(() => []),
      prisma.user.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);

    const userName = (id) => users.find((u) => u.id === id)?.name || "";
    const clientName = (id) => clients.find((c) => c.id === id)?.name || "";
    const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TravelAgencyWeb";

    // ── Sheet 1: Summary (dashboard) ──
    const s = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
    s.columns = [{ width: 34 }, { width: 20 }];
    const title = s.addRow([`${tenant?.name || "Agency"} — Data Export`]);
    title.font = { bold: true, size: 16, color: { argb: BRAND } };
    s.mergeCells("A1:B1");
    const meta = s.addRow([`Exported ${d10(new Date())}${req.query.from || req.query.to ? `  ·  Range: ${req.query.from || "…"} to ${req.query.to || "…"}` : "  ·  All time"}`]);
    meta.font = { color: { argb: "FF888880" }, size: 10 };
    s.mergeCells("A2:B2");
    s.addRow([]);
    const section = (label) => { const r = s.addRow([label]); r.font = { bold: true, color: { argb: "FFFFFFFF" } }; r.fill = HEADER_FILL; s.mergeCells(`A${r.number}:B${r.number}`); };
    const metric = (label, value, isMoney) => { const r = s.addRow([label, value]); if (isMoney) r.getCell(2).numFmt = money; r.getCell(2).alignment = { horizontal: "right" }; };

    section("Sales & operations");
    metric("Total clients", clients.length);
    metric("Total leads", leads.length);
    metric("Total quotations", quotations.length);
    metric("Total bookings", bookings.length);
    metric("Confirmed bookings", bookings.filter((b) => b.status === "confirmed").length);
    metric("Total sales value", sum(bookings, "amount"), true);
    metric("Total profit", sum(bookings, "profit"), true);
    s.addRow([]);
    section("Money");
    metric("Total invoiced", sum(invoices, "totalAmount"), true);
    metric("Total collected", sum(payments, "amount"), true);
    metric("Outstanding due", sum(invoices, "dueAmount"), true);
    metric("Total expenses", sum(expenses, "amount"), true);
    metric("Net (collected − expenses)", sum(payments, "amount") - sum(expenses, "amount"), true);
    s.addRow([]);
    section("Contacts & CRM");
    metric("Vendors / suppliers", vendors.length);
    metric("Agents", agents.length);
    metric("Tasks", tasks.length);
    metric("Complaints", complaints.length);
    metric("Campaigns", campaigns.length);

    // ── Module sheets ──
    addDataSheet(wb, "Clients", [
      { header: "Name", key: "name", width: 22 }, { header: "Phone", key: "phone" }, { header: "Email", key: "email", width: 24 },
      { header: "Type", key: "clientType" }, { header: "Company", key: "companyName", width: 20 }, { header: "Nationality", key: "nationality" },
      { header: "Passport", key: "passportNumber" }, { header: "Passport expiry", key: "passportExpiry" }, { header: "Wallet balance", key: "walletBalance", money: true },
      { header: "Created", key: "created" },
    ], clients.map((c) => ({ ...c, created: d10(c.createdAt) })));

    addDataSheet(wb, "Leads", [
      { header: "Name", key: "name", width: 22 }, { header: "Phone", key: "phone" }, { header: "Email", key: "email", width: 22 },
      { header: "Status", key: "status" }, { header: "Source", key: "source" }, { header: "Destination", key: "destination", width: 18 },
      { header: "Budget", key: "budget", money: true }, { header: "Score", key: "score" }, { header: "Assigned to", key: "assignedToName", width: 18 },
      { header: "Next follow-up", key: "nextFollowUp" }, { header: "Created", key: "created" },
    ], leads.map((l) => ({ ...l, assignedToName: userName(l.assignedTo), created: d10(l.createdAt) })));

    addDataSheet(wb, "Vendors", [
      { header: "Name", key: "name", width: 24 }, { header: "Category", key: "category" }, { header: "Phone", key: "phone" },
      { header: "Email", key: "email", width: 24 }, { header: "Status", key: "status" }, { header: "Created", key: "created" },
    ], vendors.map((v) => ({ ...v, created: d10(v.createdAt) })));

    addDataSheet(wb, "Agents", [
      { header: "Name", key: "name", width: 22 }, { header: "Phone", key: "phone" }, { header: "Email", key: "email", width: 24 }, { header: "Created", key: "created" },
    ], agents.map((a) => ({ ...a, created: d10(a.createdAt) })));

    addDataSheet(wb, "Quotations", [
      { header: "Title", key: "title", width: 26 }, { header: "Client", key: "clientNm", width: 20 }, { header: "Destination", key: "destination", width: 18 },
      { header: "Status", key: "status" }, { header: "Travelers", key: "travelerCount" }, { header: "Selling", key: "totalSelling", money: true },
      { header: "Cost", key: "totalCost", money: true }, { header: "Profit", key: "totalProfit", money: true }, { header: "Grand total", key: "grandTotal", money: true },
      { header: "Valid until", key: "validUntil" }, { header: "Created", key: "created" },
    ], quotations.map((q) => ({ ...q, clientNm: clientName(q.clientId), created: d10(q.createdAt) })));

    addDataSheet(wb, "Bookings", [
      { header: "Title", key: "title", width: 26 }, { header: "Client", key: "clientNm", width: 20 }, { header: "Type", key: "type" },
      { header: "Service", key: "serviceType", width: 16 }, { header: "Status", key: "status" }, { header: "Destination", key: "destination", width: 18 },
      { header: "Travelers", key: "travelerCount" }, { header: "Amount", key: "amount", money: true }, { header: "Cost", key: "cost", money: true },
      { header: "Profit", key: "profit", money: true }, { header: "Paid", key: "paidAmount", money: true }, { header: "Due", key: "dueAmount", money: true },
      { header: "Payment", key: "paymentStatus" }, { header: "Travel from", key: "travelDateFrom" }, { header: "Travel to", key: "travelDateTo" }, { header: "Created", key: "created" },
    ], bookings.map((b) => ({ ...b, clientNm: clientName(b.clientId), created: d10(b.createdAt) })));

    addDataSheet(wb, "Invoices", [
      { header: "Invoice #", key: "invoiceNumber" }, { header: "Client", key: "clientName", width: 20 }, { header: "Booking", key: "bookingTitle", width: 24 },
      { header: "Total", key: "totalAmount", money: true }, { header: "Paid", key: "paidAmount", money: true }, { header: "Due", key: "dueAmount", money: true },
      { header: "Status", key: "status" }, { header: "Issued", key: "issuedDate" }, { header: "Due date", key: "dueDate" }, { header: "Created", key: "created" },
    ], invoices.map((i) => ({ ...i, created: d10(i.createdAt) })));

    addDataSheet(wb, "Payments", [
      { header: "Amount", key: "amount", money: true }, { header: "Method", key: "method" }, { header: "Reference", key: "transactionRef", width: 18 },
      { header: "Date", key: "date" }, { header: "Note", key: "notes", width: 26 }, { header: "Created", key: "created" },
    ], payments.map((p) => ({ ...p, created: d10(p.createdAt) })));

    addDataSheet(wb, "Expenses", [
      { header: "Category", key: "category" }, { header: "Description", key: "description", width: 28 }, { header: "Amount", key: "amount", money: true },
      { header: "Method", key: "paymentMethod" }, { header: "Date", key: "date" }, { header: "Created", key: "created" },
    ], expenses.map((e) => ({ ...e, created: d10(e.createdAt) })));

    addDataSheet(wb, "Ledger", [
      { header: "Type", key: "type" }, { header: "Category", key: "category" }, { header: "Description", key: "description", width: 28 },
      { header: "Amount", key: "amount", money: true }, { header: "Method", key: "paymentMethod" }, { header: "Date", key: "date" }, { header: "Created", key: "created" },
    ], transactions.map((t) => ({ ...t, created: d10(t.createdAt) })));

    addDataSheet(wb, "Tasks", [
      { header: "Title", key: "title", width: 30 }, { header: "Status", key: "status" }, { header: "Priority", key: "priority" },
      { header: "Due date", key: "dueDate" }, { header: "Assigned to", key: "assignedToName", width: 18 }, { header: "Created", key: "created" },
    ], tasks.map((t) => ({ ...t, assignedToName: userName(t.assignedTo), created: d10(t.createdAt) })));

    addDataSheet(wb, "Complaints", [
      { header: "Subject", key: "subject", width: 30 }, { header: "Customer", key: "clientName", width: 20 }, { header: "Category", key: "category" },
      { header: "Priority", key: "priority" }, { header: "Status", key: "status" }, { header: "Rating", key: "rating" }, { header: "Created", key: "created" },
    ], complaints.map((c) => ({ ...c, created: d10(c.createdAt) })));

    addDataSheet(wb, "Campaigns", [
      { header: "Name", key: "name", width: 26 }, { header: "Channel", key: "channel" }, { header: "Audience", key: "audienceType" },
      { header: "Status", key: "status" }, { header: "Recipients", key: "recipientCount" }, { header: "Sent", key: "sentCount" }, { header: "Created", key: "created" },
    ], campaigns.map((c) => ({ ...c, created: d10(c.createdAt) })));

    const label = req.query.from && req.query.to ? `${req.query.from}_to_${req.query.to}` : "all";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="hearth_export_${label}.xlsx"`);
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
