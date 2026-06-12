const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

async function getTenantTravelPackage(packageId, tenantId) {
  if (!packageId) return null;
  return prisma.travelPackage.findFirst({
    where: { id: packageId, tenantId },
    include: {
      days: { orderBy: { dayNumber: "asc" } },
      inclusions: { orderBy: { sortOrder: "asc" } },
      pricing: { orderBy: { travelerMin: "asc" } },
    },
  });
}

function mapServiceTypeToItemType(serviceType) {
  switch (String(serviceType || "").toLowerCase()) {
    case "visa":
      return "visa";
    case "air_ticket":
      return "ticket";
    case "hotel":
      return "hotel";
    case "transport":
      return "transport";
    default:
      return "tour";
  }
}

function buildItineraryFromPackage(days = []) {
  return days.map((day) => ({
    dayNumber: day.dayNumber,
    title: day.title,
    description: day.description || "",
    activities: [],
  }));
}

function buildQuotationItemsFromPackage(pkg, travelerCount = 1) {
  const qty = Math.max(1, Number(travelerCount || 1));
  const pricingRow = Array.isArray(pkg.pricing) && pkg.pricing.length ? pkg.pricing[0] : null;
  const sellingPrice = Number(pricingRow?.price ?? pkg.basePrice ?? 0);
  const costPrice = Math.round(sellingPrice * 0.85 * 100) / 100;
  const markupPercent = costPrice > 0 ? Math.round(((sellingPrice - costPrice) / costPrice) * 100) : 15;

  return [
    {
      id: crypto.randomUUID(),
      type: mapServiceTypeToItemType(pkg.serviceType),
      description: pkg.title,
      quantity: qty,
      nights: pkg.serviceType === "hotel" ? Math.max(1, Number(pkg.durationNights || 1)) : 1,
      costPrice,
      markupPercent,
      sellingPrice,
      subtotal: sellingPrice * qty,
    },
  ];
}

function sumQuotationTotals(items = []) {
  const lineItems = items.filter((i) => i.type !== "discount" && i.type !== "tax");
  const discounts = items.filter((i) => i.type === "discount");
  const taxes = items.filter((i) => i.type === "tax");
  const totalCost = lineItems.reduce(
    (sum, item) => sum + Number(item.costPrice || 0) * Number(item.quantity || 1) * (item.type === "hotel" ? Number(item.nights || 1) : 1),
    0,
  );
  const totalSelling = lineItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const discountAmount = discounts.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const taxAmount = taxes.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const grandTotal = totalSelling - discountAmount + taxAmount;
  const totalProfit = totalSelling - totalCost;
  return { totalCost, totalSelling, totalProfit, discountAmount, taxAmount, grandTotal };
}

async function enrichQuotationFromPackage(body, tenantId) {
  if (!body?.packageId) return body;

  const pkg = await getTenantTravelPackage(body.packageId, tenantId);
  if (!pkg) throw new Error("Travel package not found for this tenant");

  const travelerCount = Math.max(1, Number(body.travelerCount || 1));
  const hasItems = Array.isArray(body.items) && body.items.length > 0;
  const hasItinerary = Array.isArray(body.itinerary) && body.itinerary.length > 0;
  const items = hasItems ? body.items : buildQuotationItemsFromPackage(pkg, travelerCount);
  const itinerary = hasItinerary ? body.itinerary : buildItineraryFromPackage(pkg.days);
  const totals = sumQuotationTotals(items);

  return {
    ...body,
    title: body.title || pkg.title,
    serviceType: body.serviceType || pkg.serviceType,
    packageTitleSnapshot: body.packageTitleSnapshot || pkg.title,
    packageCodeSnapshot: body.packageCodeSnapshot || pkg.code,
    destination: body.destination || pkg.destination || pkg.country || "TBD",
    travelerCount,
    items,
    itinerary,
    termsAndConditions: body.termsAndConditions || pkg.cancellationPolicy || body.termsAndConditions,
    totalCost: body.totalCost ?? totals.totalCost,
    totalSelling: body.totalSelling ?? totals.totalSelling,
    totalProfit: body.totalProfit ?? totals.totalProfit,
    discountAmount: body.discountAmount ?? totals.discountAmount,
    taxAmount: body.taxAmount ?? totals.taxAmount,
    grandTotal: body.grandTotal ?? totals.grandTotal,
  };
}

async function enrichBookingFromPackage(body, tenantId) {
  if (!body?.packageId) return body;

  const pkg = await getTenantTravelPackage(body.packageId, tenantId);
  if (!pkg) throw new Error("Travel package not found for this tenant");

  const amount = body.amount !== undefined ? Number(body.amount) : Number(pkg.basePrice || 0);
  const cost = body.cost !== undefined ? Number(body.cost) : Math.round(amount * 0.85 * 100) / 100;

  return {
    ...body,
    title: body.title || pkg.title,
    serviceType: body.serviceType || pkg.serviceType,
    packageTitleSnapshot: body.packageTitleSnapshot || pkg.title,
    packageCodeSnapshot: body.packageCodeSnapshot || pkg.code,
    destination: body.destination || pkg.destination || pkg.country || body.destination,
    amount,
    cost,
    profit: body.profit !== undefined ? Number(body.profit) : amount - cost,
  };
}

module.exports = {
  enrichQuotationFromPackage,
  enrichBookingFromPackage,
  getTenantTravelPackage,
};
