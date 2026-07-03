import fs from "fs";
import { chromium } from "playwright";

const ROOT = "/var/www/hearth-core-app/.claude/worktrees/adoring-wiles-c6b642";
const g = JSON.parse(fs.readFileSync(`${ROOT}/src/i18n/locales/en.json`, "utf8")).userGuide;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sectionOrder = [
  "getting-started", "daily-workflow", "language", "sidebar-map", "dashboard", "inquiry-followup",
  "clients", "vendors", "corporate", "quotations", "packages", "bookings",
  "invoices", "payments", "expenses", "accounts", "reports", "tasks", "documents",
  "team", "organization", "subscription", "settings",
  "agents", "operations", "hajj", "website", "notifications", "portal",
];
const ADVANCED = new Set(["agents", "operations", "hajj", "website", "notifications", "portal", "corporate"]);

const stepsHtml = (arr) => `<ol>${arr.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
const tipsHtml = (arr) => arr?.length ? `<div class="tips"><div class="tips-h">Tips</div><ul>${arr.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : "";

const sectionsHtml = sectionOrder.map((id, i) => {
  const s = g.sections[id];
  if (!s) return "";
  const badge = ADVANCED.has(id) ? `<span class="badge">Business & Ultimate</span>` : "";
  return `<section class="sec">
    <h2><span class="num">${i + 1}</span>${esc(s.title)} ${badge}</h2>
    <p class="intro">${esc(s.intro)}</p>
    ${stepsHtml(s.steps)}
    ${tipsHtml(s.tips)}
  </section>`;
}).join("");

const phasesHtml = g.workflow.phases.map((p, i) =>
  `<div class="phase"><h3><span class="num sm">${i + 1}</span>${esc(p.title)}</h3><ol>${p.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`
).join("");

const pillarsHtml = g.threePillars.items.map((p) =>
  `<div class="pillar"><div class="pillar-t">${esc(p.title)}</div><div class="pillar-d">${esc(p.desc)}</div></div>`
).join("");

const videosHtml = g.videoTutorials.items.map((v) =>
  `<div class="vid"><span class="vic">▶</span><div><div class="vid-t">${esc(v.title)} <span class="dur">${esc(v.duration)}</span></div><div class="vid-d">${esc(v.desc)}</div></div></div>`
).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "DejaVu Sans", system-ui, sans-serif; color: #1f2430; font-size: 10.5pt; line-height: 1.55; margin: 0; }
  .brand { color: #E8890C; }
  .cover { height: 96vh; display: flex; flex-direction: column; justify-content: center; padding: 0 8mm; }
  .cover .logo { width: 54px; height: 54px; border-radius: 12px; background: #E8890C; color: #fff; font-weight: 700; font-size: 26pt; display: flex; align-items: center; justify-content: center; }
  .cover h1 { font-size: 40pt; margin: 18px 0 6px; letter-spacing: -0.5px; }
  .cover .sub { font-size: 13pt; color: #4b5162; max-width: 460px; }
  .cover .meta { margin-top: 26px; color: #6b7180; font-size: 10pt; }
  .cover .rule { height: 4px; width: 70px; background: #E8890C; border-radius: 2px; margin: 22px 0; }
  h2 { font-size: 15pt; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
  h3 { font-size: 11.5pt; margin: 12px 0 4px; display: flex; align-items: center; gap: 7px; }
  .num { background: #E8890C; color: #fff; width: 22px; height: 22px; min-width: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 700; }
  .num.sm { width: 18px; height: 18px; min-width: 18px; font-size: 9pt; }
  .badge { font-size: 7.5pt; background: #fde9cf; color: #9a5a05; padding: 2px 8px; border-radius: 10px; font-weight: 600; vertical-align: middle; }
  .intro { color: #4b5162; margin: 0 0 6px; }
  ol, ul { margin: 4px 0 0; padding-left: 20px; }
  li { margin: 2.5px 0; }
  .tips { background: #fff8ef; border: 0.5px solid #f4d9b3; border-radius: 8px; padding: 8px 12px; margin-top: 8px; }
  .tips-h { font-weight: 700; color: #9a5a05; font-size: 9pt; margin-bottom: 2px; }
  .tips ul { padding-left: 18px; }
  .sec { padding: 12px 0; border-top: 0.5px solid #ececec; break-inside: avoid; }
  .h-band { background: #fff8ef; border-left: 4px solid #E8890C; padding: 12px 14px; border-radius: 0 8px 8px 0; margin: 6px 0 14px; }
  .h-band h2 { margin: 0 0 4px; }
  .phase { margin-bottom: 10px; break-inside: avoid; }
  .pillars { display: flex; gap: 10px; }
  .pillar { flex: 1; border: 0.5px solid #e3e3e3; border-radius: 8px; padding: 10px; }
  .pillar-t { font-weight: 700; font-size: 10pt; margin-bottom: 3px; }
  .pillar-d { color: #4b5162; font-size: 9.5pt; }
  .vids { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .vid { display: flex; gap: 8px; border: 0.5px solid #e3e3e3; border-radius: 8px; padding: 8px 10px; break-inside: avoid; }
  .vic { color: #E8890C; font-size: 12pt; }
  .vid-t { font-weight: 700; font-size: 9.5pt; }
  .vid-d { color: #4b5162; font-size: 9pt; }
  .dur { color: #9a5a05; background: #fde9cf; border-radius: 8px; padding: 0 6px; font-size: 7.5pt; font-weight: 600; }
  .page-h { font-size: 18pt; margin: 0 0 2px; }
  .page-sub { color: #6b7180; margin: 0 0 12px; }
  .section-break { break-before: page; padding-top: 4mm; }
</style></head><body>

<div class="cover">
  <div class="logo">H</div>
  <h1>${esc(g.title)}</h1>
  <div class="rule"></div>
  <div class="sub">${esc(g.subtitle)}</div>
  <div class="meta"><strong class="brand">TravelAgencyWeb</strong> — travel agency software for Bangladesh<br/>
  This printable guide is in English. The same guide is inside the app in English and বাংলা (Settings → User Guide).</div>
</div>

<div class="section-break">
  <div class="h-band"><h2>${esc(g.quickStartVideo.title)} · ${esc(g.quickStartVideo.duration)}</h2><p class="intro" style="margin:0">${esc(g.quickStartVideo.subtitle)}</p></div>
  ${stepsHtml(g.quickStartVideo.steps)}
  <p class="intro" style="margin-top:8px; font-size:9pt">${esc(g.quickStartVideo.note)}</p>

  <div class="h-band" style="margin-top:18px"><h2>${esc(g.workflow.title)}</h2><p class="intro" style="margin:0">${esc(g.workflow.subtitle)}</p></div>
  ${phasesHtml}

  <div class="h-band" style="margin-top:18px"><h2>${esc(g.threePillars.title)}</h2><p class="intro" style="margin:0">${esc(g.threePillars.subtitle)}</p></div>
  <div class="pillars">${pillarsHtml}</div>

  <div class="h-band" style="margin-top:18px"><h2>${esc(g.videoTutorials.title)}</h2><p class="intro" style="margin:0">${esc(g.videoTutorials.subtitle)}</p></div>
  <div class="vids">${videosHtml}</div>
</div>

<div class="section-break">
  <h1 class="page-h brand">Module reference</h1>
  <p class="page-sub">Every part of the system, in order. Advanced modules are marked and require Business or Ultimate.</p>
  ${sectionsHtml}
</div>

</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
await page.pdf({
  path: `${ROOT}/docs/TravelAgencyWeb-User-Guide.pdf`,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" },
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate: `<div style="width:100%; font-size:8px; color:#9aa0ac; padding:0 14mm; display:flex; justify-content:space-between;"><span>TravelAgencyWeb — User Guide</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log("PDF written to docs/TravelAgencyWeb-User-Guide.pdf");
