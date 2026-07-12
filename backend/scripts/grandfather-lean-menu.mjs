// One-off backfill: preserve existing agencies' menus after the lean-menu launch.
//
// Before the 7-item restructure, Sub-Agents, Suppliers, Visa Stock, Expenses,
// Accounts and Tasks were always-visible core items. They're now opt-in bundles
// (basic-floor). To avoid existing paying agencies "losing" them, enable those
// bundles for every current tenant. New signups start with [] → the lean 7 menu.
//
// Idempotent: re-running only unions the ids, never removes anything.
//
// Run:  node backend/scripts/grandfather-lean-menu.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GRANDFATHER = ["subAgents", "suppliers", "visaStock", "advancedFinance", "tasks"];

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, enabledModules: true } });
  console.log(`Backfilling ${tenants.length} tenant(s) with: ${GRANDFATHER.join(", ")}`);
  let changed = 0;
  for (const t of tenants) {
    const current = Array.isArray(t.enabledModules) ? t.enabledModules : [];
    const merged = [...new Set([...current, ...GRANDFATHER])];
    if (merged.length !== current.length) {
      await prisma.tenant.update({ where: { id: t.id }, data: { enabledModules: merged } });
      changed++;
      console.log(`  ✓ ${t.name} → [${merged.join(", ")}]`);
    }
  }
  console.log(`Done. ${changed} tenant(s) updated, ${tenants.length - changed} already current.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
