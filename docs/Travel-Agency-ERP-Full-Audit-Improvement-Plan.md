# Travel Agency ERP — Full Audit & Improvement Plan

**Product:** TravelAgencyWeb (TAWSS) / Hearth Core App  
**Stack:** React 18 · Vite 5 · TypeScript · Express 4 · Prisma 5 · PostgreSQL 16  
**Audit basis:** Codebase review (Jun 2026), `docs/final-travel-saas-scenario.md`, `docs/api-endpoints.md`, live dev-environment verification, security review  
**Principle:** Extend the existing monorepo. No greenfield rewrite.

---

## How to use this document

Each ERP area follows the same structure:

1. **Current state** — what exists today in this repo  
2. **Problems found** — gaps, bugs, risks  
3. **Improvements / new features** — concrete, additive work  
4. **Priority** — P0 (critical) → P3 (nice-to-have)  
5. **Cursor AI implementation prompt** — copy-paste task for a Cloud Agent or local session  

Priorities assume a Bangladesh-focused travel-agency SaaS moving toward production.

---

## Summary matrix

| ERP area | Priority | Status |
|----------|----------|--------|
| Security & auth hardening | **P0** | Known vulnerabilities; fix before prod |
| SMS & notifications APIs | **P0** | Frontend built; backend missing |
| Client document upload | **P0** | Frontend calls missing endpoint |
| Hajj payment tenant isolation | **P0** | IDOR bug |
| CORS & local dev config | **P1** | Blocks dev without `.env` tweak |
| Packages & multi-service catalog | **P1** | Partial; vision in scenario doc |
| Admin plans/features persistence | **P1** | UI-only today |
| Website CMS gaps (blog, SEO, etc.) | **P2** | Not implemented |
| Service-specific ops (visa, ticketing) | **P2** | Future phases |
| B2B sub-agent portal | **P3** | Not started |
| Test & lint hygiene | **P1** | 1 test; ESLint fails |

---

## 1. Platform foundation & architecture

### 1. Current state

- Monorepo: frontend at repo root (`src/`), API in `backend/`, production compose in `app/docker-compose.yml`.
- Multi-tenant API: `tenantId` on most Prisma models; hostname routing via `src/lib/domainResolver.ts`.
- 69 agency pages, 15 admin pages, 7 marketing pages, 5 tenant site pages, 4 portal pages.
- 44 Prisma models; local dev uses `prisma db push`; Docker uses `prisma migrate deploy` (no migration history in repo).
- Docs live in `docs/`; root `README.md` is still a placeholder.

### 2. Problems found

- No standard `prisma/migrations/` — Docker `migrate deploy` may fail on fresh deploy.
- `docs/api-endpoints.md` is outdated (e.g. documents `PUT /api/tenants/:id`; actual API uses `PATCH /tenants/me`).
- `adminSubscriptionWorkflow` mounted twice (`/api/admin` and `/api/admin/subscription-workflow`).
- Additive-only rule from scenario doc not enforced in CI.

### 3. Improvements / new features

- Add baseline Prisma migration from current schema; keep `db push` for local dev only.
- Sync `docs/api-endpoints.md` with `backend/src/index.js` route mounts.
- Deduplicate admin workflow router mount.
- Replace root `README.md` with pointer to `docs/architecture.md`, `AGENTS.md`, and this plan.
- Add architecture diagram for tenant request flow (browser → Vite :8080 → API :4000 → Postgres).

### 4. Priority

**P1** (stability and onboarding); migration baseline is **P0** if Docker deploy is production path.

### 5. Cursor AI implementation prompt

```
@codebase
Audit backend/src/index.js route mounts and generate an updated docs/api-endpoints.md that matches reality.
Create an initial Prisma migration from backend/prisma/schema.prisma without dropping data.
Remove the duplicate mount of adminSubscriptionWorkflow if both paths are identical.
Update README.md with links to docs/architecture.md, AGENTS.md, and this improvement plan.
Do not change API behavior—documentation and migration scaffolding only.
```

---

## 2. Authentication & identity

### 2. Current state

- JWT auth (`backend/src/routes/auth.js`): login, register (auto-approved + 3-day trial), forgot/reset password, email verification.
- Roles: `super_admin`, `tenant_owner`, `manager`, `sales_agent`, `accountant`, `operations`.
- Frontend: `src/pages/Login.tsx`, `Register.tsx`, `AuthContext.tsx`; tokens in `localStorage`.
- Portal uses separate JWT audience (`backend/src/routes/portal.js`).

### 2. Problems found

- **P0:** `JWT_SECRET` falls back to `"dev-secret"` in `auth.js` and `portalAuth.js`.
- **P0:** `seed.js` hardcodes super-admin password and real email; prints credentials to stdout.
- **P0:** New team members get password `changeme123` (`tenants.js`) with no forced reset.
- No rate limiting on login, register, forgot-password, portal magic-link.
- Weak password policy (6 chars on reset only; register unchecked).
- JWT in `localStorage` — XSS steals 7-day sessions.
- CORS defaults include `localhost:5173` but Vite runs on **8080**.

### 3. Improvements / new features

- Fail fast on startup if `JWT_SECRET` missing or weak in production.
- Dev-only seed: read admin password from env; never log passwords.
- Team invite: random temp password + email with reset link; block `changeme123`.
- Add `express-rate-limit` on auth and public POST routes.
- Enforce password rules (min 10 chars + complexity) on register and reset.
- Add `http://localhost:8080` to default CORS origins.
- (Phase 2) HttpOnly cookie option for agency JWT.

### 4. Priority

**P0** — secret fallback, seed credentials, default team password.  
**P1** — rate limiting, CORS, password policy.

### 5. Cursor AI implementation prompt

```
@codebase
Harden authentication without breaking existing login flow:

1. In backend/src/middleware/auth.js and portalAuth.js, remove the "dev-secret" fallback in production; throw on boot if JWT_SECRET is missing when NODE_ENV=production.
2. Update backend/prisma/seed.js to use process.env.SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (dev only); remove console.log of passwords.
3. In backend/src/routes/tenants.js POST /me/members, generate a random temporary password and trigger password-reset email instead of "changeme123".
4. Add express-rate-limit to /api/auth/* and /api/portal/auth/* (e.g. 10 req/min per IP).
5. Add http://localhost:8080 to default CORS in backend/src/index.js.

Add minimal tests for login 401 and rate-limit 429. Match existing Express/Prisma patterns.
```

---

## 3. Multi-tenancy & onboarding

### 2. Current state

- `Tenant` model with `slug`, subscription fields, `websiteConfig` JSON.
- Register creates tenant + owner in one step; `Onboarding.tsx` for post-signup.
- Tenant self-update allowlists fields (`tenants.js`); super-admin manages tenants via `/api/admin/tenants`.
- Domain resolution: slug subdomains + custom domains (`TenantDomain`).

### 2. Problems found

- Onboarding does not persist “selected service types” (Hajj, Visa, Tour, etc.) per `final-travel-saas-scenario.md`.
- No `enabledModules` or `serviceTypes` on `Tenant` — sidebar shows all modules regardless of agency focus.
- Tenant notes field overloaded for JSON config in some code paths.

### 3. Improvements / new features

- Add `Tenant.enabledServiceTypes String[]` (nullable, default all) via additive Prisma migration.
- Onboarding wizard: save selected services → filter sidebar (`AppSidebar.tsx`) and dashboard widgets.
- Expose service types on `GET /api/tenants/me` and `PATCH /api/tenants/me`.
- Super-admin tenant detail: show/edit enabled modules.

### 4. Priority

**P1** — aligns product with multi-service vision without breaking current tenants (default = all enabled).

### 5. Cursor AI implementation prompt

```
@codebase
Implement tenant service-type preferences per docs/final-travel-saas-scenario.md:

1. Add optional enabledServiceTypes String[] to Tenant in schema.prisma (default empty = all modules visible for backward compatibility).
2. Extend PATCH /api/tenants/me allowlist and GET response.
3. Update src/pages/Onboarding.tsx to let user pick service types and save via tenantApi.
4. Filter src/components/AppSidebar.tsx nav items using enabledServiceTypes and existing permissions.ts.

Use additive migration only. Seed existing tenants with empty array (show all). Include Bangla labels where i18n keys already exist.
```

---

## 4. CRM — leads & pipeline

### 1. Current state

- `Lead`, `LeadActivity` models; full CRUD at `/api/leads`.
- Pages: `Leads.tsx` (30 KB), `LeadDetails.tsx` (26 KB).
- Features: status updates, activities, convert-to-client, duplicate check, quotation linkage.

### 2. Problems found

- No automated follow-up reminders (cron or notification) despite `nextFollowUp` field.
- Lead source reporting exists in UI reports but limited backend aggregation.
- No Facebook/WhatsApp lead capture integration (scenario doc requirement).
- ESLint `any` types throughout lead pages.

### 3. Improvements / new features

- Daily cron job: leads with `nextFollowUp` today → in-app notification + optional SMS.
- `GET /api/leads/pipeline-summary` for kanban counts by status.
- Webhook or public `POST /api/public/:slug/inquiry` for website lead forms (distinct from contact).
- Lead list: filter by source, assigned agent, overdue follow-ups.

### 4. Priority

**P2** — high business value; core CRUD already works.

### 5. Cursor AI implementation prompt

```
@codebase
Extend the leads module:

1. Add GET /api/leads/pipeline-summary returning counts grouped by status for req.tenantId.
2. Add a follow-up reminder job in backend/src/routes/cron.js (reuse CRON_SECRET) that finds leads where nextFollowUp is today and creates audit log entries; stub hook for future Notification model.
3. On Leads.tsx add filters for source, assignedTo, and overdue follow-ups using existing API patterns.

Do not break convert-to-client or quotation links. Tenant-scope all queries.
```

---

## 5. CRM — clients & agents

### 1. Current state

- `Client`, `ClientDocument`, `Agent` models.
- Clients: CRUD + bookings/invoices/payments sub-routes.
- `Agents.tsx` is a 243-byte `CrudPage` wrapper — functional but minimal.
- `ClientProfile.tsx` supports rich client fields (passport, NID, emergency contact).

### 2. Problems found

- **P0:** `clientApi.uploadDocument()` posts to `POST /api/clients/:id/documents` — **route does not exist** in `clients.js`.
- `ClientDocument` model exists but no upload/delete API.
- No passport expiry alert (Bangladesh market requirement in scenario doc).
- Agent commission tracking not modeled.

### 3. Improvements / new features

- Implement client document upload (multer, same pattern as `bookings.js` documents).
- `GET/POST/DELETE /api/clients/:id/documents` with tenant checks.
- Passport expiry: optional cron + dashboard widget for clients expiring in 90 days.
- Agent commission: add `Agent.commissionRate` (nullable Float) and booking-level `agentCommission` snapshot.

### 4. Priority

**P0** — client document upload (broken feature).  
**P2** — passport alerts, commissions.

### 5. Cursor AI implementation prompt

```
@codebase
Fix client document uploads end-to-end:

1. In backend/src/routes/clients.js add GET/POST/DELETE /:id/documents using multer (mirror bookings document routes).
2. Validate tenantId on client and document records.
3. Store files under UPLOAD_DIR/clients/{clientId}/ with URLs served via existing /uploads static (or document signed path in phase 2).
4. Wire src/lib/api.ts clientApi.uploadDocument to the new endpoint and verify ClientProfile.tsx upload UI works.

Add one integration test or manual test steps in PR description.
```

---

## 6. Sales — quotations

### 1. Current state

- `Quotation`, `QuotationVersion` with JSON items/itinerary.
- Pages: `Quotations.tsx`, `QuotationBuilder.tsx` (37 KB), `QuotationDetails.tsx`, `QuotationPrint.tsx`.
- API: CRUD, status, versions, duplicate, convert-to-booking.

### 2. Problems found

- Package linkage via `TravelPackage` exists but not all service types have templates.
- Print view may not match backend versioning on concurrent edits.
- No e-signature or customer approval link (portal/public).

### 3. Improvements / new features

- Quotation public share link: `GET /api/public/quotation/:token` (read-only, expiring token).
- Auto-fill from `TravelPackage` on create (partially exists — verify all child relations).
- Status workflow: `sent` → `viewed` → `accepted` / `rejected` with audit trail.
- PDF export server-side or improve `QuotationPrint.tsx` print CSS.

### 4. Priority

**P2** — core flow works; share/approve adds sales velocity.

### 5. Cursor AI implementation prompt

```
@codebase
Add quotation customer approval flow:

1. Add optional shareToken and shareExpiry to Quotation (nullable, additive migration).
2. POST /api/quotations/:id/share generates token; GET /api/public/quotation/:token returns sanitized quotation (no internal cost fields).
3. POST /api/public/quotation/:token/respond with accept|reject updates status and audit log.
4. Add "Copy customer link" button on QuotationDetails.tsx.

Reuse public.js patterns. Hide cost/profit from public response.
```

---

## 7. Services — packages & catalog (`TravelPackage`)

### 1. Current state

- `TravelPackage` + days, inclusions, pricing, media child models.
- CRUD at `/api/travel-packages` with nested child routes (`crud.js` factory).
- Page: `Packages.tsx` (31 KB); public feed via `/api/public/:slug/packages`.
- `serviceType` field supports hajj_umrah, tour_domestic, etc. (`src/lib/serviceTypes.ts`).

### 2. Problems found

- Scenario doc wants unified “Packages & Services” — `HajjUmrah.tsx` (62 KB) still separate from catalog.
- Missing: seasonal pricing, visa requirements, cancellation rules as structured fields (partially in JSON/notes).
- No `/api/packages` alias (docs gap only).
- Featured package selection exists (`isFeatured`) but website sections may not always pull it.

### 3. Improvements / new features

- Phase 2 UX: merge Hajj entry into Packages with service-type filter tabs (keep Hajj API routes).
- Add nullable fields: `visaRequired`, `cancellationPolicy`, `seasonalPricing Json?` on `TravelPackage`.
- Website `featured-packages` section: always source from `isFeatured` published packages.
- Package duplicate + archive bulk actions on `Packages.tsx`.

### 4. Priority

**P1** — central to multi-service strategy.  
**P2** — seasonal pricing and policy fields.

### 5. Cursor AI implementation prompt

```
@codebase
Extend TravelPackage per docs/final-travel-saas-scenario.md Phase 1:

1. Add nullable visaRequired Boolean, cancellationPolicy String?, seasonalPricing Json? to TravelPackage in schema.prisma.
2. Update crud.js travel package normalizeTravelPackagePayload to accept these fields.
3. Update Packages.tsx form and publicApi package cards to show cancellation and visa badge.
4. Ensure /api/public/:slug/packages returns only status=published packages with isFeatured flag.

Additive migration only. Do not remove HajjUmrah.tsx yet—add cross-links from Packages page.
```

---

## 8. Operations — bookings

### 1. Current state

- Rich `Booking` model with segments, travelers, checklist, timeline, documents.
- `Bookings.tsx` (35 KB), `BookingDetails.tsx` (37 KB).
- Convert from quotation; invoice generation; payment status tracking.

### 2. Problems found

- Service-specific tabs (visa, ticketing, hotel) not in schema — only generic segments.
- Document uploads lack MIME/size validation; files publicly served under `/uploads`.
- No cancellation/refund workflow beyond invoice refunds.
- Booking list performance may degrade without pagination (loads all for tenant).

### 3. Improvements / new features

- Add `bookingType` operational extensions as JSON `serviceDetails` (phase 1) before new tables.
- Upload hardening: allowlist images/PDF, 5 MB max, random filenames (already partial).
- `PATCH /api/bookings/:id/cancel` with reason → cascade invoice status.
- Paginated `GET /api/bookings?page=&limit=&status=`.

### 4. Priority

**P1** — upload security.  
**P2** — pagination, cancellation flow.  
**P3** — service-specific sub-modules (Phase 3 in scenario doc).

### 5. Cursor AI implementation prompt

```
@codebase
Harden booking file uploads and add pagination:

1. Create backend/src/middleware/upload.js with multer fileFilter (pdf, jpeg, png) and 5MB limit.
2. Use it in bookings.js and invoices.js proof upload routes.
3. Add query params page, limit, status, clientId to GET /api/bookings with total count in response.
4. Update Bookings.tsx to use paginated API with existing table UI patterns.

Do not break BookingDetails document list. Tenant-scope all queries.
```

---

## 9. Hajj & Umrah operations

### 1. Current state

- `HajjPackage`, `HajjGroup`, `HajjPilgrim`, `HajjPilgrimPayment` models.
- `HajjUmrah.tsx` (62 KB) — largest page; legacy route `HajjOperationsLegacy.tsx` still wired.
- API: `/api/hajj/*` for packages, groups, pilgrims, payments.

### 2. Problems found

- **P0 IDOR:** `GET/POST /api/hajj/pilgrims/:id/payments` does not verify `tenantId` on pilgrim.
- Some Hajj routes use `updateMany` with tenant check but `findFirst` after without tenant in one path.
- Duplicate UX: unified packages vision vs standalone Hajj menu.
- Rooming, mahram, visa status fields exist on pilgrim but no dedicated visa workflow.

### 3. Improvements / new features

- Fix tenant scoping on all pilgrim payment routes immediately.
- Deprecate `HajjOperationsLegacy.tsx` behind feature flag; redirect to `/hajj-umrah`.
- Link `HajjPackage` to `TravelPackage` optional foreign key for catalog unity (nullable).
- Installment schedule view on pilgrim detail (uses existing `HajjPilgrimPayment`).

### 4. Priority

**P0** — IDOR fix.  
**P1** — navigation cleanup per scenario Phase 2.  
**P2** — TravelPackage linkage.

### 5. Cursor AI implementation prompt

```
@codebase
Fix Hajj pilgrim payment tenant isolation (security):

1. In backend/src/routes/hajj.js, add ensurePilgrimBelongsToTenant helper (like ensureBookingExists in bookings.js).
2. Apply to GET/POST /pilgrims/:id/payments and any route using pilgrimId without tenantId check.
3. Return 404 if pilgrim not found for req.tenantId.
4. Add a minimal test or script that proves tenant A cannot read tenant B pilgrim payments.

Then update App.tsx to redirect /legacy/hajj-operations to /hajj-umrah with a deprecation comment.
```

---

## 10. Finance — invoices & payments

### 1. Current state

- `Invoice`, `Payment`, `InvoiceRefund`, `InvoiceAuditEvent`.
- `Invoices.tsx` (51 KB) — second-largest page; handles payments UI too.
- Gateways: SSLCommerz, bKash, COD via `/api/payments`; manual proof upload.
- Tenant payment requests for subscription (`PaymentRequest`).

### 2. Problems found

- Hardcoded bKash account in `paymentRequests.js` / `adminSubscriptionWorkflow.js` defaults.
- Payment proof files on public `/uploads` static.
- No installment plan model (scenario doc Bangladesh requirement).
- `Invoices.tsx` duplicates `/payments` route in App — same component.

### 3. Improvements / new features

- Move default payment method config to DB only (`PaymentMethodConfig`); remove hardcoded phone numbers from code.
- Installment schedule: `InvoiceInstallment` model or JSON array on invoice.
- Authenticated download for payment proofs and invoice attachments.
- Split payments into dedicated page when invoice list grows (optional).

### 4. Priority

**P1** — remove hardcoded payment credentials from source.  
**P2** — installments, secured uploads.

### 5. Cursor AI implementation prompt

```
@codebase
Remove hardcoded bKash defaults from backend routes:

1. In paymentRequests.js and adminSubscriptionWorkflow.js, load payment methods from PaymentMethodConfig via Prisma only; if table empty, seed from env vars BKASH_ACCOUNT_NAME, BKASH_ACCOUNT_NUMBER (not literals in code).
2. Document required env vars in docs/environment-variables.md.
3. Verify AdminPayments and SettingsBilling still show methods from GET /api/payment-requests/methods.

No breaking change to API response shape.
```

---

## 11. Finance — accounts, ledger & expenses

### 1. Current state

- `Account`, `Transaction`, `Expense` models.
- `Accounts.tsx` with tab components (ledger, receivables, payables, profitability).
- APIs: `/api/accounts`, `/api/transactions`, `/api/expenses` with profitability and ledger endpoints.

### 2. Problems found

- Agent commission not flowing into transactions automatically.
- Expense approval workflow exists but no notification on pending approval.
- Reports mix client-side aggregation and API — verify numbers match backend profitability endpoint.
- No multi-currency beyond `TravelPackage.currency` default BDT.

### 3. Improvements / new features

- On payment received: auto-create `Transaction` ledger entry (verify idempotency).
- Expense approve/reject → notify tenant_owner via notification API (once built).
- `GET /api/accounts/export?format=csv` for accountant role.
- Tenant-level `currency` on Tenant (already exists) — use consistently in dashboard.

### 4. Priority

**P2** — automation and export.

### 5. Cursor AI implementation prompt

```
@codebase
Ensure payment recording creates ledger transactions:

1. Audit backend/src/routes/invoices.js POST /:id/payments — if Transaction is not created, add creation in same prisma.$transaction block.
2. Link transaction.referenceId to payment.id and referenceType 'payment'.
3. Add GET /api/accounts/export?from=&to= returning CSV for tenant transactions (requirePermission accounts export).
4. Add export button to components/accounts/LedgerTab.tsx using existing DataExport patterns.

Keep backward compatibility; skip duplicate transactions if payment already has linked transaction.
```

---

## 12. Vendor management & payables

### 1. Current state

- `Vendor`, `VendorBill`, `VendorBillPayment`, `VendorNote`.
- `Vendors.tsx`, `VendorDetails.tsx`; payables report at `/api/vendors/reports/payables`.
- Portal: suppliers see bills via email magic link (`/api/portal/purchase-orders`).

### 2. Problems found

- Portal matches vendor by email globally — cross-tenant if same email used (privacy edge case).
- No vendor performance scorecard in reports UI.
- Booking `supplierName` text fields not always linked to `Vendor` record.

### 3. Improvements / new features

- Booking segment: optional `vendorId` FK instead of free-text supplier only.
- Vendor portal: scope email lookup by tenant when magic link includes tenant hint.
- Payables aging report: 30/60/90 day buckets in `VendorReport.tsx`.

### 4. Priority

**P2**

### 5. Cursor AI implementation prompt

```
@codebase
Improve vendor linkage on bookings:

1. Add optional vendorId to BookingSegment in schema.prisma (nullable FK to Vendor).
2. Update bookings segment POST/PATCH to accept vendorId with tenant validation.
3. On BookingDetails.tsx segment form, add vendor select from vendorApi.list().
4. Add payables aging buckets to components/reports/VendorReport.tsx using existing /api/vendors/reports/payables data.

Additive migration only.
```

---

## 13. Subscription & billing (tenant)

### 1. Current state

- `Subscription`, `PaymentRequest`, `SubscriptionHistory`, `PaymentMethodConfig`.
- Pages: `Subscriptions.tsx`, `SettingsBilling.tsx`.
- Admin approval workflow via `adminSubscriptionWorkflow.js`.
- Cron: `/api/cron/process-expiry` for trial/expiry (CRON_SECRET).

### 2. Problems found

- Cron secret can be passed as query param — leaks in logs.
- Plan limits enforced in `checkPlanLimit` middleware but plans defined in frontend `plans.ts` only.
- Feature gates (`FeatureGate.tsx`) use frontend `features.ts` — not server-enforced.

### 3. Improvements / new features

- Remove `req.query.secret` from cron verifier; header only.
- Sync plan limits: store in DB or JSON config editable from AdminPlans (see area 19).
- Server-side `checkPlanLimit` and `requireFeature('hajj_umrah')` middleware mirroring frontend gates.
- Tenant billing: show subscription history from `GET /api/payment-requests` + admin history endpoint.

### 4. Priority

**P1** — server-side feature enforcement prevents plan bypass.  
**P2** — cron secret query removal.

### 5. Cursor AI implementation prompt

```
@codebase
Add server-side feature gating:

1. Create backend/src/middleware/features.js reading plan limits from a new PlatformConfig model OR from PaymentMethodConfig-style JSON file loaded at boot (start simple: extend plans from src/lib/plans.ts duplicated to backend/config/plans.json).
2. Add requireFeature('module_name') middleware used on /api/hajj routes and /api/website publish routes.
3. Map tenant.subscriptionPlan to allowed modules matching src/lib/features.ts DEFAULT_FEATURE_MAP.
4. Return 403 with code PLAN_LIMIT when blocked.

Do not break enterprise tenants. Default to current behavior for unknown plans.
```

---

## 14. Website builder & public CMS

### 1. Current state

- Website config + sections API (`/api/website`).
- Pages: `WebsiteCustomizer.tsx` (49 KB), `WebsiteBuilderHome.tsx`, `WebsitePublishGuide.tsx`.
- Public API: `/api/public/:slug/website`, domain variants.
- Templates: `TravelAgencyTemplate`, `HajjUmrahTemplate`, `TourPackagesTemplate`.

### 2. Problems found

- **Missing APIs:** `/api/blogs`, `/api/testimonials`, `/api/team`, `/api/seo`, `/api/pages` (documented as gaps).
- `SiteHome.tsx` only 762 bytes — thin wrapper.
- Website asset upload works; no image optimization.
- Admin CMS sections stored in tenant `websiteConfig` / sections table — verify backup includes this.

### 3. Improvements / new features

- Phase 1: `WebsitePost` model (blog) with slug, title, body, publishedAt, tenantId.
- `WebsiteTestimonial` model for public site.
- SEO fields on tenant: `metaTitle`, `metaDescription`, `ogImage` in `websiteConfig` or columns.
- Preview mode: `?preview=token` for unpublished drafts.

### 4. Priority

**P2** — blog/testimonials/SEO per scenario nav.  
**P1** — publish flow regression tests before prod.

### 5. Cursor AI implementation prompt

```
@codebase
Add minimal blog CMS for tenant websites:

1. Add WebsitePost model (id, tenantId, slug, title, excerpt, body, status draft|published, publishedAt, createdAt).
2. CRUD at /api/website/posts with requirePermission website edit/view.
3. GET /api/public/:slug/posts and GET /api/public/:slug/posts/:postSlug for published only.
4. Add "Blog" section type to WebsiteCustomizer and SiteHome listing.

Follow existing website sections patterns. Additive schema only.
```

---

## 15. Marketing site & lead capture

### 1. Current state

- Marketing pages: Features, Pricing, Demo, Contact, FAQ, Privacy, Terms.
- Public forms: `POST /api/contact`, `POST /api/demo-requests`.
- `Index.tsx` platform landing; hostname routing for tenant vs marketing.

### 2. Problems found

- No rate limiting on contact/demo — spam risk.
- Demo and contact stored but no admin UI to manage submissions (only DB).
- Pricing page plan data may drift from `plans.ts` and admin plans page.

### 3. Improvements / new features

- Super-admin: `AdminInquiries.tsx` for `ContactSubmission` + `DemoRequest` lists.
- Rate limit public forms; optional honeypot field.
- Single source of truth for plan pricing: export from `plans.ts` or move to DB.

### 4. Priority

**P2**

### 5. Cursor AI implementation prompt

```
@codebase
Add super-admin inquiry inbox:

1. Add GET /api/admin/contact-submissions and GET /api/admin/demo-requests with pagination (super_admin only).
2. Create src/pages/admin/AdminInquiries.tsx with tabs for contact vs demo, wired to AdminSidebar.
3. Add rate limiting to contact.js and demo.js (5 posts/hour per IP).

Match AdminAuditLog.tsx table patterns.
```

---

## 16. Customer & supplier portal

### 1. Current state

- Magic-link auth: `/api/portal/auth/request-link`, `/verify`.
- Pages: `src/portal/` — login, verify, my bookings, purchase orders.
- Separate JWT audience from agency app.

### 2. Problems found

- Portal email classification is global — same email across tenants sees all matching bookings.
- No booking detail view in portal — list only.
- Magic links in email depend on SMTP; console fallback in dev only.

### 3. Improvements / new features

- Portal booking detail: `GET /api/portal/bookings/:id` scoped to client email.
- Optional tenant slug in magic link: `portal.travelagencyweb.com/{tenantSlug}/login`.
- Download invoice PDF from portal for paid invoices.

### 4. Priority

**P2**

### 5. Cursor AI implementation prompt

```
@codebase
Extend customer portal:

1. Add GET /api/portal/bookings/:id returning booking detail if client.email matches portal user email.
2. Create src/portal/pages/BookingDetail.tsx and link from MyBookings.tsx.
3. Include invoice summary (amount, due, status) without internal cost fields.

Reuse portalAuthenticate middleware. No agency JWT accepted on portal routes.
```

---

## 17. Notifications & communications (SMS, email, WhatsApp)

### 1. Current state

- Email service with SMTP + console fallback (`emailService.js`).
- SMS service exists (`smsService.js`) but **no HTTP routes mounted**.
- Frontend: `smsApi.ts`, `smsTemplateApi.ts`, `AdminSmsTemplates.tsx`, `AdminSmsLogs.tsx`, `notificationApi.ts`, `NotificationBell.tsx`.
- WhatsApp/Telegram: console/provider stubs in services.

### 2. Problems found

- **P0:** Frontend calls `/api/sms/*`, `/api/notifications/*`, `/api/admin/notifications/*` — **none exist in `index.js`**.
- No `Notification`, `SmsLog`, `SmsTemplate` Prisma models.
- `notificationEngine.ts` is client-side only — data lost on refresh.
- SMS automation in `Bookings.tsx` / `Invoices.tsx` will fail at runtime.

### 3. Improvements / new features

- Add models: `Notification`, `SmsTemplate`, `SmsLog`.
- Mount `/api/sms` routes matching `smsApi.ts` and `smsTemplateApi.ts` contracts.
- Mount `/api/notifications` for tenant users; `/api/admin/notifications` for super-admin.
- Wire `notificationService.js` to persist notifications on booking/payment events.
- Keep `SMS_PROVIDER=console` default for dev.

### 4. Priority

**P0** — broken admin SMS and notification bells.

### 5. Cursor AI implementation prompt

```
@codebase
Implement missing SMS and notification APIs to match the frontend:

1. Add Prisma models: SmsTemplate (tenantId nullable for global admin templates), SmsLog, Notification (tenantId, userId optional, type, title, message, read, link).
2. Create backend/src/routes/sms.js implementing endpoints expected by src/lib/smsApi.ts and smsTemplateApi.ts.
3. Create backend/src/routes/notifications.js and admin notification routes under admin.js or separate file matching adminNotificationApi.ts.
4. Mount routes in index.js.
5. On booking create and payment received, insert Notification rows for tenant_owner.

Verify AdminSmsTemplates, AdminSmsLogs, and NotificationBell load without 404. Use console SMS provider when env not set.
```

---

## 18. Reporting & analytics

### 1. Current state

- `Reports.tsx` with report components (sales, profitability, leads, payments, vendor, staff).
- `GET /api/dashboard/stats` for dashboard widgets.
- `GET /api/accounts/profitability`; vendor payables report.
- Admin: `AdminReports.tsx` (23 KB).

### 2. Problems found

- Some reports computed client-side from full list APIs — won't scale.
- No date-range API standard across reports.
- Admin reports may not match tenant-isolated audit data.
- Export (`exportApi.ts`) — verify backend support.

### 3. Improvements / new features

- `GET /api/reports/sales?from=&to=` aggregating bookings/invoices server-side.
- Consistent `DateRangeFilter` component across reports.
- Dashboard cache (60s) for stats endpoint on busy tenants.
- Staff performance: bookings and revenue by `assignedTo` / agent.

### 4. Priority

**P2**

### 5. Cursor AI implementation prompt

```
@codebase
Add server-side sales report endpoint:

1. Create backend/src/routes/reports.js with GET /sales?from=&to= returning { totalRevenue, bookingCount, byDestination[], byAgent[] } scoped to tenantId.
2. Register app.use('/api/reports', ...) in index.js with authenticate.
3. Refactor components/reports/SalesReport.tsx to use new endpoint instead of client-side full booking list aggregation.
4. Add requirePermission reports view.

Use Prisma aggregations. Match existing DashboardStats shapes where possible.
```

---

## 19. Team, roles & permissions

### 1. Current state

- RBAC in `backend/src/middleware/auth.js` (`ROLE_PERMISSIONS`) and `src/lib/permissions.ts`.
- Pages: `Team.tsx`, `RoleManagement.tsx` (18 KB).
- `PermissionGate`, `FeatureGate` components.

### 2. Problems found

- `AdminRoles.tsx` and `RoleManagement.tsx` — changes not persisted to backend.
- Permissions duplicated frontend/backend — drift risk.
- No custom roles per tenant — fixed enum only.

### 3. Improvements / new features

- Phase 1: document canonical permission matrix in `docs/permissions-matrix.md` generated from `ROLE_PERMISSIONS`.
- Phase 2: `TenantRole` model for custom roles (enterprise plan only).
- Team invite email with role description.

### 4. Priority

**P2** — custom roles **P3**.

### 5. Cursor AI implementation prompt

```
@codebase
Generate permissions documentation and reduce drift:

1. Add script scripts/generate-permissions-doc.js that reads backend ROLE_PERMISSIONS and outputs docs/permissions-matrix.md.
2. Add npm script "docs:permissions" in backend/package.json.
3. Add CI check or comment in PR template reminding to regenerate when auth.js permissions change.

Do not change runtime permission behavior.
```

---

## 20. Super admin console

### 1. Current state

- 15 admin pages under `/admin/*`; APIs under `/api/admin` and `/api/admin/domains`.
- Tenant CRUD, pending users, payment request approval, subscription workflow, domains, audit log.

### 2. Problems found

- `AdminPlans.tsx` — plans from `PLANS` constant only; save does not hit API.
- `AdminFeatures.tsx` — toggles saved to local state only (“affects all tenants immediately” is not true).
- `AdminSettings.tsx` (34 KB) mixes SMTP, SMS, payment — SMS API missing.
- Duplicate admin subscription workflow routes.

### 3. Improvements / new features

- `PlatformPlan` and `PlatformFeature` models editable from AdminPlans/AdminFeatures.
- `GET/PUT /api/admin/plans` and `/api/admin/features`.
- Wire AdminSettings SMS tab to real `/api/sms/config` once implemented.
- Admin dashboard stats from `GET /api/admin/stats` — verify all cards have data.

### 4. Priority

**P1** — plans/features persistence for SaaS operator.

### 5. Cursor AI implementation prompt

```
@codebase
Persist platform plans and feature flags:

1. Add PlatformPlan model (slug, name, price, limits Json, features Json, active Boolean) seeded from src/lib/plans.ts and features.ts.
2. Add GET/PUT /api/admin/plans and GET/PUT /api/admin/features (super_admin only).
3. Update AdminPlans.tsx and AdminFeatures.tsx to load/save via API instead of local-only state.
4. Update checkPlanLimit middleware to read limits from PlatformPlan table.

Seed migration with current PLANS constant values. Existing tenant subscriptionPlan slugs must still resolve.
```

---

## 21. Payment gateways (SSLCommerz, bKash, manual)

### 1. Current state

- `sslcommerz.js`, `bkash.js` mounted under `/api/payments`.
- `PaymentCallback.tsx` for redirect handling.
- Manual payment requests with proof upload for subscriptions.

### 2. Problems found

- Gateway callbacks are public — must validate signatures (verify SSLCommerz validation is complete).
- bKash token cache in-memory — lost on API restart (documented in architecture).
- No Nagad/Rocket gateway — listed in manual methods only (OK for Bangladesh).

### 3. Improvements / new features

- Audit logging for all gateway callbacks (partially exists).
- Retry queue for failed IPN processing.
- Tenant-level gateway enable flags in settings (not all tenants need bKash).

### 4. Priority

**P2**

### 5. Cursor AI implementation prompt

```
@codebase
Add per-tenant payment gateway settings:

1. Extend tenant websiteConfig or new TenantPaymentSettings Json field: { sslcommerz: boolean, bkash: boolean, cod: boolean }.
2. On POST /api/payments/initiate, reject gateway if disabled for tenant unless super_admin override.
3. Add toggles in SettingsBilling.tsx saved via PATCH /api/tenants/me.
4. Document env vars remain platform-level for gateway credentials (SaaS operator keys).

Default all enabled for backward compatibility.
```

---

## 22. Security & compliance

### 1. Current state

- bcrypt passwords, JWT auth, tenant scoping on most routes, audit log model.
- CORS dynamic custom domain check.
- Cron protected by secret.

### 2. Problems found

- Full list from security audit: JWT fallback, seed passwords, IDOR on Hajj payments, public uploads, no rate limits, no helmet, `err.message` in 500 responses, cron secret in query string.
- ESLint not enforced (289 issues).
- No automated security tests.

### 3. Improvements / new features

- Add `helmet` middleware with sensible defaults.
- Sanitize 500 errors in production (`{ message: 'Internal server error' }`).
- Authenticate or sign `/uploads` URLs.
- Add `npm audit` to CI; plan multer 2.x upgrade.
- Security section in `AGENTS.md` for cloud agents (no committing `.env`).

### 4. Priority

**P0** — items in authentication and Hajj sections.  
**P1** — helmet, error sanitization, upload auth.

### 5. Cursor AI implementation prompt

```
@codebase
Production security baseline:

1. Add helmet to backend/src/index.js with crossOriginResourcePolicy for /uploads.
2. Add error handler middleware that hides err.message when NODE_ENV=production.
3. Remove req.query.secret from cron.js verifyCronSecret.
4. Fix Hajj pilgrim payment IDOR (see area 9 prompt).

Run API health check and one login test after changes. Update docs/environment-variables.md security section.
```

---

## 23. Developer experience, quality & testing

### 1. Current state

- Vitest configured; **1 example test** only.
- ESLint 9 — **259 errors** (mostly `no-explicit-any`).
- Playwright in devDependencies; E2E not in default CI.
- `AGENTS.md` added for cloud agent local dev.

### 2. Problems found

- Lint failure blocks quality gates if enabled.
- No API integration tests.
- Backend has no lockfile on `main` (may be fixed on branch).
- `prisma migrate deploy` vs `db push` mismatch.

### 3. Improvements / new features

- API smoke tests: health, login, tenant isolation fixture.
- ESLint: fix or downgrade `no-explicit-any` to warn for legacy files; error on new files only.
- Playwright smoke: login → dashboard (uses seeded demo user).
- GitHub Action: lint + test on PR (no deploy).

### 4. Priority

**P1**

### 5. Cursor AI implementation prompt

```
@codebase
Add minimal CI-quality test suite:

1. Create backend/tests/auth.test.js using supertest against Express app (extract app from index.js or use listen on random port).
2. Test POST /api/auth/login with seeded user@demo.com returns 200 and token.
3. Test GET /api/health returns database connected.
4. Add backend npm script "test": "node --test tests/*.test.js" or jest if already preferred.
5. Add .github/workflows/ci.yml running npm test at root and backend test on pull_request.

Do not fix all ESLint errors—only add eslint.config soft warn for no-explicit-any if needed to unblock CI.
```

---

## 24. Deployment & infrastructure

### 1. Current state

- Docker compose for Postgres + API + Nginx frontend (`app/docker-compose.yml`).
- Coolify/Traefik on VPS; GitHub Actions deploy via SSH.
- `docs/deployment-guide.md`, `docs/handover.md`, VPS audit in `docs/audit-current.md`.

### 2. Problems found

- Compose file uses `/srv/travelagencyweb/` paths — not local-dev friendly.
- VPS heavily shared (15 PM2 apps, Supabase on :5432) — resource contention risk.
- Uploads directory was empty at audit — backup scripts still required.
- CORS must include production app domain and localhost:8080.

### 3. Improvements / new features

- `docker-compose.dev.yml` at repo root with local volumes for Postgres only.
- Health check script in CI after deploy (already on VPS).
- Record Coolify Postgres volume name in handover after provision.
- Environment validation script: `node scripts/validate-env.js` before boot.

### 4. Priority

**P2** (dev compose **P1** for teams without native Postgres).

### 5. Cursor AI implementation prompt

```
@codebase
Add local Docker Compose for development database only:

1. Create docker-compose.dev.yml at repo root with postgres:16-alpine, port 5432, volume ./.data/postgres, env POSTGRES_USER/PASSWORD/DB matching backend/.env.example localhost URL.
2. Document in AGENTS.md: docker compose -f docker-compose.dev.yml up -d for Postgres only; API and Vite still run via npm run dev.
3. Do not modify app/docker-compose.yml production paths.

Keep compose minimal—postgres service only.
```

---

## Phased rollout (recommended order)

Aligns with `docs/final-travel-saas-scenario.md` and audit severity.

| Phase | Focus | Duration guidance |
|-------|--------|-------------------|
| **Phase 0 — Stabilize** | P0 security, SMS/notifications API, client upload, Hajj IDOR, CORS, migrations | Do first |
| **Phase 1 — Catalog** | TravelPackage extensions, public package feed, onboarding service types | Scenario Phase 1 |
| **Phase 2 — UX unify** | Packages & Services nav, deprecate legacy Hajj menu, Bangla polish | Scenario Phase 2 |
| **Phase 3 — Ops modules** | Visa/ticketing/hotel JSON or tables on bookings | Scenario Phase 3 |
| **Phase 4 — Finance** | Installments, commissions, ledger automation, reminders | Scenario Phase 4 |
| **Phase 5 — Growth** | B2B portal, corporate, blog CMS, advanced reports | Scenario Phase 5 |

---

## Regression checklist (run after each phase)

- [ ] Login / logout / register / trial tenant
- [ ] Tenant A cannot access Tenant B data (bookings, clients, Hajj pilgrims)
- [ ] Lead → quotation → booking → invoice → payment
- [ ] Subscription payment request + admin approval
- [ ] Public website loads by slug and custom domain
- [ ] Portal magic link login
- [ ] SMS send (console provider) and notification bell
- [ ] `GET /api/health` database connected
- [ ] `npm test` and backend smoke tests pass
- [ ] Bangla UI labels on sidebar and dashboard

---

## Document maintenance

| When | Action |
|------|--------|
| New API route added | Update `docs/api-endpoints.md` |
| Security fix shipped | Note in this doc §22 and close P0 item |
| Phase completed | Check off regression list |
| Plan limits change | Reseed `PlatformPlan` and regenerate permissions doc |

**Last updated:** 2026-06-09  
**Next review:** After Phase 0 completion or first production cutover.
