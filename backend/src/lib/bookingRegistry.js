// Booking Registry — shared booking metadata layer, ahead of Booking Foundation
// (docs/v2-master/11-Architecture-Freeze.md §5 "Final Booking Engine",
// docs/v2-master/12-Implementation-Sequence.md Phase 3).
//
// This is metadata only. It does NOT perform booking operations, does NOT
// create bookings, and does NOT touch the Booking model or any database
// table — it only defines and resolves booking TYPES, ahead of the actual
// per-service booking desks (Air Ticket, Visa, Hotel, Tour, Hajj, ...),
// which are explicitly out of scope here. Existing routes (bookings.js,
// hajj.js, visa.js, inventory.js, groupTours.js, ...) are completely
// untouched.
//
// Composes, does not duplicate:
//   - backend/src/lib/statusEngine.js  — every statusFlow reference below
//     is a live getStatusSet() lookup, not a copy of its values.
//   - backend/src/lib/supplierEngine.js — requiredSupplierType values are
//     drawn from SUPPLIER_CATEGORIES (verified in tests, not just asserted).
//   - backend/src/constants/serviceTypes.js (the 14 canonical service
//     types) — every `serviceTypes` entry below is one of those 14 values,
//     never a new one.
//
// "Booking Category" is genuinely new metadata (there is no existing field
// by this name anywhere) — a purpose-built grouping for this registry,
// analogous to how Plan Engine added PLAN_NAMES where no backend source had
// display names. It is NOT the frontend's 14-category service catalog
// (src/lib/serviceCatalog.ts) — that structure is intentionally not ported
// here (see Hajj/Umrah note below for why one distinction from that catalog
// still had to be made).
//
// Hajj vs Umrah: the frontend's service catalog treats "Hajj & Umrah" as a
// single combined category with one legacy service type (hajj_umrah). This
// registry still defines them as two separate booking types, because the
// business asked for both — the two share the same service type and the
// same Status Engine sets, and are distinguished at the product level via
// HajjPackage.type ("hajj" | "umrah", verified directly in
// src/lib/hajjApi.ts), not a schema change.
//
// "Workflow" is the frozen Unified Leads Pipeline decision
// (docs/v2-master/11-Architecture-Freeze.md §0 item 4) — universal across
// every booking type, not type-specific.

const { getStatusSet } = require("./statusEngine");

const BOOKING_WORKFLOW_PIPELINE = ["lead", "inquiry", "quotation", "booking", "invoice", "payment", "delivery", "completed"];

const PAYMENT_FLOW_STATUS_SETS = { paymentStatusSetId: "paymentStatus", invoiceStatusSetId: "invoiceStatus" };

// ── Booking Type Registry ──
const BOOKING_TYPE_REGISTRY = {
  air_ticket: {
    label: "Air Ticket",
    serviceTypes: ["air_ticket"],
    bookingCategory: "ticketing",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "both" },
    requiredSupplierType: { allowed: ["airline"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: [] },
  },
  visa: {
    label: "Visa",
    serviceTypes: ["visa"],
    bookingCategory: "documentation",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "individual" },
    requiredSupplierType: { allowed: ["visa_partner"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: ["visaApplicationStatus"] },
  },
  hajj: {
    label: "Hajj",
    serviceTypes: ["hajj_umrah"],
    bookingCategory: "pilgrimage",
    packageTypeValue: "hajj",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "individual" },
    requiredSupplierType: { allowed: ["hotel", "transport", "visa_partner"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: ["hajjPackageStatus", "hajjPilgrimStatus", "hajjVisaStatus"] },
  },
  umrah: {
    label: "Umrah",
    serviceTypes: ["hajj_umrah"],
    bookingCategory: "pilgrimage",
    packageTypeValue: "umrah",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "individual" },
    requiredSupplierType: { allowed: ["hotel", "transport", "visa_partner"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: ["hajjPackageStatus", "hajjPilgrimStatus", "hajjVisaStatus"] },
    note: "Shares the hajj_umrah service type and the same Hajj status sets as Hajj — distinguished at the product level via HajjPackage.type ('hajj' | 'umrah'), not a separate service type.",
  },
  tour: {
    label: "Tour",
    serviceTypes: ["tour_domestic", "tour_international"],
    bookingCategory: "package_travel",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "both" },
    requiredSupplierType: { allowed: ["tour_operator", "hotel", "transport", "guide"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: ["tourStatus"] },
  },
  hotel: {
    label: "Hotel",
    serviceTypes: ["hotel"],
    bookingCategory: "accommodation",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "both" },
    requiredSupplierType: { allowed: ["hotel"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: ["hotelStatus"] },
  },
  transport: {
    label: "Transport",
    serviceTypes: ["transport"],
    bookingCategory: "ground_services",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "both" },
    requiredSupplierType: { allowed: ["transport"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: ["transportContractStatus"] },
  },
  insurance: {
    label: "Insurance",
    serviceTypes: ["custom"],
    bookingCategory: "protection",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "individual" },
    requiredSupplierType: { allowed: ["insurance"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: [] },
    note: "Maps to the generic 'custom' service type — travel insurance has no dedicated legacy service type; the frontend's Travel Insurance catalog category (src/lib/serviceCatalog.ts) is likewise mapped to 'custom'.",
  },
  student_consultancy: {
    label: "Student Consultancy",
    serviceTypes: ["study_abroad"],
    bookingCategory: "education",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "individual" },
    requiredSupplierType: { allowed: ["other"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: [] },
    note: "No dedicated supplier category exists for universities/education partners today — falls under Vendor.category 'other'.",
  },
  overseas_manpower: {
    label: "Overseas Manpower",
    serviceTypes: ["b2b_agent"],
    bookingCategory: "employment",
    requiredCustomerType: { allowed: ["individual", "corporate"], typical: "individual" },
    requiredSupplierType: { allowed: ["other"] },
    statusFlow: { bookingStatusSetId: "bookingStatus", additionalStatusSetIds: [] },
    note: "This is the client-facing overseas-employment-placement SERVICE the agency sells (a booking type) — distinct from the agency's own internal JobPosting/JobApplication HR recruitment models, which track hiring the agency's OWN staff, not client placements. No dedicated supplier category exists for manpower/recruitment agencies today — falls under Vendor.category 'other'.",
  },
};

const BOOKING_TYPE_IDS = Object.keys(BOOKING_TYPE_REGISTRY);

// ── Booking Registry accessors ──
function getBookingRegistry() {
  return BOOKING_TYPE_REGISTRY;
}

function getBookingType(bookingTypeId) {
  return BOOKING_TYPE_REGISTRY[bookingTypeId];
}

// ── Service Type Resolver ──
/** Resolve a booking type to its underlying service type(s) + Hajj/Umrah package-type disambiguator, if any. */
function resolveServiceType(bookingTypeId) {
  const type = BOOKING_TYPE_REGISTRY[bookingTypeId];
  if (!type) return null;
  return {
    bookingTypeId,
    serviceTypes: type.serviceTypes,
    packageTypeValue: type.packageTypeValue ?? null,
  };
}

// ── Booking Context Resolver ──
// Service Type -> Booking Category -> Workflow -> Required Customer Type ->
// Required Supplier Type -> Payment Flow -> Status Flow -> Booking Context.
function resolveBookingContext(bookingTypeId) {
  const type = BOOKING_TYPE_REGISTRY[bookingTypeId];
  if (!type) return null;

  const serviceType = resolveServiceType(bookingTypeId);

  const statusFlow = {
    bookingStatus: getStatusSet(type.statusFlow.bookingStatusSetId) ?? null,
    additional: type.statusFlow.additionalStatusSetIds.map((id) => ({ id, ...getStatusSet(id) })),
  };

  return {
    bookingTypeId,
    label: type.label,
    serviceType,
    bookingCategory: type.bookingCategory,
    workflow: BOOKING_WORKFLOW_PIPELINE,
    requiredCustomerType: type.requiredCustomerType,
    requiredSupplierType: type.requiredSupplierType,
    paymentFlow: {
      ...PAYMENT_FLOW_STATUS_SETS,
      paymentStatus: getStatusSet(PAYMENT_FLOW_STATUS_SETS.paymentStatusSetId) ?? null,
      invoiceStatus: getStatusSet(PAYMENT_FLOW_STATUS_SETS.invoiceStatusSetId) ?? null,
    },
    statusFlow,
    note: type.note ?? null,
  };
}

module.exports = {
  BOOKING_TYPE_IDS,
  BOOKING_WORKFLOW_PIPELINE,
  getBookingRegistry,
  getBookingType,
  resolveServiceType,
  resolveBookingContext,
};
