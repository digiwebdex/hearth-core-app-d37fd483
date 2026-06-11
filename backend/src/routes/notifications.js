const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");

router.use(authenticate);
router.use("/automation", require("./notificationAutomation"));

function notificationVisibilityWhere(req) {
  return {
    tenantId: req.tenantId,
    OR: [{ userId: null }, { userId: req.userId }],
  };
}

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10)));
    const skip = (page - 1) * limit;
    const where = notificationVisibilityWhere(req);

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, read: false } }),
    ]);

    res.json({ items, total, page, limit, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { ...notificationVisibilityWhere(req), read: false },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { ...notificationVisibilityWhere(req), read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, ...notificationVisibilityWhere(req) },
      data: { read: true },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await prisma.notification.deleteMany({
      where: { id: req.params.id, ...notificationVisibilityWhere(req) },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
