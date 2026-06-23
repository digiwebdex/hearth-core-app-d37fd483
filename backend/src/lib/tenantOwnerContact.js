/** Resolve agency owner phone/WhatsApp for subscription alerts. */
async function resolveTenantOwnerContact(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, phone: true, whatsapp: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiry: true },
  });
  if (!tenant) return null;

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: "tenant_owner" },
    select: { id: true, name: true, email: true, phone: true, whatsapp: true },
  });

  const phone = String(owner?.phone || owner?.whatsapp || tenant.phone || tenant.whatsapp || "").trim() || null;
  const whatsapp = String(owner?.whatsapp || tenant.whatsapp || owner?.phone || tenant.phone || "").trim() || null;

  return {
    tenant,
    owner,
    ownerName: owner?.name || tenant.name,
    ownerEmail: owner?.email || null,
    phone,
    whatsapp,
  };
}

module.exports = { resolveTenantOwnerContact };
