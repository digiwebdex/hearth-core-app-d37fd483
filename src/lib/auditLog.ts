// ── Global Audit Log System ──

export type AuditModule =
  | "auth" | "subscription" | "payment" | "booking" | "invoice"
  | "quotation" | "lead" | "client" | "role" | "domain"
  | "settings" | "team" | "sms" | "tenant";

export type AuditAction =
  | "login" | "logout" | "login_failed"
  | "created" | "updated" | "deleted" | "status_changed"
  | "approved" | "rejected"
  | "plan_upgraded" | "plan_downgraded" | "subscription_renewed" | "subscription_cancelled" | "subscription_suspended" | "subscription_extended"
  | "payment_approved" | "payment_rejected"
  | "role_changed" | "permission_updated"
  | "exported" | "imported"
  | "domain_added" | "domain_verified" | "domain_removed"
  | "sms_sent" | "email_sent"
  | "setting_changed"
  | "member_added" | "member_removed";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  tenantId?: string;
  tenantName?: string;
  module: AuditModule;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, string>;
  ipAddress?: string;
}

// In-memory log store (will be replaced by API calls in production)
let auditLogs: AuditLogEntry[] = [];

export function logAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
  const log: AuditLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  auditLogs = [log, ...auditLogs];
  return log;
}

export function getAuditLogs(): AuditLogEntry[] {
  return auditLogs;
}

export function seedAuditLogs() {
  if (auditLogs.length > 0) return;
  const base = { actorId: "u-admin", actorName: "Super Admin", actorEmail: "admin@travelagencyweb.com", actorRole: "super_admin" };
  const tenant1 = { tenantId: "t1", tenantName: "Acme Travel" };
  const tenant2 = { tenantId: "t2", tenantName: "Globe Tours" };

  const seeds: Omit<AuditLogEntry, "id">[] = [
    { ...base, ...tenant1, timestamp: "2026-03-31T14:30:00Z", module: "payment", action: "payment_approved", targetType: "payment_request", targetId: "pr3", targetLabel: "TRX-5551234", oldValue: "pending", newValue: "approved", metadata: { reviewerComment: "Payment verified against bank statement" } },
    { ...base, ...tenant1, timestamp: "2026-03-31T14:31:00Z", module: "subscription", action: "plan_upgraded", targetType: "subscription", targetId: "s1", targetLabel: "Acme Travel", oldValue: "basic", newValue: "pro" },
    { ...base, ...tenant2, timestamp: "2026-03-30T09:15:00Z", module: "payment", action: "payment_rejected", targetType: "payment_request", targetId: "pr4", targetLabel: "TRX-7778899", oldValue: "pending", newValue: "rejected", metadata: { reviewerComment: "Transaction ID not found in bKash records" } },
    { ...base, ...tenant2, timestamp: "2026-03-29T11:00:00Z", module: "subscription", action: "subscription_cancelled", targetType: "subscription", targetId: "s5", targetLabel: "Dream Trips", oldValue: "active", newValue: "cancelled", metadata: { reason: "Switching to competitor" } },
    { ...base, timestamp: "2026-03-29T08:00:00Z", module: "role", action: "role_changed", targetType: "user", targetId: "u5", targetLabel: "ali@star.com", oldValue: "sales_agent", newValue: "manager" },
    { actorId: "u-john", actorName: "John Doe", actorEmail: "john@acme.com", actorRole: "tenant_owner", ...tenant1, timestamp: "2026-03-28T16:45:00Z", module: "booking", action: "status_changed", targetType: "booking", targetId: "b12", targetLabel: "BK-2026-012 (Cox's Bazar)", oldValue: "confirmed", newValue: "ticketed" },
    { actorId: "u-john", actorName: "John Doe", actorEmail: "john@acme.com", actorRole: "tenant_owner", ...tenant1, timestamp: "2026-03-28T10:00:00Z", module: "invoice", action: "updated", targetType: "invoice", targetId: "inv8", targetLabel: "INV-2026-008", oldValue: "৳45,000", newValue: "৳48,500", metadata: { field: "total_amount" } },
    { actorId: "u-jane", actorName: "Jane Smith", actorEmail: "jane@globe.com", actorRole: "tenant_owner", ...tenant2, timestamp: "2026-03-27T14:20:00Z", module: "lead", action: "status_changed", targetType: "lead", targetId: "l20", targetLabel: "Ahmed (Dubai Trip)", oldValue: "qualified", newValue: "won" },
    { actorId: "u-jane", actorName: "Jane Smith", actorEmail: "jane@globe.com", actorRole: "tenant_owner", ...tenant2, timestamp: "2026-03-27T14:25:00Z", module: "client", action: "created", targetType: "client", targetId: "c55", targetLabel: "Ahmed Hasan" },
    { ...base, timestamp: "2026-03-26T09:00:00Z", module: "auth", action: "login", targetType: "session", ipAddress: "103.45.67.89" },
    { actorId: "u-hacker", actorName: "Unknown", actorEmail: "test@test.com", actorRole: "unknown", timestamp: "2026-03-26T03:15:00Z", module: "auth", action: "login_failed", metadata: { attempts: "5", blocked: "true" }, ipAddress: "45.33.12.88" },
    { ...base, timestamp: "2026-03-25T12:00:00Z", module: "settings", action: "setting_changed", targetType: "smtp", targetLabel: "SMTP Configuration", oldValue: "smtp.old.com", newValue: "smtp.new.com" },
    { ...base, ...tenant1, timestamp: "2026-03-25T10:00:00Z", module: "domain", action: "domain_verified", targetType: "domain", targetId: "d1", targetLabel: "acmetravel.com", oldValue: "pending", newValue: "active" },
    { ...base, timestamp: "2026-03-24T15:30:00Z", module: "tenant", action: "created", targetType: "tenant", targetId: "t6", targetLabel: "New Agency" },
    { actorId: "u-john", actorName: "John Doe", actorEmail: "john@acme.com", actorRole: "tenant_owner", ...tenant1, timestamp: "2026-03-24T09:00:00Z", module: "quotation", action: "status_changed", targetType: "quotation", targetId: "q15", targetLabel: "QT-2026-015 (Maldives)", oldValue: "sent", newValue: "approved" },
  ];

  auditLogs = seeds.map((s) => ({ ...s, id: crypto.randomUUID() })) as AuditLogEntry[];
}

export const MODULE_LABELS: Record<AuditModule, string> = {
  auth: "Authentication", subscription: "Subscription", payment: "Payment",
  booking: "Booking", invoice: "Invoice", quotation: "Quotation",
  lead: "Lead", client: "Client", role: "Role & Permission",
  domain: "Domain", settings: "Settings", team: "Team",
  sms: "SMS", tenant: "Tenant",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  login: "Login", logout: "Logout", login_failed: "Login Failed",
  created: "Created", updated: "Updated", deleted: "Deleted", status_changed: "Status Changed",
  approved: "Approved", rejected: "Rejected",
  plan_upgraded: "Plan Upgraded", plan_downgraded: "Plan Downgraded",
  subscription_renewed: "Renewed", subscription_cancelled: "Cancelled",
  subscription_suspended: "Suspended", subscription_extended: "Extended",
  payment_approved: "Payment Approved", payment_rejected: "Payment Rejected",
  role_changed: "Role Changed", permission_updated: "Permission Updated",
  exported: "Exported", imported: "Imported",
  domain_added: "Domain Added", domain_verified: "Domain Verified", domain_removed: "Domain Removed",
  sms_sent: "SMS Sent", email_sent: "Email Sent",
  setting_changed: "Setting Changed",
  member_added: "Member Added", member_removed: "Member Removed",
};

export function getActionColor(action: AuditAction): string {
  if (action.includes("approved") || action.includes("verified") || action === "created" || action === "login") return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (action.includes("rejected") || action.includes("failed") || action === "deleted" || action.includes("cancelled") || action.includes("suspended")) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  if (action.includes("upgraded") || action.includes("renewed") || action.includes("extended")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (action.includes("changed") || action === "updated" || action.includes("downgraded")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return "bg-muted text-muted-foreground";
}
