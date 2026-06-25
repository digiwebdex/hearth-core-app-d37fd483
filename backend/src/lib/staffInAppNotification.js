/**
 * Tenant-wide in-app notification for staff (userId null = visible to all tenant users).
 */
async function notifyTenantStaff(prisma, {
  tenantId,
  type = "system",
  title,
  message,
  link = null,
  actorUserId = null,
}) {
  if (!tenantId || !title || !message) return null;
  return prisma.notification
    .create({
      data: {
        tenantId,
        userId: null,
        actorUserId,
        type,
        title,
        message,
        link,
      },
    })
    .catch(() => null);
}

module.exports = { notifyTenantStaff };
