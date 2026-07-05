const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// GET /api/mice
router.get("/", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = { tenantId: req.tenantId };
    if (status) where.status = status;
    if (search) where.title = { contains: search, mode: "insensitive" };

    const events = await prisma.miceEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        _count: { select: { items: true } },
      },
    });
    res.json(events);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/mice
router.post("/", requirePermission("bookings", "create"), async (req, res) => {
  try {
    const { title, eventType, clientId, venue, city, country, startDate, endDate, pax, budget, status, notes } = req.body;
    if (!title) return res.status(400).json({ message: "title is required" });

    const event = await prisma.miceEvent.create({
      data: {
        tenantId: req.tenantId,
        title,
        eventType: eventType || "conference",
        clientId: clientId || null,
        venue: venue || null,
        city: city || null,
        country: country || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        pax: parseInt(pax) || 1,
        budget: parseFloat(budget) || 0,
        status: status || "inquiry",
        notes: notes || null,
        createdBy: req.userId,
      },
    });
    res.status(201).json(event);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/mice/:id
router.get("/:id", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const event = await prisma.miceEvent.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/mice/:id
router.patch("/:id", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const existing = await prisma.miceEvent.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const { title, eventType, clientId, venue, city, country, startDate, endDate, pax, budget, status, notes } = req.body;
    const updated = await prisma.miceEvent.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(eventType !== undefined && { eventType }),
        ...(clientId !== undefined && { clientId: clientId || null }),
        ...(venue !== undefined && { venue }),
        ...(city !== undefined && { city }),
        ...(country !== undefined && { country }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(pax !== undefined && { pax: parseInt(pax) }),
        ...(budget !== undefined && { budget: parseFloat(budget) }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
      },
    });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/mice/:id
router.delete("/:id", requirePermission("bookings", "delete"), async (req, res) => {
  try {
    const existing = await prisma.miceEvent.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await prisma.miceEvent.delete({ where: { id: req.params.id } });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/mice/:id/items
router.post("/:id/items", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const event = await prisma.miceEvent.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!event) return res.status(404).json({ message: "Event not found" });

    const { itemType, description, quantity, unitCost, vendorId, notes } = req.body;
    const qty = parseInt(quantity) || 1;
    const cost = parseFloat(unitCost) || 0;

    const item = await prisma.miceEventItem.create({
      data: {
        miceEventId: req.params.id,
        itemType: itemType || "venue",
        description: description || null,
        quantity: qty,
        unitCost: cost,
        totalCost: qty * cost,
        vendorId: vendorId || null,
        notes: notes || null,
      },
    });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/mice/:id/items/:itemId
router.patch("/:id/items/:itemId", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    // Scope to the tenant's event, then the item within it (prevents cross-tenant IDOR).
    const event = await prisma.miceEvent.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!event) return res.status(404).json({ message: "Event not found" });
    const existing = await prisma.miceEventItem.findFirst({ where: { id: req.params.itemId, miceEventId: event.id } });
    if (!existing) return res.status(404).json({ message: "Item not found" });

    const { itemType, description, quantity, unitCost, vendorId, notes } = req.body;
    const qty = quantity !== undefined ? parseInt(quantity) : undefined;
    const cost = unitCost !== undefined ? parseFloat(unitCost) : undefined;
    // Recompute totalCost from the EFFECTIVE values (fall back to the persisted value for
    // whichever field is not being changed) so a single-field update never zeroes the total.
    const effectiveQty = qty !== undefined ? qty : existing.quantity;
    const effectiveCost = cost !== undefined ? cost : existing.unitCost;

    const item = await prisma.miceEventItem.update({
      where: { id: existing.id },
      data: {
        ...(itemType !== undefined && { itemType }),
        ...(description !== undefined && { description }),
        ...(qty !== undefined && { quantity: qty }),
        ...(cost !== undefined && { unitCost: cost }),
        ...(qty !== undefined || cost !== undefined
          ? { totalCost: effectiveQty * effectiveCost }
          : {}),
        ...(vendorId !== undefined && { vendorId: vendorId || null }),
        ...(notes !== undefined && { notes }),
      },
    });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/mice/:id/items/:itemId
router.delete("/:id/items/:itemId", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    // Scope the delete to the tenant's event so items can't be removed cross-tenant.
    const event = await prisma.miceEvent.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!event) return res.status(404).json({ message: "Event not found" });
    const result = await prisma.miceEventItem.deleteMany({ where: { id: req.params.itemId, miceEventId: event.id } });
    if (!result.count) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
