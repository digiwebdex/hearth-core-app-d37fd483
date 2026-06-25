const { prisma } = require("../middleware/auth");
const { getPlanPrice, normalizePlan, normalizeBillingCycle } = require("../lib/planPricing");

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function computeDiscount(originalAmount, coupon) {
  const original = Number(originalAmount) || 0;
  if (!coupon || original <= 0) return 0;
  if (coupon.discountType === "fixed") {
    return Math.min(Number(coupon.discountValue) || 0, original);
  }
  const pct = Math.min(100, Math.max(0, Number(coupon.discountValue) || 0));
  return Math.round((original * pct) / 100);
}

async function findActiveCoupon(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const coupon = await prisma.subscriptionCoupon.findFirst({
    where: { code: normalized, isActive: true },
  });
  if (!coupon) return null;

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) return null;
  if (coupon.validUntil && coupon.validUntil < now) return null;
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return null;
  return coupon;
}

async function validateSubscriptionCoupon({ code, plan, billingCycle }) {
  const coupon = await findActiveCoupon(code);
  if (!coupon) {
    return { valid: false, message: "Invalid or expired coupon code" };
  }

  const requestedPlan = normalizePlan(plan);
  const plans = coupon.applicablePlans || [];
  if (plans.length && !plans.map(normalizePlan).includes(requestedPlan)) {
    return { valid: false, message: "Coupon does not apply to this plan" };
  }

  const originalAmount = getPlanPrice(requestedPlan, billingCycle);
  if (originalAmount <= 0) {
    return { valid: false, message: "This plan has no payable amount" };
  }

  const discountAmount = computeDiscount(originalAmount, coupon);
  const finalAmount = Math.max(0, originalAmount - discountAmount);

  return {
    valid: true,
    code: coupon.code,
    couponId: coupon.id,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    originalAmount,
    discountAmount,
    finalAmount,
    description: coupon.description || null,
  };
}

async function applyCouponToPaymentRequest(couponCode, plan, billingCycle) {
  if (!couponCode) return null;
  const result = await validateSubscriptionCoupon({ code: couponCode, plan, billingCycle });
  if (!result.valid) throw new Error(result.message || "Invalid coupon");
  return result;
}

async function incrementCouponUsage(couponCode) {
  const normalized = normalizeCode(couponCode);
  if (!normalized) return;
  await prisma.subscriptionCoupon.updateMany({
    where: { code: normalized },
    data: { usedCount: { increment: 1 } },
  }).catch(() => {});
}

module.exports = {
  validateSubscriptionCoupon,
  applyCouponToPaymentRequest,
  incrementCouponUsage,
  computeDiscount,
};
