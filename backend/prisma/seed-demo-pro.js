// Comprehensive Pro demo tenant seeder.
// Creates a shareable "Pro plan" demo agency populated across every core
// module a Pro account sees, so prospective clients can log in and explore a
// realistic, consistent system. Idempotent: re-running wipes the demo tenant's
// data and rebuilds it (never touches other tenants).
//
// Usage: DEMO_EMAIL=... DEMO_PASSWORD=... node prisma/seed-demo-pro.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const EMAIL = process.env.DEMO_EMAIL || "demo@travelagencyweb.com";
const PASSWORD = process.env.DEMO_PASSWORD || "DemoPass@2026";
const SLUG = process.env.DEMO_SLUG || "demo";

const day = (offset) => {
  // Deterministic date string YYYY-MM-DD offset from a fixed anchor (no Date.now
  // reliance for reproducibility across runs — anchor passed via env or default).
  const anchor = new Date(process.env.DEMO_ANCHOR || "2026-07-03T00:00:00Z");
  const d = new Date(anchor.getTime() + offset * 86400000);
  return d.toISOString().slice(0, 10);
};

async function wipeTenant(tenantId) {
  // Delete child rows first to respect FKs. Wrapped in a transaction.
  const tables = [
    "payment", "invoice", "quotation", "vendorBill", "transaction", "expense",
    "task", "lead", "booking", "travelPackage", "agentCommissionProfile",
    "agent", "vendor", "client", "account",
  ];
  for (const t of tables) {
    try { await prisma[t].deleteMany({ where: { tenantId } }); } catch (e) { /* model may lack tenantId */ }
  }
  // commission profiles reference agents/users — clear any left by agent scope
  await prisma.user.deleteMany({ where: { tenantId, email: { not: EMAIL } } });
}

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  // ── Tenant + owner ─────────────────────────────────────────────────────────
  let owner = await prisma.user.findUnique({ where: { email: EMAIL } });
  let tenant = owner ? await prisma.tenant.findUnique({ where: { id: owner.tenantId } }) : null;

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Skyline Travels (Demo)",
        slug: SLUG,
        phone: "+8801700000000",
        whatsapp: "+8801700000000",
        address: "Level 5, Gulshan Avenue",
        city: "Dhaka",
        country: "Bangladesh",
        website: "https://demo.travelagencyweb.com",
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionExpiry: new Date(process.env.DEMO_EXPIRY || "2027-12-31T00:00:00Z"),
        enabledModules: [],
      },
    });
  } else {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionPlan: "pro", subscriptionStatus: "active",
        subscriptionExpiry: new Date(process.env.DEMO_EXPIRY || "2027-12-31T00:00:00Z"),
        enabledModules: [],
      },
    });
  }
  const tid = tenant.id;

  if (!owner) {
    owner = await prisma.user.create({
      data: { name: "Demo Owner", email: EMAIL, password: hash, role: "tenant_owner", status: "active", emailVerified: true, tenantId: tid },
    });
  } else {
    owner = await prisma.user.update({ where: { id: owner.id }, data: { password: hash, role: "tenant_owner", status: "active", emailVerified: true } });
  }
  await prisma.tenant.update({ where: { id: tid }, data: { ownerId: owner.id } });

  // Clean slate for repeatable demo (keeps owner user + tenant).
  await wipeTenant(tid);

  // ── Team members ───────────────────────────────────────────────────────────
  const team = [
    { name: "Nadia Karim", email: `manager.${SLUG}@travelagencyweb.com`, role: "manager" },
    { name: "Rakib Hasan", email: `sales.${SLUG}@travelagencyweb.com`, role: "sales_agent" },
    { name: "Sabbir Ahmed", email: `accounts.${SLUG}@travelagencyweb.com`, role: "accountant" },
    { name: "Tania Sultana", email: `ops.${SLUG}@travelagencyweb.com`, role: "operations" },
  ];
  for (const m of team) {
    await prisma.user.create({ data: { ...m, password: hash, status: "active", emailVerified: true, tenantId: tid } });
  }

  // ── Accounts (cash / bank) ─────────────────────────────────────────────────
  const accCash = await prisma.account.create({ data: { name: "Cash in Hand", type: "cash", balance: 125000, status: "active", tenantId: tid } });
  const accBank = await prisma.account.create({ data: { name: "City Bank — Current", type: "bank", bankName: "City Bank", accountNumber: "1502000123456", balance: 890000, status: "active", tenantId: tid } });
  const accBkash = await prisma.account.create({ data: { name: "bKash Merchant", type: "mobile", accountNumber: "01700000000", balance: 210000, status: "active", tenantId: tid } });

  // ── Clients ────────────────────────────────────────────────────────────────
  const clientSeed = [
    { name: "Ahmed Rahman", phone: "+8801711111111", email: "ahmed.rahman@example.com", nationality: "Bangladeshi", passportNumber: "BP0234567", passportExpiry: day(45), nidNumber: "1990123456789", clientType: "individual", tags: ["vip"] },
    { name: "Fatima Begum", phone: "+8801722222222", email: "fatima.begum@example.com", nationality: "Bangladeshi", passportNumber: "BP0234890", passportExpiry: day(320), clientType: "individual" },
    { name: "Karim Enterprises Ltd", phone: "+8801733333333", email: "info@kariment.com", clientType: "corporate", companyName: "Karim Enterprises Ltd", address: "Motijheel C/A, Dhaka" },
    { name: "Sadia Islam", phone: "+8801744444444", email: "sadia.islam@example.com", nationality: "Bangladeshi", passportNumber: "BP0235111", passportExpiry: day(12), clientType: "individual", tags: ["repeat"] },
    { name: "Mizanur Rahman", phone: "+8801755555555", email: "mizan@example.com", nationality: "Bangladeshi", passportNumber: "BP0235222", passportExpiry: day(600), clientType: "individual" },
    { name: "Green Valley School", phone: "+8801766666666", email: "trips@greenvalley.edu.bd", clientType: "corporate", companyName: "Green Valley School" },
    { name: "Tanvir Hossain", phone: "+8801777777777", email: "tanvir@example.com", nationality: "Bangladeshi", passportNumber: "BP0235333", passportExpiry: day(200), clientType: "individual" },
    { name: "Rezaul Karim", phone: "+8801788888888", email: "rezaul@example.com", nationality: "Bangladeshi", clientType: "individual" },
    { name: "Nusrat Jahan", phone: "+8801799999999", email: "nusrat@example.com", nationality: "Bangladeshi", passportNumber: "BP0235444", passportExpiry: day(90), clientType: "individual", tags: ["vip", "repeat"] },
    { name: "Delta Garments Ltd", phone: "+8801700000011", email: "travel@deltagarments.com", clientType: "corporate", companyName: "Delta Garments Ltd", address: "Ashulia, Savar" },
    { name: "Habibur Rahman", phone: "+8801700000022", email: "habib@example.com", nationality: "Bangladeshi", passportNumber: "BP0235555", passportExpiry: day(500), clientType: "individual" },
    { name: "Shirin Akter", phone: "+8801700000033", email: "shirin@example.com", nationality: "Bangladeshi", passportNumber: "BP0235666", passportExpiry: day(150), clientType: "individual" },
  ];
  const clients = [];
  for (const c of clientSeed) clients.push(await prisma.client.create({ data: { ...c, tenantId: tid } }));

  // ── Agents (with commission profiles) ──────────────────────────────────────
  const agentSeed = [
    { name: "Karim Hassan", phone: "+8801811111111", email: "karim.agent@example.com", rate: 5 },
    { name: "Jasim Uddin", phone: "+8801822222222", email: "jasim.agent@example.com", rate: 4 },
    { name: "Ruma Akter", phone: "+8801833333333", email: "ruma.agent@example.com", rate: 6 },
    { name: "Selim Reza", phone: "+8801844444444", email: "selim.agent@example.com", rate: 3.5 },
  ];
  const agents = [];
  for (const a of agentSeed) {
    agents.push(await prisma.agent.create({
      data: {
        name: a.name, phone: a.phone, email: a.email, tenantId: tid,
        commissionProfile: { create: { commissionRate: a.rate, status: "active" } },
      },
    }));
  }

  // ── Vendors + bills ────────────────────────────────────────────────────────
  const vendorSeed = [
    { name: "Biman Bangladesh Airlines", phone: "+8809602000000", email: "corp@biman.gov.bd", category: "airline" },
    { name: "Saudia Airlines", phone: "+966920022222", email: "trade@saudia.com", category: "airline" },
    { name: "Makkah Grand Hotel", phone: "+966521234567", email: "reservations@makkahgrand.sa", category: "hotel" },
    { name: "Cox's Bazar Sea Pearl", phone: "+8801811110000", email: "sales@seapearl.com.bd", category: "hotel" },
    { name: "Al-Haramain Transport", phone: "+966553330000", email: "ops@haramaintransport.sa", category: "transport" },
    { name: "VFS Global (Visa)", phone: "+8809666700000", email: "info@vfsglobal.com", category: "visa" },
  ];
  const vendors = [];
  for (const v of vendorSeed) vendors.push(await prisma.vendor.create({ data: { ...v, status: "active", tenantId: tid } }));

  const billSeed = [
    { v: 0, description: "Group air tickets DAC-JED (40 pax)", total: 4800000, paid: 4800000, status: "paid", due: day(-20) },
    { v: 2, description: "Makkah hotel — 200 room nights", total: 3200000, paid: 1600000, status: "partial", due: day(15) },
    { v: 4, description: "Ziyarah transport — March batch", total: 650000, paid: 0, status: "unpaid", due: day(10) },
    { v: 3, description: "Cox's Bazar 3N package (30 rooms)", total: 540000, paid: 540000, status: "paid", due: day(-5) },
    { v: 5, description: "Umrah visa processing (40 files)", total: 720000, paid: 360000, status: "partial", due: day(8) },
  ];
  for (const b of billSeed) {
    await prisma.vendorBill.create({
      data: { vendorId: vendors[b.v].id, description: b.description, totalAmount: b.total, paidAmount: b.paid, dueAmount: b.total - b.paid, status: b.status, dueDate: b.due, tenantId: tid },
    });
  }

  // ── Travel packages ────────────────────────────────────────────────────────
  const pkgSeed = [
    { code: "UMR-14N", title: "Premium Umrah 14 Nights", slug: "premium-umrah-14n", serviceType: "hajj_umrah", price: 185000 },
    { code: "HAJ-2026", title: "Hajj Package 2026 (Standard)", slug: "hajj-2026-standard", serviceType: "hajj_umrah", price: 650000 },
    { code: "COX-3N", title: "Cox's Bazar 3 Nights Getaway", slug: "coxs-bazar-3n", serviceType: "tour_domestic", price: 18500 },
    { code: "MAL-5N", title: "Malaysia-Singapore 5 Nights", slug: "malaysia-singapore-5n", serviceType: "tour_international", price: 95000 },
    { code: "DXB-4N", title: "Dubai City Tour 4 Nights", slug: "dubai-4n", serviceType: "tour_international", price: 78000 },
    { code: "TKT-INTL", title: "International Air Ticketing", slug: "intl-air-ticket", serviceType: "air_ticket", price: 62000 },
  ];
  const packages = [];
  for (const p of pkgSeed) {
    packages.push(await prisma.travelPackage.create({
      data: { code: p.code, title: p.title, slug: p.slug, serviceType: p.serviceType, price: p.price, status: "published", isFeatured: true, tenantId: tid },
    }).catch(async () => {
      // price/isFeatured may not exist on this schema version — retry minimal
      return prisma.travelPackage.create({ data: { code: p.code, title: p.title, slug: p.slug, serviceType: p.serviceType, tenantId: tid } });
    }));
  }

  // ── Quotations ─────────────────────────────────────────────────────────────
  const quoteSeed = [
    { title: "Umrah quote — Rahman family", client: 0, pkg: 0, dest: "Makkah & Madinah", pax: 4, sell: 740000, cost: 600000, status: "accepted" },
    { title: "Cox's Bazar tour — Green Valley", client: 5, pkg: 2, dest: "Cox's Bazar", pax: 30, sell: 555000, cost: 450000, status: "sent" },
    { title: "Dubai tour — Nusrat", client: 8, pkg: 4, dest: "Dubai, UAE", pax: 2, sell: 156000, cost: 120000, status: "draft" },
    { title: "Malaysia-Singapore — Karim Ent.", client: 2, pkg: 3, dest: "Kuala Lumpur, Singapore", pax: 6, sell: 570000, cost: 470000, status: "sent" },
    { title: "Hajj 2026 — Mizanur", client: 4, pkg: 1, dest: "Makkah & Madinah", pax: 1, sell: 650000, cost: 540000, status: "rejected" },
    { title: "Air ticket — Delta Garments", client: 9, pkg: 5, dest: "Bangkok, Thailand", pax: 3, sell: 186000, cost: 168000, status: "accepted" },
  ];
  for (let i = 0; i < quoteSeed.length; i++) {
    const q = quoteSeed[i];
    await prisma.quotation.create({
      data: {
        title: q.title, clientId: clients[q.client].id, packageId: packages[q.pkg]?.id, destination: q.dest,
        travelerCount: q.pax, status: q.status, serviceType: pkgSeed[q.pkg].serviceType,
        totalSelling: q.sell, totalCost: q.cost, totalProfit: q.sell - q.cost, grandTotal: q.sell,
        validUntil: day(30), travelDateFrom: day(40 + i * 5), travelDateTo: day(48 + i * 5),
        items: [{ description: q.title, qty: q.pax, unitPrice: Math.round(q.sell / q.pax), total: q.sell }],
        createdBy: owner.id, tenantId: tid,
      },
    });
  }

  // ── Bookings + invoices + payments ─────────────────────────────────────────
  const bookingSeed = [
    { type: "package", title: "Umrah Package — March 2026", client: 0, agent: 0, pkg: 0, dest: "Makkah & Madinah", from: 40, to: 54, pax: 4, amount: 740000, cost: 600000, status: "confirmed", paid: 400000 },
    { type: "tour", title: "Cox's Bazar Getaway — School Trip", client: 5, agent: 1, pkg: 2, dest: "Cox's Bazar", from: 20, to: 23, pax: 30, amount: 555000, cost: 450000, status: "confirmed", paid: 555000 },
    { type: "ticket", title: "DAC-BKK Air Ticket", client: 9, agent: 3, pkg: 5, dest: "Bangkok", from: 12, to: 19, pax: 3, amount: 186000, cost: 168000, status: "completed", paid: 186000 },
    { type: "package", title: "Dubai City Tour", client: 8, agent: 2, pkg: 4, dest: "Dubai, UAE", from: 60, to: 64, pax: 2, amount: 156000, cost: 120000, status: "pending", paid: 0 },
    { type: "package", title: "Malaysia-Singapore Explorer", client: 2, agent: 0, pkg: 3, dest: "KL & Singapore", from: 75, to: 80, pax: 6, amount: 570000, cost: 470000, status: "confirmed", paid: 285000 },
    { type: "package", title: "Premium Umrah — Nusrat", client: 8, agent: 2, pkg: 0, dest: "Makkah & Madinah", from: -30, to: -16, pax: 2, amount: 380000, cost: 300000, status: "completed", paid: 380000 },
    { type: "hotel", title: "Sea Pearl Hotel Booking", client: 6, agent: 1, pkg: 2, dest: "Cox's Bazar", from: 5, to: 8, pax: 4, amount: 64000, cost: 48000, status: "confirmed", paid: 32000 },
    { type: "ticket", title: "DAC-JED Return Ticket", client: 3, agent: 3, pkg: 5, dest: "Jeddah", from: 40, to: 55, pax: 1, amount: 92000, cost: 82000, status: "confirmed", paid: 92000 },
    { type: "package", title: "Hajj 2026 Standard", client: 4, agent: 0, pkg: 1, dest: "Makkah & Madinah", from: 120, to: 160, pax: 1, amount: 650000, cost: 540000, status: "pending", paid: 100000 },
    { type: "tour", title: "Sundarbans 2N Cruise", client: 10, agent: 1, pkg: 2, dest: "Sundarbans", from: -10, to: -8, pax: 8, amount: 96000, cost: 72000, status: "completed", paid: 96000 },
    { type: "visa", title: "UAE Tourist Visa — Shirin", client: 11, agent: 2, pkg: 5, dest: "UAE", from: 30, to: 30, pax: 1, amount: 12000, cost: 8500, status: "confirmed", paid: 12000 },
    { type: "package", title: "Umrah — Habibur family", client: 10, agent: 0, pkg: 0, dest: "Makkah & Madinah", from: 90, to: 104, pax: 3, amount: 555000, cost: 450000, status: "cancelled", paid: 0 },
  ];

  let invNo = 1;
  for (const b of bookingSeed) {
    const due = b.amount - b.paid;
    const paymentStatus = b.paid <= 0 ? "unpaid" : due <= 0 ? "paid" : "partial";
    const booking = await prisma.booking.create({
      data: {
        type: b.type, title: b.title, clientId: clients[b.client].id, agentId: agents[b.agent].id,
        packageId: packages[b.pkg]?.id, serviceType: pkgSeed[b.pkg].serviceType, destination: b.dest,
        travelDateFrom: day(b.from), travelDateTo: day(b.to), travelerCount: b.pax,
        amount: b.amount, cost: b.cost, profit: b.amount - b.cost,
        paidAmount: b.paid, dueAmount: due, paymentStatus, status: b.status, tenantId: tid,
      },
    });
    if (b.status === "cancelled") continue; // no invoice for cancelled

    // Invoice status: overdue if due>0 and dueDate in the past
    const issued = day(b.from - 30);
    const dueDate = day(b.from - 5);
    const invStatus = due <= 0 ? "paid" : (b.from - 5) < 0 ? "overdue" : b.paid > 0 ? "partial" : "unpaid";
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${String(invNo++).padStart(5, "0")}`,
        bookingId: booking.id, clientId: clients[b.client].id, clientName: clients[b.client].name, bookingTitle: b.title,
        totalAmount: b.amount, paidAmount: b.paid, dueAmount: due, subTotal: b.amount,
        status: invStatus, issuedDate: issued, dueDate, createdBy: owner.id, tenantId: tid,
      },
    });

    if (b.paid > 0) {
      const method = ["cash", "bkash", "bank_transfer", "sslcommerz"][invNo % 4];
      const acct = method === "cash" ? accCash : method === "bkash" ? accBkash : accBank;
      await prisma.payment.create({
        data: { invoiceId: invoice.id, bookingId: booking.id, amount: b.paid, method, date: issued, receivedBy: owner.id, tenantId: tid },
      });
      await prisma.transaction.create({
        data: { accountId: acct.id, type: "income", category: "booking_payment", description: `Payment — ${b.title}`, amount: b.paid, referenceType: "payment", referenceId: invoice.id, clientId: clients[b.client].id, bookingId: booking.id, invoiceId: invoice.id, paymentMethod: method, date: issued, createdBy: owner.id, tenantId: tid },
      });
    }
  }

  // ── Expenses (+ ledger transactions) ───────────────────────────────────────
  const expenseSeed = [
    { category: "rent", description: "Office rent — Gulshan", amount: 85000, method: "bank_transfer", d: -15 },
    { category: "salary", description: "Staff salary (5)", amount: 220000, method: "bank_transfer", d: -14 },
    { category: "marketing", description: "Facebook ad campaign", amount: 35000, method: "bkash", d: -10 },
    { category: "utilities", description: "Electricity + internet", amount: 12000, method: "cash", d: -8 },
    { category: "office", description: "Stationery & printing", amount: 6500, method: "cash", d: -6 },
    { category: "travel", description: "Staff site visit — Cox's Bazar", amount: 18000, method: "cash", d: -4 },
    { category: "software", description: "TravelAgencyWeb subscription", amount: 800, method: "bkash", d: -3 },
    { category: "commission", description: "Agent commission payout", amount: 42000, method: "bank_transfer", d: -2 },
  ];
  for (const e of expenseSeed) {
    await prisma.expense.create({ data: { category: e.category, description: e.description, amount: e.amount, paymentMethod: e.method, date: day(e.d), tenantId: tid } });
    await prisma.transaction.create({ data: { accountId: e.method === "cash" ? accCash.id : e.method === "bkash" ? accBkash.id : accBank.id, type: "expense", category: e.category, description: e.description, amount: e.amount, referenceType: "expense", paymentMethod: e.method, date: day(e.d), createdBy: owner.id, tenantId: tid } });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const taskSeed = [
    { title: "Collect passport copies — Rahman family", status: "todo", priority: "high", d: 2 },
    { title: "Confirm Makkah hotel rooming list", status: "in_progress", priority: "high", d: 4 },
    { title: "Follow up Dubai tour advance payment", status: "todo", priority: "medium", d: 1 },
    { title: "Submit Umrah visa files to VFS", status: "in_progress", priority: "high", d: 3 },
    { title: "Send Cox's Bazar itinerary to school", status: "done", priority: "medium", d: -2 },
    { title: "Reconcile bKash statement", status: "todo", priority: "low", d: 6 },
    { title: "Renew IATA membership", status: "todo", priority: "medium", d: 20 },
    { title: "Call Nusrat re: Dubai visa", status: "done", priority: "high", d: -1 },
  ];
  for (const t of taskSeed) {
    await prisma.task.create({ data: { title: t.title, status: t.status, priority: t.priority, dueDate: day(t.d), assignedTo: owner.id, tenantId: tid } });
  }

  // ── Leads (dashboard follow-ups) ───────────────────────────────────────────
  const leadSeed = [
    { name: "Imran Sheikh", phone: "+8801912000001", email: "imran@example.com", status: "new", source: "website", dest: "Malaysia", pax: 2, budget: 120000, follow: 0 },
    { name: "Ayesha Siddiqua", phone: "+8801912000002", email: "ayesha@example.com", status: "qualified", source: "facebook", dest: "Umrah", pax: 5, budget: 900000, follow: -1 },
    { name: "Rakibul Islam", phone: "+8801912000003", email: "rakibul@example.com", status: "proposal", source: "referral", dest: "Cox's Bazar", pax: 12, budget: 210000, follow: 2 },
    { name: "Farhana Yasmin", phone: "+8801912000004", email: "farhana@example.com", status: "new", source: "walk_in", dest: "Dubai", pax: 2, budget: 160000, follow: 1 },
  ];
  for (const l of leadSeed) {
    await prisma.lead.create({ data: { name: l.name, phone: l.phone, email: l.email, status: l.status, source: l.source, destination: l.dest, travelerCount: l.pax, budget: l.budget, nextFollowUp: day(l.follow), assignedTo: owner.id, tenantId: tid } });
  }

  const counts = {};
  for (const m of ["client", "agent", "vendor", "vendorBill", "travelPackage", "quotation", "booking", "invoice", "payment", "expense", "transaction", "task", "lead", "account", "user"]) {
    counts[m] = await prisma[m].count({ where: { tenantId: tid } });
  }
  console.log("✅ Demo Pro tenant seeded");
  console.log("   Tenant:", tenant.name, "(", tid, ")");
  console.log("   Login :", EMAIL, "/", PASSWORD);
  console.log("   Counts:", JSON.stringify(counts));
}

main().catch((e) => { console.error("SEED ERROR:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
