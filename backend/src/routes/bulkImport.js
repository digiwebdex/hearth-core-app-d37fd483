const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

function parseFloat2(v) {
  const n = parseFloat(String(v || "").replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = [];
    let cur = "", inQ = false;
    for (const ch of lines[i] + ",") {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    if (cells.every(c => !c)) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] || ""; });
    rows.push(obj);
  }
  return { headers, rows };
}

function normaliseKey(obj, ...keys) {
  for (const k of keys) {
    const found = Object.keys(obj).find(h => h.toLowerCase().replace(/[^a-z0-9]/g, "") === k.replace(/[^a-z0-9]/g, ""));
    if (found && obj[found]) return obj[found];
  }
  return "";
}

// POST /api/bulk-import/preview — parse CSV, return preview rows (no DB writes)
router.post("/preview", requirePermission("clients", "view"), async (req, res) => {
  try {
    const { csvText, type } = req.body;
    if (!csvText) return res.status(400).json({ message: "csvText required" });
    const { headers, rows } = parseCsv(csvText);
    if (!rows.length) return res.status(400).json({ message: "No data rows found" });

    if (type === "clients") {
      const preview = rows.slice(0, 5).map(r => ({
        name: normaliseKey(r, "name", "fullname", "clientname"),
        phone: normaliseKey(r, "phone", "mobile", "contact"),
        email: normaliseKey(r, "email", "emailaddress"),
        passportNumber: normaliseKey(r, "passport", "passportnumber", "passportno"),
        nationality: normaliseKey(r, "nationality", "country"),
        address: normaliseKey(r, "address"),
      }));
      return res.json({ headers, totalRows: rows.length, preview, type });
    }

    if (type === "bookings") {
      const preview = rows.slice(0, 5).map(r => ({
        title: normaliseKey(r, "title", "booking", "description", "service"),
        clientName: normaliseKey(r, "clientname", "client", "passenger", "name"),
        destination: normaliseKey(r, "destination", "route", "to"),
        travelDateFrom: normaliseKey(r, "traveldatefrom", "departuredate", "traveldate", "from"),
        supplierRef: normaliseKey(r, "pnr", "supplierref", "ticketnumber", "reference"),
        amount: normaliseKey(r, "amount", "fare", "price", "total"),
        serviceType: normaliseKey(r, "servicetype", "type", "category"),
      }));
      return res.json({ headers, totalRows: rows.length, preview, type });
    }

    return res.status(400).json({ message: "type must be 'clients' or 'bookings'" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/bulk-import/clients — import clients from CSV
router.post("/clients", requirePermission("clients", "create"), async (req, res) => {
  try {
    const { csvText } = req.body;
    if (!csvText) return res.status(400).json({ message: "csvText required" });
    const { rows } = parseCsv(csvText);
    if (!rows.length) return res.status(400).json({ message: "No data rows" });

    const created = [];
    const failed = [];

    for (const r of rows) {
      const name = normaliseKey(r, "name", "fullname", "clientname").trim();
      if (!name) { failed.push({ row: r, reason: "Name is required" }); continue; }
      try {
        const client = await prisma.client.create({
          data: {
            tenantId: req.tenantId,
            name,
            phone: normaliseKey(r, "phone", "mobile", "contact") || "",
            email: normaliseKey(r, "email", "emailaddress") || "",
            passportNumber: normaliseKey(r, "passport", "passportnumber", "passportno") || null,
            nationality: normaliseKey(r, "nationality", "country") || null,
            address: normaliseKey(r, "address") || null,
            notes: normaliseKey(r, "notes", "note", "remarks") || null,
          },
        });
        created.push(client.id);
      } catch (e) {
        failed.push({ row: r, reason: e.message });
      }
    }

    res.json({ created: created.length, failed: failed.length, failedRows: failed.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/bulk-import/bookings — import bookings from CSV
router.post("/bookings", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const { csvText } = req.body;
    if (!csvText) return res.status(400).json({ message: "csvText required" });
    const { rows } = parseCsv(csvText);
    if (!rows.length) return res.status(400).json({ message: "No data rows" });

    const created = [];
    const failed = [];

    for (const r of rows) {
      const title = normaliseKey(r, "title", "booking", "description", "service").trim();
      if (!title) { failed.push({ row: r, reason: "Title/service is required" }); continue; }
      try {
        // Try to find existing client by name
        const clientName = normaliseKey(r, "clientname", "client", "passenger", "name").trim();
        let clientId = null;
        if (clientName) {
          const existing = await prisma.client.findFirst({
            where: { tenantId: req.tenantId, name: { contains: clientName, mode: "insensitive" } },
            select: { id: true },
          });
          if (existing) clientId = existing.id;
          else {
            // Create placeholder client
            const nc = await prisma.client.create({
              data: { tenantId: req.tenantId, name: clientName, phone: "", email: "" },
            });
            clientId = nc.id;
          }
        }
        if (!clientId) { failed.push({ row: r, reason: "Client name required" }); continue; }

        const amount = parseFloat2(normaliseKey(r, "amount", "fare", "price", "total")) || 0;
        const booking = await prisma.booking.create({
          data: {
            tenantId: req.tenantId,
            clientId,
            title,
            destination: normaliseKey(r, "destination", "route", "to") || null,
            travelDateFrom: normaliseKey(r, "traveldatefrom", "departuredate", "traveldate", "from") || null,
            travelDateTo: normaliseKey(r, "traveldateto", "returndate", "to") || null,
            supplierRef: normaliseKey(r, "pnr", "supplierref", "ticketnumber", "reference") || null,
            serviceType: normaliseKey(r, "servicetype", "type", "category") || null,
            amount,
            dueAmount: amount,
            status: "confirmed",
            type: "package",
          },
        });
        created.push(booking.id);
      } catch (e) {
        failed.push({ row: r, reason: e.message });
      }
    }

    res.json({ created: created.length, failed: failed.length, failedRows: failed.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
