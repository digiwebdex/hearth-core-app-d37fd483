// Status Engine — Phase 1, Milestone 5
// (docs/v2-master/11-Architecture-Freeze.md §10, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// READ-ONLY. This engine documents statuses and their intended transitions;
// it does not validate, enforce, or write anything. Every existing route
// (bookings.js, invoices.js, leads.js, ...) keeps accepting and persisting
// status values exactly as it does today — nothing here is wired into any
// write path. "Document transitions. Do not enforce them yet."
//
// Values below are ported, not invented, from the actual current code:
//   - Booking/Invoice/Lead: verified against docs/v2-master/05-Workflow-Book.md
//     and the live route handlers (backend/src/routes/bookings.js,
//     invoices.js, leads.js).
//   - Hajj package/pilgrim/visa: verified against src/components/hajj/constants.ts
//     (PKG_STATUS_META, PILGRIM_STATUS_META, VISA_STATUS_META).
//   - Visa application: verified against src/pages/VisaTracker.tsx (STAGES).
//   - Hotel/Transport contract: verified against src/pages/Inventory.tsx
//     (hotelStatusColor / transportStatusColor).
//   - Group tour: verified against the GroupTour TS union in src/lib/api.ts.
//   - Travel approval: verified against the TravelApprovalRequest TS union
//     in src/lib/api.ts.
//   - Customer/Agent: verified against backend/src/middleware/auth.js's
//     user.status checks and the Agent AgentStatus TS union in src/lib/api.ts.
//   - Passport: NOT a stored column anywhere — Client only stores
//     `passportExpiry` (a date). "expiring"/"expired" are computed at read
//     time (see the ExpiringPassportClient type in src/lib/api.ts). Registered
//     here as a derived status set, clearly marked `derived: true`.
//
// No DB enums exist for any of these columns (all plain Prisma `String`),
// and most write routes accept the request body's status verbatim — so no
// transition below is a guarantee today. `confidence: "verified"` means the
// transition is corroborated by real route logic (e.g. the money-roll-up
// cascade, or an automation trigger); `confidence: "inferred"` means it is
// the natural reading of the existing ordered status list (e.g. the Hajj
// constants.ts arrays) with no enforcing code found — a documented best
// guess, not a fact.

// ── Status Registry: the value catalogue (label + color per status) ──
const STATUS_REGISTRY = {
  bookingStatus: {
    category: "Booking Status", entity: "Booking", field: "status", confidence: "verified",
    values: [
      { value: "inquiry", label: "Inquiry", color: "bg-gray-100 text-gray-700" },
      { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
      { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-800" },
      { value: "ticketed", label: "Ticketed", color: "bg-indigo-100 text-indigo-800" },
      { value: "traveling", label: "Traveling", color: "bg-purple-100 text-purple-800" },
      { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
      { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
    ],
  },
  paymentStatus: {
    category: "Payment Status", entity: "Booking", field: "paymentStatus", confidence: "verified",
    note: "Also the shape of Invoice's own paid/due roll-up; VendorBill uses the same 3 values plus overdue (see Invoice Status).",
    values: [
      { value: "unpaid", label: "Unpaid", color: "bg-red-100 text-red-700" },
      { value: "partial", label: "Partially Paid", color: "bg-yellow-100 text-yellow-800" },
      { value: "paid", label: "Paid", color: "bg-green-100 text-green-800" },
    ],
  },
  invoiceStatus: {
    category: "Invoice Status", entity: "Invoice", field: "status", confidence: "verified",
    values: [
      { value: "unpaid", label: "Unpaid", color: "bg-red-100 text-red-700" },
      { value: "partial", label: "Partially Paid", color: "bg-yellow-100 text-yellow-800" },
      { value: "paid", label: "Paid", color: "bg-green-100 text-green-800" },
      { value: "overdue", label: "Overdue", color: "bg-orange-100 text-orange-800" },
      { value: "refunded", label: "Refunded", color: "bg-purple-100 text-purple-800" },
      { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-600" },
    ],
  },
  visaApplicationStatus: {
    category: "Visa Status", entity: "VisaApplication", field: "status", confidence: "inferred",
    note: "Distinct from hajjVisaStatus below — Hajj pilgrims use their own visaStatus vocabulary.",
    values: [
      { value: "not_applied", label: "Not Applied", color: "bg-gray-100 text-gray-600" },
      { value: "applied", label: "Applied", color: "bg-blue-100 text-blue-800" },
      { value: "in_progress", label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
      { value: "approved", label: "Approved", color: "bg-green-100 text-green-800" },
      { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
      { value: "collected", label: "Collected", color: "bg-purple-100 text-purple-800" },
    ],
  },
  hajjVisaStatus: {
    category: "Visa Status", entity: "HajjPilgrim", field: "visaStatus", confidence: "verified",
    note: "Distinct from visaApplicationStatus above — this is the Hajj Operations desk's own vocabulary.",
    values: [
      { value: "not_started", label: "Not Started", color: "bg-gray-100 text-gray-800" },
      { value: "documents_collected", label: "Documents Collected", color: "bg-blue-100 text-blue-800" },
      { value: "submitted", label: "Submitted", color: "bg-yellow-100 text-yellow-800" },
      { value: "approved", label: "Approved", color: "bg-green-100 text-green-800" },
      { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-800" },
    ],
  },
  passportStatus: {
    category: "Passport Status", entity: "Client", field: "passportExpiry (derived)", confidence: "inferred", derived: true,
    note: "Not a stored column — Client only stores passportExpiry (a date). These two values are computed at read time from days-until-expiry (see ExpiringPassportClient in src/lib/api.ts). A passport with no upcoming/past expiry simply has no status here.",
    values: [
      { value: "expiring", label: "Expiring Soon", color: "bg-yellow-100 text-yellow-800" },
      { value: "expired", label: "Expired", color: "bg-red-100 text-red-700" },
    ],
  },
  hotelStatus: {
    category: "Hotel Status", entity: "HotelContract", field: "status", confidence: "verified",
    values: [
      { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
      { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-600" },
      { value: "expired", label: "Expired", color: "bg-red-100 text-red-700" },
    ],
  },
  tourStatus: {
    category: "Tour Status", entity: "GroupTour", field: "status", confidence: "verified",
    values: [
      { value: "upcoming", label: "Upcoming", color: "bg-blue-100 text-blue-800" },
      { value: "ongoing", label: "Ongoing", color: "bg-yellow-100 text-yellow-800" },
      { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
      { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
    ],
  },
  hajjPackageStatus: {
    category: "Hajj Status", entity: "HajjPackage", field: "status", confidence: "verified",
    values: [
      { value: "upcoming", label: "Upcoming", color: "bg-blue-100 text-blue-800" },
      { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
      { value: "departed", label: "Departed", color: "bg-purple-100 text-purple-800" },
      { value: "completed", label: "Completed", color: "bg-gray-100 text-gray-800" },
      { value: "closed", label: "Closed", color: "bg-red-100 text-red-800" },
    ],
  },
  hajjPilgrimStatus: {
    category: "Hajj Status", entity: "HajjPilgrim", field: "status", confidence: "verified",
    values: [
      { value: "registered", label: "Registered", color: "bg-blue-100 text-blue-800" },
      { value: "documents_pending", label: "Documents Pending", color: "bg-yellow-100 text-yellow-800" },
      { value: "visa_processing", label: "Visa Processing", color: "bg-orange-100 text-orange-800" },
      { value: "confirmed", label: "Confirmed", color: "bg-green-100 text-green-800" },
      { value: "departed", label: "Departed", color: "bg-purple-100 text-purple-800" },
      { value: "completed", label: "Completed", color: "bg-gray-100 text-gray-800" },
      { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
    ],
  },
  leadStatus: {
    category: "Lead Status", entity: "Lead", field: "status", confidence: "verified",
    values: [
      { value: "new", label: "New", color: "bg-gray-100 text-gray-700" },
      { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-800" },
      { value: "qualified", label: "Qualified", color: "bg-indigo-100 text-indigo-800" },
      { value: "quoted", label: "Quoted", color: "bg-yellow-100 text-yellow-800" },
      { value: "won", label: "Won", color: "bg-green-100 text-green-800" },
      { value: "lost", label: "Lost", color: "bg-red-100 text-red-700" },
    ],
  },
  taskStatus: {
    category: "Task Status", entity: "Task", field: "status", confidence: "verified",
    values: [
      { value: "todo", label: "To Do", color: "bg-gray-100 text-gray-700" },
      { value: "in_progress", label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
      { value: "done", label: "Done", color: "bg-green-100 text-green-800" },
    ],
  },
  approvalStatus: {
    category: "Approval Status", entity: "TravelApprovalRequest", field: "status", confidence: "verified",
    note: "Expense.status and StaffLeaveRequest.status use the same pending/approved/rejected shape without a distinct 'cancelled' state.",
    values: [
      { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
      { value: "approved", label: "Approved", color: "bg-green-100 text-green-800" },
      { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
      { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-600" },
    ],
  },
  customerStatus: {
    category: "Customer Status", entity: "User", field: "status", confidence: "verified",
    note: "Best-fit reading of 'Customer Status': this is the tenant staff/user account lifecycle (User.status), actively checked in backend/src/middleware/auth.js's authenticate(). A distinct per-Client lifecycle status does not exist in the schema — the closest client-facing alternative is LoyaltyAccount.tier (standard/silver/gold/platinum), registered separately below for completeness.",
    values: [
      { value: "pending", label: "Pending Approval", color: "bg-yellow-100 text-yellow-800" },
      { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
      { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
      { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-600" },
    ],
  },
  agentStatus: {
    category: "Agent Status", entity: "Agent", field: "status", confidence: "verified",
    values: [
      { value: "active", label: "Active", color: "bg-green-100 text-green-800" },
      { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-600" },
    ],
  },

  // ── Related sets found but not explicitly requested — kept for registry completeness ──
  transportContractStatus: {
    category: "Hotel Status", entity: "TransportContract", field: "status", confidence: "verified",
    note: "Not explicitly requested; registered because it shares the Inventory desk with Hotel Status.",
    values: [
      { value: "available", label: "Available", color: "bg-green-100 text-green-800" },
      { value: "in_use", label: "In Use", color: "bg-blue-100 text-blue-800" },
      { value: "maintenance", label: "Maintenance", color: "bg-yellow-100 text-yellow-800" },
      { value: "retired", label: "Retired", color: "bg-gray-100 text-gray-600" },
    ],
  },
  loyaltyTier: {
    category: "Customer Status", entity: "LoyaltyAccount", field: "tier", confidence: "verified",
    note: "Alternate reading of 'Customer Status' as a loyalty tier rather than an account lifecycle. See customerStatus above for the primary reading.",
    values: [
      { value: "standard", label: "Standard", color: "bg-gray-100 text-gray-700" },
      { value: "silver", label: "Silver", color: "bg-slate-200 text-slate-800" },
      { value: "gold", label: "Gold", color: "bg-amber-100 text-amber-800" },
      { value: "platinum", label: "Platinum", color: "bg-indigo-100 text-indigo-800" },
    ],
  },

  // ── Document Verification (added for the Shared Document Engine) ──
  // The document-verification vocabulary lives here, in the central Status
  // Engine, rather than as a parallel status list inside the document engine —
  // consistent with the frozen rule that every status is centrally defined.
  documentVerificationStatus: {
    category: "Document Verification", entity: "Document", field: "verificationStatus", confidence: "verified",
    values: [
      { value: "unverified", label: "Unverified", color: "bg-gray-100 text-gray-700" },
      { value: "verified", label: "Verified", color: "bg-green-100 text-green-800" },
      { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
    ],
  },
};

// ── Workflow Status Registry: documented transitions + workflow stage ──
// Read-only documentation. Nothing enforces these; every write route keeps
// accepting whatever status string it does today.
const WORKFLOW_STATUS_REGISTRY = {
  bookingStatus: {
    inquiry: { stage: "initial", nextStatuses: ["pending", "cancelled"] },
    pending: { stage: "in_progress", nextStatuses: ["confirmed", "cancelled"] },
    confirmed: { stage: "in_progress", nextStatuses: ["ticketed", "cancelled"] },
    ticketed: { stage: "in_progress", nextStatuses: ["traveling", "cancelled"] },
    traveling: { stage: "in_progress", nextStatuses: ["completed", "cancelled"] },
    completed: { stage: "terminal_positive", nextStatuses: [] },
    cancelled: { stage: "terminal_negative", nextStatuses: [] },
  },
  paymentStatus: {
    unpaid: { stage: "initial", nextStatuses: ["partial", "paid"] },
    partial: { stage: "in_progress", nextStatuses: ["paid"] },
    paid: { stage: "terminal_positive", nextStatuses: ["partial"] }, // a refund can move it back
  },
  invoiceStatus: {
    unpaid: { stage: "initial", nextStatuses: ["partial", "paid", "cancelled"] },
    partial: { stage: "in_progress", nextStatuses: ["paid", "cancelled"] },
    paid: { stage: "terminal_positive", nextStatuses: ["refunded"] },
    overdue: { stage: "in_progress", nextStatuses: ["partial", "paid", "cancelled"] },
    refunded: { stage: "terminal_neutral", nextStatuses: [] },
    cancelled: { stage: "terminal_negative", nextStatuses: [] },
  },
  visaApplicationStatus: {
    not_applied: { stage: "initial", nextStatuses: ["applied"] },
    applied: { stage: "in_progress", nextStatuses: ["in_progress"] },
    in_progress: { stage: "in_progress", nextStatuses: ["approved", "rejected"] },
    approved: { stage: "terminal_positive", nextStatuses: ["collected"] },
    rejected: { stage: "terminal_negative", nextStatuses: [] },
    collected: { stage: "terminal_positive", nextStatuses: [] },
  },
  hajjVisaStatus: {
    not_started: { stage: "initial", nextStatuses: ["documents_collected"] },
    documents_collected: { stage: "in_progress", nextStatuses: ["submitted"] },
    submitted: { stage: "in_progress", nextStatuses: ["approved", "rejected"] },
    approved: { stage: "terminal_positive", nextStatuses: [] },
    rejected: { stage: "terminal_negative", nextStatuses: [] },
  },
  passportStatus: {
    expiring: { stage: "in_progress", nextStatuses: ["expired"] }, // time-driven, not a manual action
    expired: { stage: "terminal_negative", nextStatuses: [] },
  },
  hotelStatus: {
    active: { stage: "in_progress", nextStatuses: ["inactive", "expired"] },
    inactive: { stage: "terminal_neutral", nextStatuses: ["active"] },
    expired: { stage: "terminal_negative", nextStatuses: [] },
  },
  tourStatus: {
    upcoming: { stage: "initial", nextStatuses: ["ongoing", "cancelled"] },
    ongoing: { stage: "in_progress", nextStatuses: ["completed", "cancelled"] },
    completed: { stage: "terminal_positive", nextStatuses: [] },
    cancelled: { stage: "terminal_negative", nextStatuses: [] },
  },
  hajjPackageStatus: {
    upcoming: { stage: "initial", nextStatuses: ["active", "closed"] },
    active: { stage: "in_progress", nextStatuses: ["departed", "closed"] },
    departed: { stage: "in_progress", nextStatuses: ["completed"] },
    completed: { stage: "terminal_positive", nextStatuses: ["closed"] },
    closed: { stage: "terminal_neutral", nextStatuses: [] },
  },
  hajjPilgrimStatus: {
    registered: { stage: "initial", nextStatuses: ["documents_pending", "cancelled"] },
    documents_pending: { stage: "in_progress", nextStatuses: ["visa_processing", "cancelled"] },
    visa_processing: { stage: "in_progress", nextStatuses: ["confirmed", "cancelled"] },
    confirmed: { stage: "in_progress", nextStatuses: ["departed", "cancelled"] },
    departed: { stage: "in_progress", nextStatuses: ["completed"] },
    completed: { stage: "terminal_positive", nextStatuses: [] },
    cancelled: { stage: "terminal_negative", nextStatuses: [] },
  },
  leadStatus: {
    new: { stage: "initial", nextStatuses: ["contacted", "lost"] },
    contacted: { stage: "in_progress", nextStatuses: ["qualified", "lost"] },
    qualified: { stage: "in_progress", nextStatuses: ["quoted", "lost"] },
    quoted: { stage: "in_progress", nextStatuses: ["won", "lost"] },
    won: { stage: "terminal_positive", nextStatuses: [] },
    lost: { stage: "terminal_negative", nextStatuses: [] },
  },
  taskStatus: {
    todo: { stage: "initial", nextStatuses: ["in_progress"] },
    in_progress: { stage: "in_progress", nextStatuses: ["done", "todo"] },
    done: { stage: "terminal_positive", nextStatuses: ["todo"] }, // reopenable
  },
  approvalStatus: {
    pending: { stage: "initial", nextStatuses: ["approved", "rejected", "cancelled"] },
    approved: { stage: "terminal_positive", nextStatuses: [] },
    rejected: { stage: "terminal_negative", nextStatuses: [] },
    cancelled: { stage: "terminal_neutral", nextStatuses: [] },
  },
  customerStatus: {
    pending: { stage: "initial", nextStatuses: ["active", "rejected"] },
    active: { stage: "in_progress", nextStatuses: ["inactive"] },
    rejected: { stage: "terminal_negative", nextStatuses: [] },
    inactive: { stage: "terminal_neutral", nextStatuses: ["active"] },
  },
  agentStatus: {
    active: { stage: "in_progress", nextStatuses: ["inactive"] },
    inactive: { stage: "terminal_neutral", nextStatuses: ["active"] },
  },
  transportContractStatus: {
    available: { stage: "in_progress", nextStatuses: ["in_use", "maintenance", "retired"] },
    in_use: { stage: "in_progress", nextStatuses: ["available"] },
    maintenance: { stage: "in_progress", nextStatuses: ["available", "retired"] },
    retired: { stage: "terminal_neutral", nextStatuses: [] },
  },
  loyaltyTier: {
    standard: { stage: "initial", nextStatuses: ["silver"] },
    silver: { stage: "in_progress", nextStatuses: ["gold"] },
    gold: { stage: "in_progress", nextStatuses: ["platinum"] },
    platinum: { stage: "terminal_positive", nextStatuses: [] },
  },
  documentVerificationStatus: {
    unverified: { stage: "initial", nextStatuses: ["verified", "rejected"] },
    verified: { stage: "terminal_positive", nextStatuses: ["unverified"] },
    rejected: { stage: "terminal_negative", nextStatuses: ["unverified"] },
  },
};

const STATUS_SET_IDS = Object.keys(STATUS_REGISTRY);

// ── Status Registry accessors ──
function getStatusRegistry() {
  return STATUS_REGISTRY;
}

function getStatusSet(statusSetId) {
  return STATUS_REGISTRY[statusSetId];
}

/** Every distinct category name (Booking Status, Payment Status, ... Agent Status). */
function getCategories() {
  return [...new Set(STATUS_SET_IDS.map((id) => STATUS_REGISTRY[id].category))];
}

/** All status-set ids backing one named category (some categories span >1 entity). */
function getStatusSetsForCategory(category) {
  return STATUS_SET_IDS.filter((id) => STATUS_REGISTRY[id].category === category);
}

// ── Status Resolver ──
// Entity -> Current Status -> Allowed Next Status -> Display Label -> Color
// -> Workflow Stage -> Final Status Context.
function resolveStatus(statusSetId, currentValue) {
  const set = STATUS_REGISTRY[statusSetId];
  if (!set) return null;

  const definition = set.values.find((v) => v.value === currentValue);
  const workflow = WORKFLOW_STATUS_REGISTRY[statusSetId]?.[currentValue];

  return {
    statusSetId,
    category: set.category,
    entity: set.entity,
    field: set.field,
    currentStatus: currentValue,
    label: definition?.label ?? currentValue,
    color: definition?.color ?? "bg-gray-100 text-gray-600",
    stage: workflow?.stage ?? "unknown",
    allowedNextStatuses: workflow?.nextStatuses ?? [],
    known: Boolean(definition),
    confidence: set.confidence,
  };
}

module.exports = {
  STATUS_REGISTRY,
  WORKFLOW_STATUS_REGISTRY,
  STATUS_SET_IDS,
  getStatusRegistry,
  getStatusSet,
  getCategories,
  getStatusSetsForCategory,
  resolveStatus,
};
