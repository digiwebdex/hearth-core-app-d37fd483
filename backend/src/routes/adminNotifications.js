const router = require("express").Router();
const { authenticate, requireSuperAdmin } = require("../middleware/auth");
const { mapToAdminDto, prisma } = require("../services/platformNotificationService");

router.use(authenticate);
router.use(requireSuperAdmin);

router.get("/", async (_req, res) => {
  try {
    const rows = await prisma.platformNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(rows.map(mapToAdminDto));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/unread-count", async (_req, res) => {
  try {
    const count = await prisma.platformNotification.count({ where: { read: false } });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/read-all", async (_req, res) => {
  try {
    await prisma.platformNotification.updateMany({ where: { read: false }, data: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const result = await prisma.platformNotification.updateMany({
      where: { id: req.params.id },
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
    const result = await prisma.platformNotification.deleteMany({ where: { id: req.params.id } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
