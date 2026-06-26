const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

function parseFloat2(v) {
  const n = parseFloat(String(v || "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function cleanTicket(v) {
  return String(v || "").replace(/[^0-9]/g, "").trim();
}

// Parse BSP CSV text → array of row objects
// Accepts flexible headers: ticket, ticket_no, ticket number, TICKET NUMBER, etc.
function parseBspCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const raw = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"));

  function col(row, ...keys) {
    for (const k of keys) {
      const idx = raw.findIndex(h => h.includes(k));
      if (idx >= 0) return (row[idx] || "").trim();
    }
    return "";
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV fields
    const cells = [];
    let cur = "", inQ = false;
    for (const ch of lines[i] + ",") {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cells.every(c => !c.trim())) continue;

    rows.push({
      ticketNumber: col(cells, "ticket"),
      passengerName: col(cells, "passenger", "name", "pax"),
      airline: col(cells, "airline", "carrier", "al"),
      issuedDate: col(cells, "issued", "date", "issue"),
      fare: parseFloat2(col(cells, "fare", "base")),
      tax: parseFloat2(col(cells, "tax")),
      total: parseFloat2(col(cells, "total", "amount", "gross")),
      commission: parseFloat2(col(cells, "commission", "comm")),
      netRemit: parseFloat2(col(cells, "net", "remit", "nett")),
    });
  }
  return rows;
}

// GET /api/bsp-reconcile — list uploads
router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const uploads = await prisma.bspUpload.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(uploads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bsp-reconcile/:id — upload + records
router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const upload = await prisma.bspUpload.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { records: true },
    });
    if (!upload) return res.status(404).json({ message: "Not found" });
    res.json(upload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/bsp-reconcile — upload + parse + match
router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const { csvText, fileName, period } = req.body;
    if (!csvText) return res.status(400).json({ message: "csvText is required" });

    const rows = parseBspCsv(csvText);
    if (!rows.length) return res.status(400).json({ message: "No records found in CSV. Check column headers." });

    // Fetch all bookings for this tenant to match against
    const bookings = await prisma.booking.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, title: true, supplierRef: true, serviceDetails: true, segments: { select: { supplierRef: true } } },
    });

    // Also load ticket refunds/voids/reissues for cross-matching
    const tRefunds = await prisma.ticketRefund.findMany({ where: { tenantId: req.tenantId }, select: { id: true, ticketNumber: true, pnr: true, bookingId: true } });
    const tVoids = await prisma.ticketVoid.findMany({ where: { tenantId: req.tenantId }, select: { id: true, ticketNumber: true, pnr: true, bookingId: true } });
    const tReissues = await prisma.ticketReissue.findMany({ where: { tenantId: req.tenantId }, select: { id: true, ticketNumber: true, pnr: true, bookingId: true } });

    // Build lookup: ticket# → booking id
    const ticketIndex = {};
    for (const b of bookings) {
      if (b.supplierRef) ticketIndex[cleanTicket(b.supplierRef)] = { bookingId: b.id, pnr: b.supplierRef };
      for (const seg of b.segments || []) {
        if (seg.supplierRef) ticketIndex[cleanTicket(seg.supplierRef)] = { bookingId: b.id, pnr: seg.supplierRef };
      }
      // Try serviceDetails.pnr / ticketNumber
      try {
        const sd = typeof b.serviceDetails === "object" ? b.serviceDetails : JSON.parse(b.serviceDetails || "{}");
        if (sd?.pnr) ticketIndex[cleanTicket(sd.pnr)] = { bookingId: b.id, pnr: sd.pnr };
        if (sd?.ticketNumber) ticketIndex[cleanTicket(sd.ticketNumber)] = { bookingId: b.id, pnr: sd.ticketNumber };
      } catch {}
    }
    for (const r of [...tRefunds, ...tVoids, ...tReissues]) {
      if (r.ticketNumber) ticketIndex[cleanTicket(r.ticketNumber)] = { bookingId: r.bookingId, pnr: r.pnr };
      if (r.pnr) ticketIndex[cleanTicket(r.pnr)] = { bookingId: r.bookingId, pnr: r.pnr };
    }

    // Create upload record
    const upload = await prisma.bspUpload.create({
      data: {
        tenantId: req.tenantId,
        fileName: fileName || "bsp-upload.csv",
        period: period || null,
        totalRecords: rows.length,
        status: "processing",
        uploadedBy: req.user?.name || null,
      },
    });

    // Create records and match
    let matchedCount = 0;
    const recordData = rows.map(row => {
      const tkClean = cleanTicket(row.ticketNumber);
      const match = tkClean ? ticketIndex[tkClean] : null;
      if (match) matchedCount++;
      return {
        uploadId: upload.id,
        tenantId: req.tenantId,
        ticketNumber: row.ticketNumber || null,
        passengerName: row.passengerName || null,
        airline: row.airline || null,
        issuedDate: row.issuedDate || null,
        fare: row.fare,
        tax: row.tax,
        total: row.total || (row.fare + row.tax),
        commission: row.commission,
        netRemit: row.netRemit || (row.total - row.commission),
        matchedBookingId: match?.bookingId || null,
        matchedPnr: match?.pnr || null,
        matchStatus: match ? "matched" : "unmatched",
      };
    });

    await prisma.bspRecord.createMany({ data: recordData });
    await prisma.bspUpload.update({
      where: { id: upload.id },
      data: { matchedCount, unmatchedCount: rows.length - matchedCount, status: "done" },
    });

    const result = await prisma.bspUpload.findUnique({
      where: { id: upload.id },
      include: { records: { orderBy: { matchStatus: "asc" } } },
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/bsp-reconcile/:id
router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const result = await prisma.bspUpload.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
