const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function createPlatformNotification({ type, title, message, link, metadata }) {
  return prisma.platformNotification.create({
    data: {
      type,
      title,
      message,
      link: link || null,
      metadata: metadata || null,
    },
  });
}

function mapToAdminDto(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    link: row.link || undefined,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

module.exports = { createPlatformNotification, mapToAdminDto, prisma };
