import { chromium } from "playwright";

const ROOT = "/var/www/hearth-core-app/.claude/worktrees/adoring-wiles-c6b642";
const OUT = `${ROOT}/docs/TravelAgencyWeb-Package-Organogram.pdf`;

const core = [
  "Dashboard", "Clients", "Vendors / Suppliers", "Quotations", "Bookings (any service)",
  "Packages & Services", "Invoices", "Payments", "Expenses", "Accounts & Ledger",
  "Reports", "Tasks", "Team & Roles", "Settings", "Subscription",
];
const advanced = [
  "CRM workspace", "Hajj & Umrah ops desk", "Air ticketing ops", "Visa tracker",
  "Tour & group / MICE", "Corporate travel", "Sub-agents & commission",
  "Documents & service desk", "HR & payroll", "Marketing & loyalty", "Website & CMS",
];

const workflow = [
  { n: "1", t: "Inquiry", d: "A customer asks a price. Save them in 10 seconds — it lands on your Dashboard to follow up." },
  { n: "2", t: "Client", d: "Store the customer: passport, NID, documents, history. Reuse forever." },
  { n: "3", t: "Quotation", d: "Send a professional price quote. Accept → convert to a booking in one click." },
  { n: "4", t: "Booking", d: "The confirmed deal — any service (Hajj, ticket, visa, tour, hotel). Selling price vs cost = profit." },
  { n: "5", t: "Invoice", d: "Bill the customer. Always see paid, partial, due and overdue." },
  { n: "6", t: "Payment", d: "Record cash / bKash / bank / card. Balance updates everywhere instantly." },
  { n: "7", t: "Accounts & Reports", d: "Real profit — receivables, payables, expenses, and business reports." },
];

const tiers = [
  { id: "basic", name: "Basic", price: "৳500", color: "#5F5E5A", bg: "#F1EFE8", who: "New / small agency getting organised.",
    adds: ["Full core: clients, bookings, quotations, invoices, payments, expenses, accounts, reports", "500 clients · 500 bookings · 3 team members", "Manual payment recording", "500 MB storage"] },
  { id: "pro", name: "Pro", price: "৳800", color: "#185FA5", bg: "#E6F1FB", who: "Growing agency reaching customers online.",
    adds: ["Everything in Basic, plus:", "1,000 clients · 1,000 bookings · 10 team members", "Email + SMS (500/mo) to customers", "SSLCommerz online payments", "Agent commission tracking", "1 custom domain · 2 GB storage"] },
  { id: "business", name: "Business", price: "৳1,500", color: "#854F0B", bg: "#FAEEDA", who: "Established agency wanting the full toolkit.",
    adds: ["Everything in Pro, plus ALL advanced modules:", "CRM workspace · Hajj/Umrah ops · Ticketing · Visa · Corporate · Sub-agents", "Website & CMS · Marketing & loyalty · HR & payroll", "WhatsApp + bKash · Refund system · Advanced analytics", "2,000 clients/bookings · 25 users · 2 domains · 10 GB · priority support"] },
  { id: "ult", name: "Unlimited", price: "৳5,000", color: "#3C3489", bg: "#EEEDFE", who: "Large / multi-branch agency at scale.",
    adds: ["Everything in Business, plus:", "Unlimited clients, bookings, users, domains, SMS & storage", "API access & custom integrations", "Full automation & workflow engine", "Multi-branch management · dedicated account manager"] },
];

const cmpRows = [
  ["Monthly price", "৳500", "৳800", "৳1,500", "৳5,000"],
  ["Clients", "500", "1,000", "2,000", "Unlimited"],
  ["Bookings", "500", "1,000", "2,000", "Unlimited"],
  ["Team members", "3", "10", "25", "Unlimited"],
  ["Custom domains", "—", "1", "2", "Unlimited"],
  ["Storage", "500 MB", "2 GB", "10 GB", "Unlimited"],
  ["Core (sales → money)", "y", "y", "y", "y"],
  ["Manual payments", "y", "y", "y", "y"],
  ["SSLCommerz gateway", "n", "y", "y", "y"],
  ["bKash gateway", "n", "n", "y", "y"],
  ["Refund system", "n", "n", "y", "y"],
  ["Email to customers", "n", "y", "y", "y"],
  ["SMS per month", "—", "500", "2,000", "Unlimited"],
  ["WhatsApp", "n", "n", "y", "y"],
  ["Daily WhatsApp summary to owner", "n", "n", "y", "y"],
  ["Automatic daily backup (data safety)", "y", "y", "y", "y"],
  ["Agent commission", "n", "y", "y", "y"],
  ["Advanced modules (CRM, Hajj, ticketing, visa, corporate)", "n", "n", "y", "y"],
  ["Website & CMS", "n", "n", "y", "y"],
  ["Marketing & loyalty", "n", "n", "y", "y"],
  ["Advanced analytics", "n", "n", "y", "y"],
  ["Priority support", "n", "n", "y", "y"],
  ["API access & integrations", "n", "n", "n", "y"],
  ["Automation & workflow engine", "n", "n", "n", "y"],
  ["Multi-branch management", "n", "n", "n", "y"],
];
const cell = (v) => v === "y" ? '<span class="yes">✓</span>' : v === "n" ? '<span class="no">✗</span>' : `<span>${v}</span>`;

const chip = (label, cls = "") => `<span class="chip ${cls}">${label}</span>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "DejaVu Sans", system-ui, sans-serif; color: #1f2430; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  .brand { color: #E8890C; }
  h1 { font-size: 34pt; margin: 0 0 6px; letter-spacing: -0.5px; }
  h2 { font-size: 16pt; margin: 0 0 3px; }
  .page { break-before: page; padding-top: 2mm; }
  .sub { color: #5f6472; }
  .rule { height: 4px; width: 64px; background: #E8890C; border-radius: 2px; margin: 16px 0; }
  .band { background: #fff8ef; border-left: 4px solid #E8890C; padding: 10px 14px; border-radius: 0 8px 8px 0; margin: 0 0 14px; }
  .band h2 { margin: 0; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: 9pt; margin-bottom: 12px; }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
  /* workflow */
  .flow { }
  .step { display: flex; gap: 12px; align-items: flex-start; break-inside: avoid; }
  .step .num { width: 30px; height: 30px; min-width: 30px; border-radius: 50%; background: #E8890C; color: #fff; font-weight: 700; font-size: 13pt; display: flex; align-items: center; justify-content: center; }
  .step .body { border: 0.5px solid #e3e3e3; border-radius: 10px; padding: 8px 12px; flex: 1; }
  .step .body b { font-size: 11.5pt; }
  .step .body p { margin: 2px 0 0; color: #4b5162; font-size: 9.5pt; }
  .conn { width: 30px; display: flex; justify-content: center; color: #E8890C; font-size: 14pt; line-height: 0.8; margin: 1px 0; }
  /* tree */
  .root { text-align: center; }
  .rootbox { display: inline-block; background: #E8890C; color: #fff; font-weight: 700; padding: 8px 22px; border-radius: 10px; font-size: 12pt; }
  .stem { width: 2px; height: 18px; background: #cfcfcf; margin: 0 auto; }
  .branchrow { display: flex; gap: 16px; }
  .branch { flex: 1; border: 1px solid #e3e3e3; border-radius: 12px; overflow: hidden; }
  .branch .head { padding: 8px 12px; font-weight: 700; color: #fff; font-size: 11pt; }
  .branch .items { padding: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 0.5px solid #dcdcd5; background: #faf9f5; border-radius: 999px; padding: 3px 10px; font-size: 9pt; }
  /* package build-up */
  .tier { border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; break-inside: avoid; }
  .tier .thead { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
  .tier .thead .nm { font-size: 14pt; font-weight: 700; }
  .tier .thead .pr { font-size: 12pt; font-weight: 700; }
  .tier .thead .who { color: #4b5162; font-size: 9pt; margin-left: auto; }
  .tier ul { margin: 0; padding-left: 18px; }
  .tier li { margin: 2px 0; font-size: 9.5pt; }
  /* table */
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { padding: 5px 8px; border-bottom: 0.5px solid #ececec; text-align: center; }
  th { background: #f6f4ee; font-weight: 700; }
  td:first-child, th:first-child { text-align: left; }
  .yes { color: #1d9e75; font-weight: 700; }
  .no { color: #cbb; }
  tbody tr:nth-child(even) { background: #faf9f5; }
  .foot { color: #9aa0ac; font-size: 8pt; margin-top: 10px; }
</style></head><body>

<div style="height:92vh; display:flex; flex-direction:column; justify-content:center; padding: 0 6mm;">
  <div style="width:54px;height:54px;border-radius:12px;background:#E8890C;color:#fff;font-weight:700;font-size:26pt;display:flex;align-items:center;justify-content:center;">H</div>
  <h1>Software organogram<br/>& package guide</h1>
  <div class="rule"></div>
  <p class="sub" style="font-size:12.5pt;max-width:460px;">How TravelAgencyWeb works, A to Z — and exactly what the Basic, Pro, Business and Unlimited packages unlock.</p>
  <p class="sub" style="margin-top:20px;"><strong class="brand">TravelAgencyWeb</strong> — travel agency software for Bangladesh · for agency owners</p>
</div>

<div class="page">
  <div class="band"><h2>1 · How the software works — A to Z</h2></div>
  <p class="sub" style="margin-top:-6px;margin-bottom:14px;">Every booking follows the same simple money trail. Available on <b>all packages</b>.</p>
  <div class="flow">
    ${workflow.map((s, i) => `
      <div class="step">
        <div class="num">${s.n}</div>
        <div class="body"><b>${s.t}</b><p>${s.d}</p></div>
      </div>
      ${i < workflow.length - 1 ? '<div class="conn">▼</div>' : ""}
    `).join("")}
  </div>
  <p class="sub" style="margin-top:14px;font-size:9.5pt;"><b>Supporting all steps:</b> Vendors/suppliers (your costs) · Expenses · Tasks · Team &amp; roles · Settings.</p>
  <div style="margin-top:14px;background:#E1F5EE;border:1px solid #5DCAA5;border-radius:10px;padding:12px 14px;">
    <div style="font-weight:700;color:#0F6E56;font-size:11pt;">🔔 Runs on autopilot every day</div>
    <ul style="margin:6px 0 0;padding-left:18px;font-size:9.5pt;color:#085041;">
      <li><b>Daily WhatsApp summary</b> to the owner every evening — today's bookings, payments received, outstanding dues, unpaid invoices and what needs action. <i>(Business &amp; Unlimited)</i></li>
      <li><b>Automatic daily backup</b> — every agency's data is safely backed up each day, no button to press. <i>(All packages)</i></li>
    </ul>
  </div>
</div>

<div class="page">
  <div class="band"><h2>2 · Software structure (module organogram)</h2></div>
  <div class="legend">
    <span><span class="dot" style="background:#1d9e75"></span> Core — every package</span>
    <span><span class="dot" style="background:#3C3489"></span> Advanced — Business &amp; Unlimited only</span>
  </div>
  <div class="root">
    <div class="rootbox">TravelAgencyWeb</div>
    <div class="stem"></div>
  </div>
  <div class="branchrow">
    <div class="branch">
      <div class="head" style="background:#1d9e75;">Core — all packages (${core.length})</div>
      <div class="items">${core.map((c) => chip(c)).join("")}</div>
    </div>
    <div class="branch">
      <div class="head" style="background:#3C3489;">Advanced — Business &amp; Unlimited (${advanced.length})</div>
      <div class="items">${advanced.map((a) => chip(a)).join("")}</div>
    </div>
  </div>
  <p class="sub" style="margin-top:14px;font-size:9.5pt;">Advanced modules are <b>off by default</b>. On Business &amp; Unlimited the owner switches on the ones they need in <b>Settings → Optional modules</b>. Any package can still <b>sell</b> Hajj, visa, tickets and tours as bookings — the advanced tiers add the dedicated operation desks and growth tools.</p>
</div>

<div class="page">
  <div class="band"><h2>3 · What each package unlocks</h2></div>
  <p class="sub" style="margin-top:-6px;margin-bottom:12px;">Each package includes everything in the one before it.</p>
  ${tiers.map((t) => `
    <div class="tier" style="background:${t.bg};">
      <div class="thead">
        <span class="nm" style="color:${t.color}">${t.name}</span>
        <span class="pr" style="color:${t.color}">${t.price}/mo</span>
        <span class="who">${t.who}</span>
      </div>
      <ul>${t.adds.map((a) => `<li>${a}</li>`).join("")}</ul>
    </div>
  `).join("")}
</div>

<div class="page">
  <div class="band"><h2>4 · Full feature comparison</h2></div>
  <table>
    <thead><tr><th>Feature</th><th>Basic</th><th>Pro</th><th>Business</th><th>Unlimited</th></tr></thead>
    <tbody>
      ${cmpRows.map((r) => `<tr><td>${r[0]}</td><td>${cell(r[1])}</td><td>${cell(r[2])}</td><td>${cell(r[3])}</td><td>${cell(r[4])}</td></tr>`).join("")}
    </tbody>
  </table>
  <p class="foot">Prices and limits reflect the current plan configuration. Advanced modules are opt-in per tenant.</p>
</div>

<div class="page">
  <div class="band"><h2>5 · Which package for whom</h2></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    ${tiers.map((t) => `
      <div style="border:1px solid #e3e3e3;border-left:4px solid ${t.color};border-radius:0 10px 10px 0;padding:12px 14px;">
        <div style="font-size:13pt;font-weight:700;color:${t.color}">${t.name} <span style="font-size:10pt;color:#5f6472">· ${t.price}/mo</span></div>
        <p style="margin:6px 0 0;font-size:10pt;color:#4b5162">${t.who}</p>
      </div>
    `).join("")}
  </div>
  <p class="sub" style="margin-top:16px;font-size:9.5pt;">Upgrade any time from <b>Settings → Subscription &amp; plan</b>. Upgrading unlocks higher limits and, on Business &amp; Unlimited, the advanced modules — nothing is re-entered.</p>
</div>

</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  margin: { top: "13mm", bottom: "14mm", left: "13mm", right: "13mm" },
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate: `<div style="width:100%;font-size:8px;color:#9aa0ac;padding:0 13mm;display:flex;justify-content:space-between;"><span>TravelAgencyWeb — Package organogram</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log("PDF written to", OUT);
