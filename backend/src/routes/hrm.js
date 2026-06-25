const router = require("express").Router();
const { authenticate, requirePermission, requireRole, prisma } = require("../middleware/auth");

router.use(authenticate);

const MANAGER_ROLES = new Set(["super_admin", "tenant_owner", "owner", "manager"]);
const ATTENDANCE_STATUSES = new Set(["present", "absent", "half_day", "remote", "on_leave"]);
const LEAVE_TYPES = new Set(["annual", "sick", "unpaid", "other"]);
const LEAVE_STATUSES = new Set(["pending", "approved", "rejected"]);

function isManager(role) {
  return MANAGER_ROLES.has(role);
}

async function enrichUsers(users) {
  const ids = users.map((u) => u.id);
  const profiles = await prisma.staffProfile.findMany({
    where: { userId: { in: ids } },
  });
  const profileMap = Object.fromEntries(profiles.map((p) => [p.userId, p]));
  return users.map((u) => ({
    ...u,
    profile: profileMap[u.id] || null,
  }));
}

router.get("/profiles", requirePermission("team", "view"), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId, status: { not: "rejected" } },
      select: { id: true, name: true, email: true, role: true, phone: true, status: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(await enrichUsers(users));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/profiles/:userId", requirePermission("team", "edit"), async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.tenantId },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const data = {
      jobTitle: req.body.jobTitle ? String(req.body.jobTitle).trim() : null,
      department: req.body.department ? String(req.body.department).trim() : null,
      joinDate: req.body.joinDate ? String(req.body.joinDate).trim() : null,
      emergencyContact: req.body.emergencyContact ? String(req.body.emergencyContact).trim() : null,
      emergencyPhone: req.body.emergencyPhone ? String(req.body.emergencyPhone).trim() : null,
      notes: req.body.notes ? String(req.body.notes).trim() : null,
    };

    const profile = await prisma.staffProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tenantId: req.tenantId, ...data },
      update: data,
    });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/attendance", requirePermission("team", "view"), async (req, res) => {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const where = { tenantId: req.tenantId, date };
    if (req.query.userId) where.userId = String(req.query.userId);

    const rows = await prisma.staffAttendance.findMany({ where, orderBy: { createdAt: "asc" } });
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json(rows.map((r) => ({ ...r, userName: userMap[r.userId]?.name || "" })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/attendance", requirePermission("team", "edit"), async (req, res) => {
  try {
    const userId = String(req.body.userId || req.userId);
    const date = String(req.body.date || new Date().toISOString().slice(0, 10));
    const status = ATTENDANCE_STATUSES.has(req.body.status) ? req.body.status : "present";

    if (userId !== req.userId && !isManager(req.userRole)) {
      return res.status(403).json({ message: "Only managers can mark attendance for others" });
    }

    const user = await prisma.user.findFirst({ where: { id: userId, tenantId: req.tenantId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const row = await prisma.staffAttendance.upsert({
      where: { tenantId_userId_date: { tenantId: req.tenantId, userId, date } },
      create: {
        tenantId: req.tenantId,
        userId,
        date,
        status,
        checkIn: req.body.checkIn || null,
        checkOut: req.body.checkOut || null,
        notes: req.body.notes ? String(req.body.notes).trim() : null,
        markedBy: req.userId,
      },
      update: {
        status,
        checkIn: req.body.checkIn !== undefined ? req.body.checkIn || null : undefined,
        checkOut: req.body.checkOut !== undefined ? req.body.checkOut || null : undefined,
        notes: req.body.notes !== undefined ? String(req.body.notes || "").trim() || null : undefined,
        markedBy: req.userId,
      },
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/leave", requirePermission("team", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status);
    if (!isManager(req.userRole)) where.userId = req.userId;

    const rows = await prisma.staffLeaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(rows.flatMap((r) => [r.userId, r.reviewedBy].filter(Boolean)))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    res.json(
      rows.map((r) => ({
        ...r,
        userName: userMap[r.userId] || "",
        reviewerName: r.reviewedBy ? userMap[r.reviewedBy] || "" : "",
      })),
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/leave", requirePermission("team", "create"), async (req, res) => {
  try {
    const startDate = String(req.body.startDate || "").trim();
    const endDate = String(req.body.endDate || "").trim();
    if (!startDate || !endDate) return res.status(400).json({ message: "Start and end dates are required" });

    const leaveType = LEAVE_TYPES.has(req.body.leaveType) ? req.body.leaveType : "annual";
    const userId = isManager(req.userRole) && req.body.userId ? String(req.body.userId) : req.userId;

    const row = await prisma.staffLeaveRequest.create({
      data: {
        tenantId: req.tenantId,
        userId,
        leaveType,
        startDate,
        endDate,
        reason: String(req.body.reason || "").trim(),
        status: "pending",
      },
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/leave/:id/review", requireRole("tenant_owner", "manager", "owner"), async (req, res) => {
  try {
    const status = LEAVE_STATUSES.has(req.body.status) ? req.body.status : null;
    if (!status || status === "pending") {
      return res.status(400).json({ message: "status must be approved or rejected" });
    }

    const existing = await prisma.staffLeaveRequest.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const row = await prisma.staffLeaveRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedBy: req.userId,
        reviewedAt: new Date(),
        reviewNotes: req.body.reviewNotes ? String(req.body.reviewNotes).trim() : null,
      },
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
