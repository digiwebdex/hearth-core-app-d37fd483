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
| Security & auth hardening | **P0** | ✅ Phase 0 — JWT boot check, rate limits, password policy, secure seed |
| SMS & notifications APIs | **P0** | ✅ `/api/sms`, `/api/notifications`, `/api/admin/notifications` |
| Client document upload | **P0** | ✅ `GET/POST/DELETE /api/clients/:id/documents` |
| Hajj payment tenant isolation | **P0** | ✅ Tenant-scoped pilgrim payments + patch/delete hardening |
| CORS & local dev config | **P1** | ✅ Default includes `localhost:8080` |
| Packages & multi-service catalog | **P1** | Partial; vision in scenario doc |
| Admin plans/features persistence | **P1** | UI-only today |
| Website CMS gaps (blog, SEO, etc.) | **P2** | Not implemented |
| Service-specific ops (visa, ticketing) | **P2** | Future phases |
| B2B sub-agent portal | **P3** | Not started |
| Test & lint hygiene | **P1** | Backend auth tests added; ESLint debt remains |

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

## Module build prompts — next code to write

Focused instructions for core sales, operations, finance, and platform modules. Each prompt assumes the existing React + Vite + TypeScript + Express + Prisma stack. Run one module per PR when possible.

---

### Dashboard

**Current:** `GET /api/dashboard/stats` aggregates tenant KPIs; `Dashboard.tsx` (~22 KB) also imports `clientApi`, `bookingApi`, `leadApi`, etc., causing redundant fetches. Backend loads full booking/invoice/lead arrays into memory per request.

**Write next:** Single-source dashboard data path + follow-up action strip.

#### Cursor AI build prompt

```
@codebase
Optimize the agency dashboard data flow:

1. Refactor backend/src/routes/dashboard.js GET /stats to use Prisma aggregations (count, sum, groupBy) instead of loading all bookings/invoices/leads into memory. Keep the exact DashboardStats JSON shape expected by src/lib/api.ts.
2. Add followUpsDueList: top 5 leads where nextFollowUp <= today and status not in won|lost (id, name, phone, nextFollowUp only).
3. In src/pages/Dashboard.tsx remove direct clientApi/bookingApi/leadApi/quotationApi calls; use only dashboardApi.getStats().
4. Add a "Follow-ups today" card listing followUpsDueList with click → /leads/:id.

Do not change routes or auth. Add Bangla strings via existing i18n keys or inline isBn pattern used on the page.
```

---

### Leads

**Current:** Full CRUD at `/api/leads` with activities, convert, duplicate check. `Leads.tsx` (~30 KB) list + filters; no pipeline summary API; `nextFollowUp` not surfaced prominently.

**Write next:** Pipeline counts API + overdue follow-up filters on the list page.

#### Cursor AI build prompt

```
@codebase
Add lead pipeline summary and follow-up filters:

1. In backend/src/routes/leads.js add GET /pipeline-summary (before /:id routes) returning { new, qualified, proposal, negotiation, won, lost, total, overdueFollowUps } counts for req.tenantId.
2. In src/lib/api.ts extend leadApi with getPipelineSummary().
3. In src/pages/Leads.tsx add status filter chips at the top driven by pipeline summary counts; add "Overdue follow-up" toggle filtering leads where nextFollowUp < today and status not won|lost.
4. Show a red badge on rows with overdue nextFollowUp.

Tenant-scope all queries. Match existing requirePermission("leads", "view") pattern.
```

---

### Clients

**Current:** `Client` + `ClientDocument` models; `ClientProfile.tsx` (~15 KB) with passport/NID fields. `clientApi.uploadDocument()` POSTs to `/clients/:id/documents` but **backend route is missing**.

**Write next:** End-to-end client document upload (highest-impact fix for this module).

#### Cursor AI build prompt

```
@codebase
Implement client document upload (frontend already calls it):

1. In backend/src/routes/clients.js add:
   - GET /:id/documents → list ClientDocument for tenant-scoped client
   - POST /:id/documents → multer.single("file") using shared upload middleware (pdf/jpeg/png, 5MB), save to UPLOAD_DIR/clients/{clientId}/
   - DELETE /:id/documents/:docId → tenant-scoped delete
2. Reuse ensure-client-tenant pattern from existing getTenantClient().
3. In src/pages/ClientProfile.tsx wire document list + upload form to clientApi.uploadDocument and new list/delete methods in src/lib/api.ts.
4. Display uploaded files with download link via /uploads/ path.

Mirror backend/src/routes/bookings.js document routes. No schema change required.
```

---

### Agents

**Current:** `Agents.tsx` is a 6-line `CrudPage` wrapper (~243 bytes). Generic CRUD at `/api/agents` only — no commission, no performance stats, no detail page.

**Write next:** Agent commission field + list columns + booking stats on detail drawer.

#### Cursor AI build prompt

```
@codebase
Extend the agents module beyond bare CRUD:

1. Add nullable commissionRate Float and notes String? to Agent in backend/prisma/schema.prisma (additive migration).
2. Allow commissionRate in PATCH/POST /api/agents via crud.js (field passes through req.body on agent model only).
3. Replace src/pages/Agents.tsx thin wrapper with a dedicated page (or extend CrudPage props) showing table columns: name, phone, email, commissionRate (%), active booking count.
4. Add GET /api/agents/:id/summary returning { bookingCount, totalSales, totalCommission } for bookings where agentId matches and tenantId matches.
5. Click row opens a Sheet/Dialog with summary stats and edit form.

Keep CrudPage for other resources unchanged. Use existing UI components from src/components/ui.
```

---

### Vendors

**Current:** Rich vendor module — bills, payments, notes, payables report. `Vendors.tsx` + `VendorDetails.tsx` (~28 KB each). Booking segments use free-text `supplier` more often than `vendorId`.

**Write next:** Link booking segments to vendors + payables aging on vendor detail.

#### Cursor AI build prompt

```
@codebase
Strengthen vendor ↔ booking linkage and payables UX:

1. Add optional vendorId String? FK on BookingSegment in schema.prisma (relation to Vendor, onDelete SetNull).
2. In backend/src/routes/bookings.js segment POST/PATCH validate vendorId belongs to req.tenantId.
3. In src/pages/BookingDetails.tsx segment form add Vendor select (vendorApi.list()) storing vendorId; show vendor name when set.
4. In src/pages/VendorDetails.tsx add "Payables aging" card: buckets 0-30, 31-60, 61-90, 90+ days from vendor bills dueDate vs today using existing bills data.

Additive migration only. Do not break existing segments without vendorId.
```

---

### Quotations

**Current:** Builder (`QuotationBuilder.tsx` ~37 KB), versions, convert-to-booking, print view. No customer share/approve link.

**Write next:** Public share token flow so customers can accept quotations without agency login.

#### Cursor AI build prompt

```
@codebase
Add quotation customer share and accept flow:

1. Add shareToken String? @unique and shareExpiresAt DateTime? to Quotation in schema.prisma.
2. POST /api/quotations/:id/share (requirePermission quotations edit) generates crypto token, 7-day expiry, returns { url: FRONTEND_URL + "/q/" + token }.
3. GET /api/public/quotation/:token (no auth) returns quotation with items/itinerary/grandTotal/client name — exclude totalCost, totalProfit, internal notes.
4. POST /api/public/quotation/:token/respond body { action: "accept"|"reject" } updates status and writes audit log.
5. Add public route in src/App.tsx /q/:token read-only page QuotationPublic.tsx and "Copy customer link" on QuotationDetails.tsx.

Register public routes in backend/src/routes/public.js or new publicQuotation.js mounted under /api/public.
```

---

### Packages & Hajj

**Current:** `TravelPackage` catalog with nested days/inclusions/pricing/media (`Packages.tsx` ~31 KB). Separate `HajjUmrah.tsx` (~62 KB) and `/api/hajj/*`. **P0:** Hajj pilgrim payment routes lack `tenantId` check. Scenario doc wants unified "Packages & Services" with service-type filters.

**Write next:** Security fix first, then navigation bridge between Packages and Hajj without merging pages yet.

#### Cursor AI build prompt

```
@codebase
Fix Hajj security and connect Packages ↔ Hajj UX:

SECURITY (do first):
1. In backend/src/routes/hajj.js add async function ensurePilgrim(req, res) that finds HajjPilgrim by id AND tenantId req.tenantId; return 404 if missing.
2. Use it on GET/POST /pilgrims/:id/payments and any pilgrim/:id route missing tenant check.

UX (same PR or follow-up):
3. In src/pages/Packages.tsx add serviceType filter tabs using src/lib/serviceTypes.ts including hajj_umrah.
4. When filter is hajj_umrah show a banner card: "Manage pilgrims, groups, and installments in Hajj & Umrah Operations" with Button → /hajj-umrah.
5. On HajjUmrah.tsx header add link back to /travel-packages filtered to hajj_umrah.
6. Redirect /legacy/hajj-operations → /hajj-umrah in App.tsx.

Do not delete HajjUmrah.tsx. Optional: add nullable travelPackageId on HajjPackage in a follow-up migration only if needed—skip if timeboxed.
```

---

### Bookings

**Current:** `Bookings.tsx` (~35 KB) and `BookingDetails.tsx` (~37 KB). Booking model supports `type` (tour/ticket/hotel/visa/package), `serviceType`, segments, travelers, checklist, timeline, documents. List has client-side filters (status, payment, destination, date range) but loads **all** bookings via `bookingApi.list()`. Create dialog uses one generic form — `TYPE_ICONS` exist but no type-specific fields (PNR, visa embassy, hotel nights, etc.).

**Write next:** Server-side list filters + conditional create/edit fields per booking type.

#### Cursor AI build prompt

```
@codebase
Add booking type-specific forms and server-side list filters:

BACKEND:
1. Extend GET /api/bookings in backend/src/routes/bookings.js with query params: status, paymentStatus, type, serviceType, destination (contains), travelDateFrom, travelDateTo, clientId, page (default 1), limit (default 25). Return { items, total, page, limit }.
2. Add nullable serviceDetails Json? on Booking in schema.prisma for type-specific payload (e.g. { pnr, airline, sectors } for ticket; { embassy, visaType } for visa; { hotelName, nights } for hotel).

FRONTEND:
3. Create src/components/bookings/BookingTypeFields.tsx — switch on form.type renders extra fields into serviceDetails JSON.
4. In src/pages/Bookings.tsx replace client-side-only filtering with query params to bookingApi.list(filters); keep filter UI (status, payment, type, serviceType, destination, date range).
5. On create/edit submit merge serviceDetails into payload; map serviceType from SERVICE_TYPES when package selected.

Update src/lib/api.ts bookingApi.list signature. Tenant isolation unchanged. Bangla labels via getLocalizedServiceTypeLabel where shown.
```

---

### Tasks

**Current:** `Task` model; generic CRUD at `/api/tasks`. `Tasks.tsx` (~10 KB) — simple table + dialog (title, description, status, priority, dueDate, assignedTo as free text). No link to bookings/leads/clients; `assignedTo` is not a user FK.

**Write next:** Link tasks to CRM/booking records and assign to team members by user ID.

#### Cursor AI build prompt

```
@codebase
Upgrade tasks into operational follow-ups:

1. Add to Task in schema.prisma (nullable): relatedType String? (lead|client|booking), relatedId String?, assignedUserId String? (FK User optional).
2. Update crud.js task POST/PATCH to accept these fields with tenant validation on relatedId lookups.
3. Add GET /api/tasks?status=&assignedUserId=&relatedType=&relatedId= filters.
4. In src/pages/Tasks.tsx replace assignedTo text input with Select from tenantApi.getMembers(); add optional link picker (search lead or booking by id/title).
5. On LeadDetails.tsx and BookingDetails.tsx add "Add task" button pre-filling relatedType/relatedId.

Additive migration. Keep existing tasks working with null related fields.
```

---

### Invoices

**Current:** `Invoices.tsx` (~51 KB) — largest finance page; also serves `/payments` route. Full invoice API: payments, refunds, audit trail, proof upload. No installments; list likely loads all invoices.

**Write next:** Installment schedule on invoices + paginated list.

#### Cursor AI build prompt

```
@codebase
Add invoice installments and pagination:

1. Add model InvoiceInstallment (id, invoiceId, label, amount, dueDate, paidAmount, status, tenantId) with relation to Invoice.
2. GET /api/invoices?page&limit&status&clientId returning paginated list.
3. GET/POST /api/invoices/:id/installments CRUD scoped to tenant.
4. In src/pages/Invoices.tsx add installments sub-table in invoice detail drawer; show progress bar paid vs total.
5. When recording payment allow allocating amount across installments (simple: apply to oldest due first).

Match existing invoice permission checks. BDT formatting as on current page.
```

---

### Payments

**Current:** `Payment` model; invoice-linked payments; gateways via `/api/payments` (SSLCommerz, bKash, COD). `PaymentCallback.tsx` handles redirects. `sendPaymentSms` in Invoices UI calls missing SMS API. Manual subscription proofs separate in `payment-requests`.

**Write next:** Unified payment recording with gateway audit + fix SMS hook after notifications module.

#### Cursor AI build prompt

```
@codebase
Strengthen invoice payment recording and gateway audit:

1. In backend/src/routes/invoices.js POST /:id/payments wrap payment create + invoice balance update + InvoiceAuditEvent + optional Transaction create in prisma.$transaction.
2. Add paymentGatewayMeta Json? on Payment (gateway, tran_id, val_id) when initiated via /api/payments/initiate.
3. GET /api/payments?invoiceId=&from=&to=&method= paginated for tenant.
4. In src/pages/Invoices.tsx payment dialog show gateway status when paymentGatewayMeta present.
5. Replace direct sendPaymentSms calls with notifyEvent("payment_received", ...) from notificationService once Notification routes exist; until then keep console SMS.

Do not change SSLCommerz/bKash callback URLs.
```

---

### Accounts

**Current:** `Account`, `Transaction`, `Expense` models. `Accounts.tsx` (~10 KB) with tabs: overview, ledger, receivables, payables, profitability, expenses, cash/bank (`src/components/accounts/*`). APIs: `/api/accounts`, `/api/transactions`, `/api/expenses` with summary, ledger, profitability endpoints.

**Write next:** Auto-post transactions from invoice payments + CSV export.

#### Cursor AI build prompt

```
@codebase
Automate ledger entries from payments and add export:

1. After successful invoice payment in invoices.js ensure a Transaction row exists (referenceType payment, referenceId payment.id, type income) — idempotent check by referenceId.
2. Add GET /api/accounts/export?from=&to=&format=csv streaming tenant transactions joined with account name.
3. In src/components/accounts/LedgerTab.tsx add Export CSV button using fetch + blob download with auth header.
4. In AccountsOverview.tsx show warning card when receivables from GET /api/accounts/summary diverges from invoice due totals (optional sanity check query).

Use existing requirePermission accounts view/export.
```

---

### Reports

**Current:** `Reports.tsx` (~12 KB) with six report components under `src/components/reports/`. Dashboard has `GET /api/dashboard/stats`. Reports mostly aggregate data client-side from full list APIs — won't scale.

**Write next:** Dedicated `/api/reports/*` endpoints per report type.

#### Cursor AI build prompt

```
@codebase
Move reports to server-side aggregation:

1. Create backend/src/routes/reports.js mounted at /api/reports with authenticate + requirePermission("reports","view"):
   - GET /sales?from=&to=
   - GET /profitability?from=&to=
   - GET /leads-quotations?from=&to=
   - GET /payments?from=&to=
   - GET /vendors?from=&to=
   - GET /staff-performance?from=&to=
2. Each returns JSON shaped for its matching component in src/components/reports/.
3. Refactor Reports.tsx to pass date range state and fetch from new endpoints instead of bookingApi.list() etc.
4. Add shared DateRangeFilter component used by all report tabs.

Tenant-scope all queries. Register route in index.js.
```

---

### Website & Publish

**Current:** `WebsiteCustomizer.tsx` (~49 KB), `WebsiteBuilderHome.tsx`, `WebsitePublishGuide.tsx`. CMS via `/api/website` sections + config. Public site reads `/api/public/:slug/packages` (already merges `TravelPackage` + `HajjPackage`). `SiteContact.tsx` posts to `/api/contact` → `ContactSubmission` only — **does not create a Lead**. Website sections are manually edited; featured packages not auto-synced into section items.

**Write next:** ERP auto-sync for website sections + enquiry-to-lead pipeline.

#### Cursor AI build prompt

```
@codebase
Website ERP auto-sync and enquiry-to-lead:

AUTO-SYNC:
1. Add POST /api/website/sync-from-erp (requirePermission website edit) that:
   - Pulls published TravelPackage where isFeatured=true and status=published
   - Pulls tenant phone, address, name from Tenant
   - Updates website sections: featured-packages items, contact-info fields, hero subtitle if empty
   - Returns { updatedSections: string[] }
2. In WebsiteCustomizer.tsx add "Sync from ERP" button calling sync endpoint then reload sections.
3. On Packages.tsx when status changes to published show toast: "Sync website to show on public site" linking to /website/builder.

ENQUIRY → LEAD:
4. Add POST /api/public/:slug/inquiry (no auth) body { name, email, phone?, message, packageId?, source? } that:
   - Resolves tenant by slug
   - Creates Lead with status new, source website (or package_page), notes = message
   - Still creates ContactSubmission for audit OR replace contact flow for tenant sites only
5. Update SiteContact.tsx and SitePackages.tsx "Contact/Inquire" buttons to call public inquiry endpoint with tenant slug from WebsiteContext.
6. On Leads.tsx show source=website badge.

Rate-limit public inquiry 5/hour per IP. Do not break platform marketing /contact-us route.
```

---

### Team & Roles

**Current:** `Team.tsx` (~8 KB) uses real `tenantApi.getMembers()` / `inviteMember()`. `RoleManagement.tsx` (~18 KB) uses **mock team data** and local permission matrix edits — not persisted. Backend RBAC in `auth.js` `ROLE_PERMISSIONS`; frontend mirror in `permissions.ts`. Invite still sets password `changeme123` on backend.

**Write next:** Wire RoleManagement to real team API; read-only permission matrix with tenant role assignment.

#### Cursor AI build prompt

```
@codebase
Fix Team & Roles to use live data:

1. In src/pages/RoleManagement.tsx remove MOCK_TEAM_MEMBERS; load tenantApi.getMembers() like Team.tsx.
2. Add PATCH /api/tenants/me/members/:userId body { role } in backend/src/routes/tenants.js (tenant_owner only; disallow promoting to super_admin or tenant_owner via this route).
3. RoleManagement: allow changing member role via Select → PATCH; permission matrix tab is read-only display of DEFAULT_PERMISSIONS for selected role (remove fake Save that mutates global matrix).
4. Fix team invite: use random temp password + sendPasswordReset email (from auth hardening task) in POST /me/members.
5. Link Team.tsx row actions to RoleManagement with ?member=userId query for role edit.

Do not implement custom per-tenant roles yet—fixed enum only.
```

---

### Notifications

**Current:** Backend has `emailService.js`, `smsService.js`, `whatsappService.js` (Twilio + Meta providers, console fallback), and `notificationService.js` event dispatcher — but **no HTTP routes** for `/api/sms/*`, `/api/notifications/*`, or `/api/admin/notifications/*`. Frontend: `smsApi.ts`, `smsTemplateApi.ts`, `notificationApi.ts`, `notificationEngine.ts` (client-only), `AdminSmsTemplates.tsx`, `AdminSmsLogs.tsx`, `NotificationBell.tsx`, `AdminNotificationBell.tsx`, `SmtpSettings.tsx`, SMS automation on bookings/invoices. No Prisma models for `Notification`, `SmsLog`, `SmsTemplate`, or tenant communication settings.

**Write next:** Full communications stack — models, APIs, template system, tenant settings UI, logs, WhatsApp Business API wiring.

#### Cursor AI build prompt

```
@codebase
Build the full Notifications & Communications module (SMS + Email + WhatsApp + templates + settings + logs):

PRISMA (additive):
1. TenantCommunicationSettings (tenantId unique, smsProvider, smsApiKey encrypted optional store as plain for now, smsSenderId, smsEnabled, whatsappProvider meta|twilio|console, whatsappToken, whatsappPhoneId, whatsappEnabled, emailFromName, notifyOnBooking, notifyOnPayment, notifyOnLead — booleans default true)
2. SmsTemplate (id, tenantId nullable for global admin templates, type enum booking_confirmed|payment_received|invoice_due|lead_followup|custom, name, body with {{placeholders}}, isActive)
3. SmsLog (id, tenantId, phone, message, status, provider, errorMessage, templateId, relatedType, relatedId, createdAt)
4. Notification (id, tenantId, userId nullable, type, title, message, read, link, createdAt)
5. WhatsAppLog (id, tenantId, phone, message, status, provider, errorMessage, templateId, createdAt) — mirror SmsLog

BACKEND ROUTES — mount in index.js:
6. backend/src/routes/sms.js matching src/lib/smsApi.ts: GET/PUT /config, POST /send, /send-bulk, /test, GET /logs, GET /logs/stats, GET /logs/:id
7. backend/src/routes/smsTemplates.js or nested: CRUD /sms/templates per smsTemplateApi.ts
8. backend/src/routes/notifications.js: GET /, GET /unread-count, PATCH /:id/read, PATCH /read-all, DELETE /:id
9. backend/src/routes/adminNotifications.js under /api/admin/notifications (super_admin)
10. backend/src/routes/communications.js: GET/PATCH /api/tenants/me/communication-settings (tenant_owner)

SERVICES:
11. Refactor smsService.js to read tenant settings when tenantId passed; fall back to env then console.
12. Wire whatsappService.js Meta Business API (META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_ID) and Twilio paths; log every send to WhatsAppLog.
13. Extend notificationService.js notifyEvent handlers to: create Notification row for tenant_owner, send SMS via template if enabled, send WhatsApp if enabled, send email via existing emailService.
14. Add template render helper {{clientName}}, {{amount}}, {{bookingTitle}}, {{dueDate}}.

FRONTEND:
15. Create src/pages/SettingsNotifications.tsx (or extend SettingsPage tabs): SMS toggle, WhatsApp toggle, provider fields, test send buttons.
16. Wire AdminSmsTemplates.tsx and AdminSmsLogs.tsx to live APIs (remove any mock data).
17. Wire NotificationBell.tsx and AdminNotificationBell.tsx to /api/notifications and /api/admin/notifications.
18. Move SmtpSettings.tsx to use GET/POST /api/email/config (already exists) under same settings area.
19. Delete or gut client-only persistence in notificationEngine.ts — fetch from API on load.

AUTOMATION HOOKS:
20. Call notifyEvent on: booking create (bookings.js), payment received (invoices.js), lead create from website inquiry (new public route), invoice overdue (cron.js stub).

Default SMS_PROVIDER=console and WHATSAPP_PROVIDER=console for dev. Super-admin templates have tenantId=null. Tenant-scope all logs and settings.
```

---

## Phased rollout (recommended order)

Aligns with `docs/final-travel-saas-scenario.md` and audit severity.

| Phase | Focus | Duration guidance |
|-------|--------|-------------------|
| **Phase 0 — Stabilize** | P0 security, SMS/notifications API, client upload, Hajj IDOR, CORS, migrations | ✅ Shipped (Jun 2026) |
| **Phase 1 — Catalog** | TravelPackage extensions, public package feed, onboarding service types | ✅ Shipped (Jun 2026) |
| **Phase 2 — UX unify** | Packages & Services nav, deprecate legacy Hajj menu, Bangla polish | ✅ Shipped (Jun 2026) |
| **Phase 3 — Ops modules** | Visa/ticketing/hotel JSON or tables on bookings | ✅ Shipped (Jun 2026) |
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

**Last updated:** 2026-06-09 (module build prompts: sales, ops, finance, website, notifications)  
**Next review:** After Phase 0 completion or first production cutover.
