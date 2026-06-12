const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const { dispatchTenantAutomation } = require("../services/tenantAutomationService");

router.use(authenticate);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

router.get("/reminders", requirePermission("invoices", "view"), async (req, res) => {
  try {
    const today = todayIso();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 7);
    const horizonIso = horizon.toISOString().slice(0, 10);

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: req.tenantId,
        status: { in: ["unpaid", "partial", "overdue"] },
      },
      orderBy: { dueDate: "asc" },
      take: 200,
    });

    const overdueInvoices = invoices.filter((inv) => inv.dueDate && inv.dueDate < today);
    const dueSoonInvoices = invoices.filter(
      (inv) => inv.dueDate && inv.dueDate >= today && inv.dueDate <= horizonIso,
    );

    const installments = await prisma.invoiceInstallment.findMany({
      where: {
        tenantId: req.tenantId,
        status: { in: ["pending", "partial"] },
        dueDate: { not: null },
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            clientName: true,
            bookingTitle: true,
            dueAmount: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 200,
    });

    const overdueInstallments = installments.filter((row) => row.dueDate < today);
    const dueSoonInstallments = installments.filter(
      (row) => row.dueDate >= today && row.dueDate <= horizonIso,
    );

    res.json({
      today,
      overdueInvoices,
      dueSoonInvoices,
      overdueInstallments,
      dueSoonInstallments,
      counts: {
        overdueInvoices: overdueInvoices.length,
        dueSoonInvoices: dueSoonInvoices.length,
        overdueInstallments: overdueInstallments.length,
        dueSoonInstallments: dueSoonInstallments.length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/reminders/:invoiceId/send", requirePermission("invoices", "edit"), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.invoiceId, tenantId: req.tenantId },
      include: { client: { select: { email: true, name: true, phone: true } } },
    });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const client = invoice.client;
    await dispatchTenantAutomation("invoice_reminder", {
      tenantId: req.tenantId,
      actorUserId: req.userId,
      payload: {
        relatedType: "invoice",
        relatedId: invoice.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueAmount: invoice.dueAmount,
        dueDate: invoice.dueDate,
        clientName: client?.name || invoice.clientName || "",
        clientEmail: client?.email || "",
        clientPhone: client?.phone || "",
      },
    }).catch((err) => console.error("[automation] invoice_reminder:", err.message));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
