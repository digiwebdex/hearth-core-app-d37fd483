// ── Role-Based Access Control System ──
// Extensible permission matrix for multi-tenant travel agency SaaS

// ── Roles ──
export type AppRole =
  | "super_admin"     // Platform-level admin (manages all tenants)
  | "tenant_owner"    // Tenant owner (full access within tenant)
  | "manager"         // Manages most operations within tenant
  | "sales_agent"     // Handles clients, leads, bookings
  | "accountant"      // Handles invoices, payments, accounts, reports
  | "operations";     // Handles bookings, hajj/umrah, vendors

// Legacy role mapping (backend may still send these)
export type LegacyRole = "owner" | "admin" | "member";

export function mapLegacyRole(role: string): AppRole {
  switch (role) {
    case "owner":
    case "admin":
      return "tenant_owner";
    case "member":
      return "sales_agent";
    default:
      return role as AppRole;
  }
}

// ── Modules ──
export type Module =
  | "dashboard"
  | "clients"
  | "agents"
  | "vendors"
  | "leads"
  | "tasks"
  | "quotations"
  | "packages"
  | "bookings"
  | "invoices"
  | "accounts"
  | "reports"
  | "hajj_umrah"
  | "subscription"
  | "team"
  | "organization"
  | "settings"
  | "website"
  | "admin_panel";

// ── Actions ──
export type Action = "view" | "create" | "edit" | "delete" | "approve" | "export";

// ── Permission Matrix ──
// true = allowed, false/undefined = denied
export type PermissionMatrix = Record<Module, Partial<Record<Action, boolean>>>;

const ALL_ACTIONS: Record<Action, boolean> = {
  view: true, create: true, edit: true, delete: true, approve: true, export: true,
};

const VIEW_ONLY: Partial<Record<Action, boolean>> = { view: true };
const VIEW_CREATE: Partial<Record<Action, boolean>> = { view: true, create: true };
const VIEW_CREATE_EDIT: Partial<Record<Action, boolean>> = { view: true, create: true, edit: true };
const VIEW_CREATE_EDIT_EXPORT: Partial<Record<Action, boolean>> = { view: true, create: true, edit: true, export: true };
const NONE: Partial<Record<Action, boolean>> = {};

// ── Default Permission Matrices Per Role ──
export const DEFAULT_PERMISSIONS: Record<AppRole, PermissionMatrix> = {
  super_admin: {
    dashboard: ALL_ACTIONS,
    clients: ALL_ACTIONS,
    agents: ALL_ACTIONS,
    vendors: ALL_ACTIONS,
    leads: ALL_ACTIONS,
    tasks: ALL_ACTIONS,
    quotations: ALL_ACTIONS,
    packages: ALL_ACTIONS,
    bookings: ALL_ACTIONS,
    invoices: ALL_ACTIONS,
    accounts: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    hajj_umrah: ALL_ACTIONS,
    subscription: ALL_ACTIONS,
    team: ALL_ACTIONS,
    organization: ALL_ACTIONS,
    settings: ALL_ACTIONS,
    website: ALL_ACTIONS,
    admin_panel: ALL_ACTIONS,
  },

  tenant_owner: {
    dashboard: ALL_ACTIONS,
    clients: ALL_ACTIONS,
    agents: ALL_ACTIONS,
    vendors: ALL_ACTIONS,
    leads: ALL_ACTIONS,
    tasks: ALL_ACTIONS,
    quotations: ALL_ACTIONS,
    packages: ALL_ACTIONS,
    bookings: ALL_ACTIONS,
    invoices: ALL_ACTIONS,
    accounts: ALL_ACTIONS,
    reports: ALL_ACTIONS,
    hajj_umrah: ALL_ACTIONS,
    subscription: ALL_ACTIONS,
    team: ALL_ACTIONS,
    organization: ALL_ACTIONS,
    settings: ALL_ACTIONS,
    website: ALL_ACTIONS,
    admin_panel: NONE,
  },

  manager: {
    dashboard: { view: true, export: true },
    clients: ALL_ACTIONS,
    agents: ALL_ACTIONS,
    vendors: ALL_ACTIONS,
    leads: ALL_ACTIONS,
    tasks: ALL_ACTIONS,
    quotations: ALL_ACTIONS,
    packages: ALL_ACTIONS,
    bookings: ALL_ACTIONS,
    invoices: { view: true, create: true, edit: true, approve: true, export: true },
    accounts: { view: true, create: true, edit: true, export: true },
    reports: { view: true, export: true },
    hajj_umrah: ALL_ACTIONS,
    subscription: VIEW_ONLY,
    team: VIEW_ONLY,
    organization: VIEW_ONLY,
    settings: NONE,
    website: { view: true, edit: true },
    admin_panel: NONE,
  },

  sales_agent: {
    dashboard: VIEW_ONLY,
    clients: VIEW_CREATE_EDIT,
    agents: VIEW_ONLY,
    vendors: VIEW_ONLY,
    leads: { view: true, create: true, edit: true, delete: true },
    tasks: VIEW_CREATE_EDIT,
    quotations: { view: true, create: true, edit: true, export: true },
    packages: VIEW_CREATE_EDIT,
    bookings: VIEW_CREATE_EDIT,
    invoices: VIEW_ONLY,
    accounts: NONE,
    reports: NONE,
    hajj_umrah: VIEW_CREATE,
    subscription: NONE,
    team: NONE,
    organization: NONE,
    settings: NONE,
    website: NONE,
    admin_panel: NONE,
  },

  accountant: {
    dashboard: { view: true, export: true },
    clients: VIEW_ONLY,
    agents: VIEW_ONLY,
    vendors: VIEW_ONLY,
    leads: NONE,
    tasks: VIEW_ONLY,
    quotations: { view: true, export: true },
    packages: VIEW_ONLY,
    bookings: VIEW_ONLY,
    invoices: { view: true, create: true, edit: true, approve: true, export: true },
    accounts: { view: true, create: true, edit: true, export: true },
    reports: { view: true, export: true },
    hajj_umrah: { view: true, export: true },
    subscription: VIEW_ONLY,
    team: NONE,
    organization: NONE,
    settings: NONE,
    website: NONE,
    admin_panel: NONE,
  },

  operations: {
    dashboard: VIEW_ONLY,
    clients: VIEW_ONLY,
    agents: VIEW_ONLY,
    vendors: VIEW_CREATE_EDIT,
    leads: NONE,
    tasks: VIEW_CREATE_EDIT,
    quotations: VIEW_ONLY,
    packages: VIEW_CREATE_EDIT,
    bookings: VIEW_CREATE_EDIT_EXPORT,
    invoices: VIEW_ONLY,
    accounts: NONE,
    reports: VIEW_ONLY,
    hajj_umrah: { view: true, create: true, edit: true, export: true },
    subscription: NONE,
    team: NONE,
    organization: NONE,
    settings: NONE,
    website: NONE,
    admin_panel: NONE,
  },
};

// ── Helpers ──

/**
 * Check if a role has a specific permission on a module.
 * Supports custom overrides (e.g., from admin-configured permissions).
 */
export function hasPermission(
  role: AppRole,
  module: Module,
  action: Action,
  overrides?: Partial<Record<AppRole, Partial<PermissionMatrix>>>
): boolean {
  // Super admin always has access
  if (role === "super_admin") return true;

  // Check overrides first
  if (overrides?.[role]?.[module]?.[action] !== undefined) {
    return overrides[role]![module]![action]!;
  }

  return DEFAULT_PERMISSIONS[role]?.[module]?.[action] ?? false;
}

/**
 * Check if a role can access a module at all (has any action).
 */
export function canAccessModule(
  role: AppRole,
  module: Module,
  overrides?: Partial<Record<AppRole, Partial<PermissionMatrix>>>
): boolean {
  if (role === "super_admin") return true;

  const perms = overrides?.[role]?.[module] ?? DEFAULT_PERMISSIONS[role]?.[module];
  if (!perms) return false;

  return Object.values(perms).some(Boolean);
}

/**
 * Get all permissions for a role on a module.
 */
export function getModulePermissions(
  role: AppRole,
  module: Module,
  overrides?: Partial<Record<AppRole, Partial<PermissionMatrix>>>
): Partial<Record<Action, boolean>> {
  if (role === "super_admin") return ALL_ACTIONS;
  return overrides?.[role]?.[module] ?? DEFAULT_PERMISSIONS[role]?.[module] ?? {};
}

/**
 * Get all modules a role can access.
 */
export function getAccessibleModules(
  role: AppRole,
  overrides?: Partial<Record<AppRole, Partial<PermissionMatrix>>>
): Module[] {
  const allModules: Module[] = [
    "dashboard", "clients", "agents", "vendors", "leads", "tasks", "quotations",
    "packages", "bookings", "invoices", "accounts", "reports", "hajj_umrah",
    "subscription", "team", "organization", "settings", "website", "admin_panel",
  ];
  return allModules.filter((m) => canAccessModule(role, m, overrides));
}

// ── Role Metadata ──
export interface RoleMeta {
  id: AppRole;
  label: string;
  labelBn: string;
  description: string;
  color: string;
  isTenantRole: boolean; // false = platform-only (super_admin)
}

export const ROLE_METADATA: RoleMeta[] = [
  {
    id: "super_admin",
    label: "Super Admin",
    labelBn: "সুপার অ্যাডমিন",
    description: "Full platform access. Manages all tenants, plans, and system settings.",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    isTenantRole: false,
  },
  {
    id: "tenant_owner",
    label: "Tenant Owner",
    labelBn: "মালিক",
    description: "Full access within their tenant. Manages team, subscription, and all modules.",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    isTenantRole: true,
  },
  {
    id: "manager",
    label: "Manager",
    labelBn: "ম্যানেজার",
    description: "Manages day-to-day operations. Access to most modules except settings and billing.",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    isTenantRole: true,
  },
  {
    id: "sales_agent",
    label: "Sales Agent",
    labelBn: "সেলস এজেন্ট",
    description: "Handles clients, leads, and bookings. Limited view of other modules.",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    isTenantRole: true,
  },
  {
    id: "accountant",
    label: "Accountant",
    labelBn: "হিসাবরক্ষক",
    description: "Manages invoices, payments, accounts, and financial reports.",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    isTenantRole: true,
  },
  {
    id: "operations",
    label: "Operations Staff",
    labelBn: "অপারেশন্স",
    description: "Handles bookings, Hajj/Umrah operations, vendors, and tasks.",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    isTenantRole: true,
  },
];

export function getRoleMeta(role: AppRole): RoleMeta {
  const mapped = mapLegacyRole(role);
  // Never fall back to ROLE_METADATA[0] (super_admin) — that leaked "Super Admin"
  // into the tenant header whenever the role was briefly undefined/unrecognized.
  // Default to the tenant staff role instead.
  return (
    ROLE_METADATA.find((r) => r.id === mapped) ||
    ROLE_METADATA.find((r) => r.id === "sales_agent") ||
    ROLE_METADATA[0]
  );
}

export function getTenantRoles(): RoleMeta[] {
  return ROLE_METADATA.filter((r) => r.isTenantRole);
}

// ── Module Metadata ──
export interface ModuleMeta {
  id: Module;
  label: string;
  category: "overview" | "crm" | "finance" | "operations" | "management" | "platform";
}

export const MODULE_METADATA: ModuleMeta[] = [
  { id: "dashboard", label: "Dashboard", category: "overview" },
  { id: "clients", label: "Clients", category: "crm" },
  { id: "agents", label: "Agents", category: "crm" },
  { id: "vendors", label: "Vendors", category: "crm" },
  { id: "leads", label: "Leads", category: "crm" },
  { id: "tasks", label: "Tasks", category: "crm" },
  { id: "quotations", label: "Quotations", category: "crm" },
  { id: "packages", label: "Packages", category: "operations" },
  { id: "bookings", label: "Bookings", category: "operations" },
  { id: "invoices", label: "Invoices", category: "finance" },
  { id: "accounts", label: "Accounts", category: "finance" },
  { id: "reports", label: "Reports", category: "finance" },
  { id: "hajj_umrah", label: "Hajj/Umrah", category: "operations" },
  { id: "subscription", label: "Subscription", category: "management" },
  { id: "team", label: "Team", category: "management" },
  { id: "organization", label: "Organization", category: "management" },
  { id: "settings", label: "Settings", category: "management" },
  { id: "website", label: "Website", category: "management" },
  { id: "admin_panel", label: "Admin Panel", category: "platform" },
];

export const ALL_ACTIONS_LIST: Action[] = ["view", "create", "edit", "delete", "approve", "export"];

export const ACTION_LABELS: Record<Action, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
};
