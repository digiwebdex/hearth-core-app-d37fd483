const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

router.get("/", requirePermission("clients", "view"), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const [clientDocs, bookingDocs] = await Promise.all([
      prisma.clientDocument.findMany({
        where: { client: { tenantId } },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.bookingDocument.findMany({
        where: { booking: { tenantId } },
        include: {
          booking: {
            select: {
              id: true,
              title: true,
              packageTitleSnapshot: true,
              client: { select: { name: true } },
            },
          },
        },
        orderBy: { uploadedAt: "desc" },
      }),
    ]);

    const items = [
      ...clientDocs.map((doc) => ({
        id: doc.id,
        source: "client",
        sourceId: doc.clientId,
        sourceLabel: doc.client?.name || "Client",
        name: doc.name,
        type: doc.type,
        url: doc.url,
        uploadedAt: doc.uploadedAt,
      })),
      ...bookingDocs.map((doc) => ({
        id: doc.id,
        source: "booking",
        sourceId: doc.bookingId,
        sourceLabel:
          doc.booking?.title ||
          doc.booking?.packageTitleSnapshot ||
          doc.booking?.client?.name ||
          "Booking",
        name: doc.name,
        type: doc.type,
        url: doc.url,
        uploadedAt: doc.uploadedAt,
      })),
    ].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
