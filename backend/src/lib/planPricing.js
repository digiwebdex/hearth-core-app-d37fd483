const yearly = (monthly) => (monthly <= 0 ? monthly : monthly * 10);

const PLAN_PRICES = {
  basic: { monthly: 500, yearly: yearly(500) },
  pro: { monthly: 800, yearly: yearly(800) },
  business: { monthly: 1500, yearly: yearly(1500) },
  enterprise: { monthly: -1, yearly: -1 },
  free: { monthly: 0, yearly: 0 },
};

function normalizePlan(plan) {
  return String(plan || "free").trim().toLowerCase();
}

function normalizeBillingCycle(cycle) {
  return String(cycle || "monthly").trim().toLowerCase() === "yearly" ? "yearly" : "monthly";
}

function getPlanPrice(planId, billingCycle = "monthly") {
  const plan = normalizePlan(planId);
  const cycle = normalizeBillingCycle(billingCycle);
  const row = PLAN_PRICES[plan] || PLAN_PRICES.free;
  const price = cycle === "yearly" ? row.yearly : row.monthly;
  return price < 0 ? 0 : price;
}

module.exports = { getPlanPrice, normalizePlan, normalizeBillingCycle };
