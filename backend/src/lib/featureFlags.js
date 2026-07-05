// Feature Flag Engine — Phase 1, Milestone 2
// (docs/v2-master/11-Architecture-Freeze.md §12, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// This is the ONLY place new v2 capabilities may be gated. Every flag key is
// pre-registered below in KNOWN_FLAGS with a coded default — always `false`
// for this milestone, per the frozen rule "every new capability must remain
// behind Feature Flags" and "every flag must default to OFF".
//
// Design contract (deliberate, not accidental):
//   - Reads (isEnabled / getAllFlags) NEVER throw and NEVER fail open. Any
//     error — including the SystemFlag table not existing yet because the
//     migration hasn't been applied to a given environment — resolves to the
//     flag's coded default (false). Availability of the rest of the app must
//     never depend on this table being migrated.
//   - Writes (setFlag) DO propagate errors. A flag toggle must never silently
//     "succeed" without actually being persisted — callers (the API route)
//     surface failures as a 500, not a false "ok".
//   - Unknown keys are always false on read, and rejected outright on write.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Phase 1 registers the three flags this phase's later milestones will gate.
// Adding a flag here does nothing on its own — nothing consults these keys
// until the corresponding milestone wires a consumer.
const KNOWN_FLAGS = {
  dynamicSidebar: {
    description: "Route the sidebar through the Module Registry instead of src/config/navigation.ts",
    default: false,
  },
  planEngineV2: {
    description: "Resolve plan limits/features/pricing via the Plan Engine instead of the legacy plan tables",
    default: false,
  },
  statusEngineV2: {
    description: "Validate status writes against the central Status Engine",
    default: false,
  },
};

function isKnownFlag(key) {
  return Object.prototype.hasOwnProperty.call(KNOWN_FLAGS, key);
}

function codedDefault(key) {
  return KNOWN_FLAGS[key]?.default ?? false;
}

/**
 * Resolve one flag for an optional tenant.
 * Precedence: tenant-specific row > global row (tenantId null) > coded default.
 * Never throws — always resolves to a boolean.
 */
async function isEnabled(key, tenantId) {
  if (!isKnownFlag(key)) return false;
  try {
    if (tenantId) {
      const tenantRow = await prisma.systemFlag.findFirst({ where: { key, tenantId } });
      if (tenantRow) return tenantRow.enabled;
    }
    const globalRow = await prisma.systemFlag.findFirst({ where: { key, tenantId: null } });
    if (globalRow) return globalRow.enabled;
    return codedDefault(key);
  } catch {
    // DB unreachable, or SystemFlag not migrated yet in this environment —
    // fail safe to the coded default rather than breaking the caller.
    return codedDefault(key);
  }
}

/** Resolve every known flag at once for a tenant (used by GET /api/feature-flags). */
async function getAllFlags(tenantId) {
  const keys = Object.keys(KNOWN_FLAGS);
  const values = await Promise.all(keys.map((key) => isEnabled(key, tenantId)));
  return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
}

/**
 * Set (upsert) a flag. Pass tenantId to create/update a tenant-specific
 * override; omit it (or pass null) to set the global default.
 * Throws on an unknown key, and propagates any DB error — this is a write,
 * it must not fail silently.
 */
async function setFlag(key, enabled, tenantId = null) {
  if (!isKnownFlag(key)) {
    throw new Error(`Unknown feature flag: ${key}`);
  }
  if (typeof enabled !== "boolean") {
    throw new Error("enabled must be a boolean");
  }
  const existing = await prisma.systemFlag.findFirst({ where: { key, tenantId } });
  if (existing) {
    return prisma.systemFlag.update({ where: { id: existing.id }, data: { enabled } });
  }
  return prisma.systemFlag.create({
    data: { key, tenantId, enabled, description: KNOWN_FLAGS[key].description },
  });
}

module.exports = { KNOWN_FLAGS, isKnownFlag, isEnabled, getAllFlags, setFlag };
