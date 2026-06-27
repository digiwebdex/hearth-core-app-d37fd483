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
