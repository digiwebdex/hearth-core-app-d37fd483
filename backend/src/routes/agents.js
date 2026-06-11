const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

const ACTIVE_BOOKING_WHERE = { status: { not: "cancelled" } };

const AGENT_INCLUDE = { commissionProfile: true };

function clampRate(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function normalizeStatus(value) {
  const s = String(value || "active").trim().toLowerCase();
  return s === "inactive" ? "inactive" : "active";
}

function flattenAgent(agent, aggregates = {}) {
  const profile = agent.commissionProfile;
  return {
    id: agent.id,
    name: agent.name,
    phone: agent.phone,
    email: agent.email,
    tenantId: agent.tenantId,
    createdAt: agent.createdAt,
    commissionRate: profile?.commissionRate ?? 0,
    status: profile?.status ?? "active",
    userId: profile?.userId ?? null,
    updatedAt: profile?.updatedAt ?? agent.createdAt,
    totalBookings: aggregates.totalBookings ?? 0,
    totalRevenue: aggregates.totalRevenue ?? 0,
    pendingCommission: aggregates.pendingCommission ?? 0,
    paidCommission: aggregates.paidCommission ?? 0,
  };
}

async function getAgentListAggregates(tenantId, agentIds) {
  const empty = () => ({
    totalBookings: 0,
    totalRevenue: 0,
    pendingCommission: 0,
    paidCommission: 0,
  });

  if (!agentIds.length) return new Map();

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId,
      agentId: { in: agentIds },
      ...ACTIVE_BOOKING_WHERE,
    },
    select: {
      agentId: true,
      amount: true,
      agentCommission: {
        select: { agentCommissionAmount: true, agentCommissionStatus: true },
      },
    },
  });

  const map = new Map(agentIds.map((id) => [id, empty()]));
  for (const booking of bookings) {
    if (!booking.agentId) continue;
    const row = map.get(booking.agentId);
    if (!row) continue;
    row.totalBookings += 1;
    row.totalRevenue += booking.amount || 0;
    const commission = booking.agentCommission?.agentCommissionAmount || 0;
    if (booking.agentCommission?.agentCommissionStatus === "paid") {
      row.paidCommission += commission;
    } else if (booking.agentCommission?.agentCommissionStatus === "pending") {
      row.pendingCommission += commission;
    }
  }
  return map;
}

async function getTenantAgent(agentId, tenantId) {
  return prisma.agent.findFirst({
    where: { id: agentId, tenantId },
    include: AGENT_INCLUDE,
  });
}

async function assertAgentAccess(req, agent) {
  if (!agent) return false;
  if (req.userRole === "sales_agent") {
    return agent.commissionProfile?.userId === req.userId;
  }
  return true;
}

async function resolveUserId(userId, tenantId) {
  if (userId === null || userId === undefined || userId === "") return null;
  const user = await prisma.user.findFirst({
    where: { id: String(userId), tenantId },
    select: { id: true },
  });
  if (!user) throw new Error("Linked user not found in this organization");
  return user.id;
}

async function upsertAgentProfile(agentId, profileData) {
  const { commissionRate, status, userId } = profileData;
  return prisma.agentCommissionProfile.upsert({
    where: { agentId },
    create: {
      agentId,
      commissionRate: clampRate(commissionRate),
      status: normalizeStatus(status),
      userId: userId ?? null,
    },
    update: {
      ...(commissionRate !== undefined ? { commissionRate: clampRate(commissionRate) } : {}),
      ...(status !== undefined ? { status: normalizeStatus(status) } : {}),
      ...(userId !== undefined ? { userId } : {}),
    },
  });
}

router.get("/", requirePermission("agents", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.userRole === "sales_agent") {
      where.commissionProfile = { userId: req.userId };
    }

    const statusFilter = String(req.query.status || "all").toLowerCase();
    if (statusFilter === "active" || statusFilter === "inactive") {
      where.commissionProfile = {
        ...(where.commissionProfile || {}),
        status: statusFilter,
      };
    }

    const search = String(req.query.search || "").trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const agents = await prisma.agent.findMany({
      where,
      include: AGENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    const aggregates = await getAgentListAggregates(
      req.tenantId,
      agents.map((a) => a.id),
    );

    res.json(agents.map((agent) => flattenAgent(agent, aggregates.get(agent.id))));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/me", requirePermission("agents", "view"), async (req, res) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: { tenantId: req.tenantId, commissionProfile: { userId: req.userId } },
      include: AGENT_INCLUDE,
    });
    if (!agent) return res.json(null);
    const aggregates = await getAgentListAggregates(req.tenantId, [agent.id]);
    res.json(flattenAgent(agent, aggregates.get(agent.id)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/summary", requirePermission("agents", "view"), async (req, res) => {
  try {
    const agent = await getTenantAgent(req.params.id, req.tenantId);
    if (!agent) return res.status(404).json({ message: "Not found" });
    if (!(await assertAgentAccess(req, agent))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const bookingWhere = {
      tenantId: req.tenantId,
      agentId: agent.id,
      ...ACTIVE_BOOKING_WHERE,
    };

    const bookings = await prisma.booking.findMany({
      where: { tenantId: req.tenantId, agentId: agent.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        amount: true,
        status: true,
        travelDateFrom: true,
        client: { select: { name: true } },
        agentCommission: {
          select: { agentCommissionAmount: true, agentCommissionStatus: true },
        },
      },
    });

    const activeBookings = await prisma.booking.findMany({
      where: bookingWhere,
      select: {
        amount: true,
        agentCommission: {
          select: { agentCommissionAmount: true, agentCommissionStatus: true },
        },
      },
    });

    let totalBookings = 0;
    let totalRevenue = 0;
    let pendingCommission = 0;
    let paidCommission = 0;

    for (const b of activeBookings) {
      totalBookings += 1;
      totalRevenue += b.amount || 0;
      const commission = b.agentCommission?.agentCommissionAmount || 0;
      if (b.agentCommission?.agentCommissionStatus === "paid") {
        paidCommission += commission;
      } else if (b.agentCommission?.agentCommissionStatus === "pending") {
        pendingCommission += commission;
      }
    }

    res.json({
      agent: flattenAgent(agent),
      totalBookings,
      totalRevenue,
      pendingCommission,
      paidCommission,
      recentBookings: bookings.map((b) => ({
        id: b.id,
        title: b.title,
        amount: b.amount,
        status: b.status,
        travelDateFrom: b.travelDateFrom,
        clientName: b.client?.name || "",
        agentCommissionAmount: b.agentCommission?.agentCommissionAmount ?? null,
        agentCommissionStatus: b.agentCommission?.agentCommissionStatus ?? null,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("agents", "view"), async (req, res) => {
  try {
    const agent = await getTenantAgent(req.params.id, req.tenantId);
    if (!agent) return res.status(404).json({ message: "Not found" });
    if (!(await assertAgentAccess(req, agent))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const aggregates = await getAgentListAggregates(req.tenantId, [agent.id]);
    res.json(flattenAgent(agent, aggregates.get(agent.id)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("agents", "create"), async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Name is required" });

    const userId = await resolveUserId(req.body.userId, req.tenantId).catch((e) => {
      throw e;
    });

    const agent = await prisma.agent.create({
      data: {
        name,
        phone: String(req.body.phone || ""),
        email: String(req.body.email || ""),
        tenantId: req.tenantId,
        commissionProfile: {
          create: {
            commissionRate: clampRate(req.body.commissionRate),
            status: normalizeStatus(req.body.status),
            userId,
          },
        },
      },
      include: AGENT_INCLUDE,
    });

    res.status(201).json(flattenAgent(agent));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("agents", "edit"), async (req, res) => {
  try {
    const existing = await getTenantAgent(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const agentUpdate = {};
    if (req.body.name !== undefined) agentUpdate.name = String(req.body.name).trim();
    if (req.body.phone !== undefined) agentUpdate.phone = String(req.body.phone);
    if (req.body.email !== undefined) agentUpdate.email = String(req.body.email);

    if (Object.keys(agentUpdate).length) {
      await prisma.agent.update({ where: { id: req.params.id }, data: agentUpdate });
    }

    const profilePatch = {};
    if (req.body.commissionRate !== undefined) {
      profilePatch.commissionRate = clampRate(req.body.commissionRate);
    }
    if (req.body.status !== undefined) {
      profilePatch.status = normalizeStatus(req.body.status);
    }
    if (req.body.userId !== undefined) {
      profilePatch.userId = await resolveUserId(req.body.userId, req.tenantId);
    }

    if (Object.keys(profilePatch).length) {
      await upsertAgentProfile(req.params.id, profilePatch);
    }

    const updated = await getTenantAgent(req.params.id, req.tenantId);
    const aggregates = await getAgentListAggregates(req.tenantId, [req.params.id]);
    res.json(flattenAgent(updated, aggregates.get(req.params.id)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("agents", "delete"), async (req, res) => {
  try {
    const existing = await getTenantAgent(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const bookingCount = await prisma.booking.count({
      where: { tenantId: req.tenantId, agentId: req.params.id },
    });
    if (bookingCount > 0) {
      return res.status(409).json({
        message: "Agent has bookings. Set status to inactive instead.",
        code: "AGENT_HAS_BOOKINGS",
      });
    }

    await prisma.agent.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
