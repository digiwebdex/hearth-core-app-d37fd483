/**
 * Payment Gateway Service — shared logic for SSLCommerz + bKash + COD
 * Handles payment initiation, validation, status updates, and linkage
 */
const { prisma } = require("../middleware/auth");
const { notifyEvent } = require("./notificationService");

const FRONTEND_URL = process.env.FRONTEND_URL || "https://travelagencyweb.com";

function normalizeCycle(value) {
  return String(value || "monthly").trim().toLowerCase() === "yearly" ? "yearly" : "monthly";
}

function addMonths(value, months) {
  const date = new Date(value);
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

async function ensureLedgerTransaction({ payment, invoice, gateway, amount, tenantId }) {
  const existing = await prisma.transaction.findFirst({
    where: { tenantId, referenceType: "payment", referenceId: payment.id },
  });

  if (existing) return existing;

  return prisma.transaction.create({
    data: {
      type: "income",
      category: "online_payment",
      description: `Online payment via ${gateway} for ${invoice.invoiceNumber || invoice.id}`,
      amount,
      referenceId: payment.id,
      referenceType: "payment",
      invoiceId: invoice.id,
      bookingId: invoice.bookingId || null,
      paymentMethod: gateway,
      status: "completed",
      date: payment.date,
      tenantId,
    },
  }).catch((e) => {
    console.error("Auto-transaction error:", e.message);
    return null;
  });
}

async function updateInvoiceAndBooking(invoiceId, tenantId) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ...(tenantId ? { tenantId } : {}) },
    include: {
      payments: true,
      client: { select: { id: true, name: true, email: true, phone: true } },
      booking: { select: { id: true, title: true, destination: true } },
    },
  });
  if (!invoice) return null;

  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const invoiceStatus = paid >= invoice.totalAmount ? "paid" : paid > 0 ? "partial" : "unpaid";
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paidAmount: paid, dueAmount: invoice.totalAmount - paid, status: invoiceStatus },
    include: {
      payments: true,
      client: { select: { id: true, name: true, email: true, phone: true } },
      booking: { select: { id: true, title: true, destination: true } },
    },
  });

  if (updatedInvoice.bookingId) {
    const bookingInvoices = await prisma.invoice.findMany({ where: { bookingId: updatedInvoice.bookingId, tenantId: updatedInvoice.tenantId } });
    const bookingPaid = bookingInvoices.reduce((sum, current) => sum + current.paidAmount, 0);
    const bookingTotal = bookingInvoices.reduce((sum, current) => sum + current.totalAmount, 0);
    await prisma.booking.update({
      where: { id: updatedInvoice.bookingId },
      data: {
        paidAmount: bookingPaid,
        dueAmount: bookingTotal - bookingPaid,
        paymentStatus: bookingPaid >= bookingTotal ? "paid" : bookingPaid > 0 ? "partial" : "unpaid",
      },
    }).catch((e) => console.error("[PAYMENT-GATEWAY] Booking payment sync error:", e.message));
  }

  return updatedInvoice;
}

async function activateSubscriptionFromPaymentRequest(paymentRequestId) {
  if (!paymentRequestId) return { subscriptionUpdated: false };

  const paymentRequest = await prisma.paymentRequest.findUnique({ where: { id: paymentRequestId } });
  if (!paymentRequest) return { subscriptionUpdated: false };

  const tenant = await prisma.tenant.findUnique({ where: { id: paymentRequest.tenantId } });
  if (!tenant) return { subscriptionUpdated: false };

  const requestedPlan = String(paymentRequest.requestedPlan || paymentRequest.plan || tenant.subscriptionPlan || "basic").trim().toLowerCase();
  const billingCycle = normalizeCycle(paymentRequest.billingCycle);
  const months = billingCycle === "yearly" ? 12 : 1;
  const now = new Date();
  const currentExpiry = tenant.subscriptionExpiry ? new Date(tenant.subscriptionExpiry) : null;
  const requestType = String(paymentRequest.requestType || "").trim().toLowerCase();
  const extendFromCurrentExpiry = requestType === "renew" && currentExpiry && currentExpiry > now;
  const startDate = extendFromCurrentExpiry ? currentExpiry : now;
  const expiryDate = addMonths(startDate, months);

  if (paymentRequest.status !== "approved") {
    await prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { status: "approved", processedAt: new Date(), reviewedAt: new Date(), trxId: paymentRequest.trxId || paymentRequest.transactionId || null },
    }).catch((e) => console.error("[PAYMENT-GATEWAY] Payment request update error:", e.message));
  }

  await prisma.tenant.update({
    where: { id: paymentRequest.tenantId },
    data: {
      subscriptionPlan: requestedPlan,
      subscriptionStatus: "active",
      subscriptionExpiry: expiryDate,
    },
  });

  if (prisma.subscription) {
    await prisma.subscription.create({
      data: {
        tenantId: paymentRequest.tenantId,
        plan: requestedPlan,
        startDate: startDate.toISOString(),
        endDate: expiryDate.toISOString(),
        status: "active",
        billingCycle,
        source: "payment_gateway",
        paymentRequestId,
        note: `Activated automatically from payment request ${paymentRequestId}`,
      },
    }).catch(() => {});
  }

  if (prisma.subscriptionHistory) {
    await prisma.subscriptionHistory.create({
      data: {
        tenantId: paymentRequest.tenantId,
        paymentRequestId,
        oldPlan: tenant.subscriptionPlan,
        newPlan: requestedPlan,
        oldStatus: tenant.subscriptionStatus,
        newStatus: "active",
        billingCycle,
        activationDate: startDate,
        expiryDate,
        actionType: requestType === "renew" ? "renewed" : requestType === "upgrade" ? "upgraded" : "activated",
        source: "payment_gateway",
        note: `Payment request approved automatically by payment gateway (${paymentRequest.method || paymentRequest.paymentMethod || "online"})`,
        actorUserId: "system",
      },
    }).catch(() => {});
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId: paymentRequest.tenantId, role: "tenant_owner" },
    select: { email: true, phone: true, name: true },
  }).catch(() => null);

  await notifyEvent("subscription_activated", {
    ownerEmail: owner?.email || null,
    ownerPhone: owner?.phone || null,
    ownerName: owner?.name || null,
    plan: requestedPlan,
    expiryDate: expiryDate.toISOString().slice(0, 10),
  }).catch(() => {});

  return { subscriptionUpdated: true, tenantId: paymentRequest.tenantId, plan: requestedPlan, expiryDate };
}

/**
 * After a successful payment, update invoice + booking + optionally subscription
 */
async function handlePaymentSuccess({ transactionId, invoiceId, paymentRequestId, amount, method, gateway, tenantId, metadata }) {
  const result = { invoiceUpdated: false, bookingUpdated: false, subscriptionUpdated: false, paymentCreated: false };

  // 1. If linked to an invoice — record payment + update invoice/booking (idempotent)
  if (invoiceId) {
    try {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, ...(tenantId ? { tenantId } : {}) },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          booking: { select: { id: true, title: true, destination: true } },
        },
      });

      if (invoice) {
        let payment = await prisma.payment.findFirst({
          where: { tenantId: invoice.tenantId, invoiceId: invoice.id, transactionRef: transactionId },
        });

        if (!payment) {
          payment = await prisma.payment.create({
            data: {
              invoiceId: invoice.id,
              bookingId: metadata?.bookingId || invoice.bookingId,
              amount,
              method: gateway || method || "online",
              transactionRef: transactionId,
              date: new Date().toISOString().slice(0, 10),
              notes: `Online payment via ${gateway || method}`,
              tenantId: invoice.tenantId,
            },
          });
          result.paymentCreated = true;
        }

        const refreshedInvoice = await updateInvoiceAndBooking(invoice.id, invoice.tenantId);
        if (refreshedInvoice) {
          result.invoiceUpdated = true;
          result.bookingUpdated = !!refreshedInvoice.bookingId;
          await ensureLedgerTransaction({ payment, invoice: refreshedInvoice, gateway: gateway || method || "online", amount, tenantId: invoice.tenantId });
          await notifyEvent("payment_received", {
            clientName: refreshedInvoice.client?.name || refreshedInvoice.clientName || "Client",
            clientPhone: refreshedInvoice.client?.phone || null,
            clientEmail: refreshedInvoice.client?.email || null,
            invoice: refreshedInvoice,
            invoiceNumber: refreshedInvoice.invoiceNumber || refreshedInvoice.id,
            amount: payment.amount,
            dueAmount: refreshedInvoice.dueAmount,
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("[PAYMENT-GATEWAY] Invoice payment error:", e.message);
    }
  }

  // 2. If linked to a payment request (subscription payment)
  if (paymentRequestId) {
    try {
      const subscriptionResult = await activateSubscriptionFromPaymentRequest(paymentRequestId);
      result.subscriptionUpdated = subscriptionResult.subscriptionUpdated;
    } catch (e) {
      console.error("[PAYMENT-GATEWAY] Subscription update error:", e.message);
    }
  }

  return result;
}

/**
 * Create audit log for payment gateway event
 */
async function auditPaymentEvent({ action, gateway, transactionId, amount, invoiceId, paymentRequestId, tenantId, metadata }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: "system",
        actorName: `${gateway} Gateway`,
        actorEmail: `${gateway}@gateway.system`,
        actorRole: "system",
        tenantId: tenantId || null,
        tenantName: null,
        module: "payment_gateway",
        action,
        targetType: invoiceId ? "invoice" : paymentRequestId ? "payment_request" : "payment",
        targetId: invoiceId || paymentRequestId || transactionId,
        targetLabel: transactionId,
        newValue: JSON.stringify({ gateway, amount, transactionId, ...metadata }),
      },
    });
  } catch (e) {
    console.error("[AUDIT] Payment gateway audit error:", e.message);
  }
}

/**
 * Get callback URLs for payment gateways
 */
function getCallbackUrls(gateway) {
  const apiBase = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}/api`;
  return {
    success: `${apiBase}/payments/${gateway}/success`,
    fail: `${apiBase}/payments/${gateway}/fail`,
    cancel: `${apiBase}/payments/${gateway}/cancel`,
    ipn: `${apiBase}/payments/${gateway}/ipn`,
    frontendCallback: `${FRONTEND_URL}/payment/callback`,
  };
}

module.exports = {
  handlePaymentSuccess,
  auditPaymentEvent,
  getCallbackUrls,
};