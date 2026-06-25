const { prisma } = require("../middleware/auth");

const FALLBACK_TEMPLATES = {
  subscriptionRenewal: (data) =>
    `Dear ${data.ownerName || "Agency Owner"}, your ${data.plan || ""} plan ${data.wasTrial ? "trial has ended" : "has expired"}. Renew: app.travelagencyweb.com/subscription — Travel Agency Web`,

  subscriptionRenewalBn: (data) =>
    `প্রিয় ${data.ownerName || "এজেন্সি মালিক"}, আপনার ${data.plan || ""} প্ল্যানের মেয়াদ শেষ। রিনিউ: app.travelagencyweb.com/subscription`,

  subscriptionExpiring: (data) =>
    `Your ${data.plan} plan expires on ${data.expiryDate}. Renew now to avoid interruption. — Travel Agency Web`,

  paymentReminder: (data) =>
    `Reminder: Invoice ${data.invoiceNumber || "N/A"} for ৳${data.dueAmount || 0} is due on ${data.dueDate || "soon"}. Please pay promptly. — ${data.company || data.tenantName || "Travel Agency"}`,

  trialDripLast: (data) =>
    `Last day! Your ${data.trialDays || 7}-day trial ends ${data.expiryDate || "soon"}. Renew: app.travelagencyweb.com/subscription`,

  passportExpiryAlert: (data) => {
    const pp = data.passportNumber ? ` (${data.passportNumber})` : "";
    return `Dear ${data.clientName || "Client"}, your passport${pp} expires on ${data.expiryDate} (${data.daysLeft} days left). Please renew soon. — ${data.companyName || "Travel Agency"}`;
  },

  passportExpiryAlertBn: (data) => {
    const pp = data.passportNumber ? ` (${data.passportNumber})` : "";
    return `প্রিয় ${data.clientName || "গ্রাহক"}, আপনার পাসপোর্ট${pp} এর মেয়াদ ${data.expiryDate} এ শেষ (${data.daysLeft} দিন বাকি)। — ${data.companyName || "ট্রাভেল এজেন্সি"}`;
  },

  travelDepartureReminder: (data) => {
    const dest = data.destination ? ` to ${data.destination}` : "";
    return `Dear ${data.clientName || "Traveler"}, your trip${dest} departs ${data.travelDate} (${data.daysLeft} day(s)). Safe travels! — ${data.companyName || "Travel Agency"}`;
  },

  travelDepartureReminderBn: (data) => {
    const dest = data.destination ? ` (${data.destination})` : "";
    return `প্রিয় ${data.clientName || "ভ্রমণকারী"}, আপনার ভ্রমণ${dest} ${data.travelDate} এ শুরু (${data.daysLeft} দিন বাকি)। শুভ যাত্রা! — ${data.companyName || "ট্রাভেল এজেন্সি"}`;
  },
};

function renderMessage(template, data) {
  let msg = template;
  const vars = data || {};
  for (const [key, value] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value ?? ""));
  }
  return msg;
}

async function getDbTemplate(type) {
  if (!prisma.whatsAppTemplate) return null;
  return prisma.whatsAppTemplate.findFirst({
    where: { tenantId: null, type, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function getWhatsAppTemplate(type, data = {}, options = {}) {
  const useBn = options.useBn === true;
  const typeKey = useBn && FALLBACK_TEMPLATES[`${type}Bn`] ? `${type}Bn` : type;

  const db = await getDbTemplate(typeKey === `${type}Bn` ? type : typeKey).catch(() => null)
    || await getDbTemplate(type).catch(() => null);

  if (db?.message) {
    return {
      message: renderMessage(db.message, data),
      metaTemplateName: db.metaTemplateName || null,
    };
  }

  const fallback = FALLBACK_TEMPLATES[typeKey] || FALLBACK_TEMPLATES[type];
  if (!fallback) return null;
  return { message: typeof fallback === "function" ? fallback(data) : renderMessage(fallback, data), metaTemplateName: null };
}

function extractVariables(message) {
  const matches = String(message || "").match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, "")))];
}

module.exports = { getWhatsAppTemplate, extractVariables, FALLBACK_TEMPLATES };
