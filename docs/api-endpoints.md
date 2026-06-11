# API Endpoints

Live routes are mounted in `backend/src/index.js`. JWT required unless marked Public.

## Auth & tenants
- `POST   /api/auth/login`, `/register`, `/forgot-password`, `/reset-password`
- `GET    /api/auth/me`
- `GET    /api/tenants`, `POST /api/tenants`, `PUT /api/tenants/:id`

## Core CRUD (tenant-scoped)
- `/api/clients`, `/api/agents`, `/api/vendors`, `/api/leads`, `/api/tasks`
- `/api/bookings`, `/api/invoices`, `/api/payments`, `/api/quotations`
- `/api/accounts`, `/api/transactions`, `/api/expenses`
- `/api/hajj`, `/api/subscriptions`, `/api/payment-requests`
- `/api/audit-logs`, `/api/dashboard`

## Admin (super-admin only)
- `/api/admin/*` — tenants, plans, features, roles, settings, subscriptions, payments, reports, sms-logs, sms-templates, pending-users, audit-log
- `/api/admin/domains` — custom domain verification

## Public (no auth)
- `POST /api/contact` — contact form
- `POST /api/demo-requests` — demo request form
- `/api/public/*` — public site data (services, packages, pages per tenant)

## Portal (separate JWT audience for customers / suppliers)
- `/api/portal/*` — magic-link login, my bookings, my purchase orders

## Email & cron
- `/api/email/*` (auth) — send / templates
- `/api/cron/*` (CRON_SECRET header) — subscription-expiry, reminders

## SMS (authenticated; super_admin for config/logs/bulk/test)
- `GET/PUT /api/sms/config` — env-derived masked config (`apiKeyConfigured`; PUT rejects secret fields)
- `POST /api/sms/send` — tenant-scoped send
- `POST /api/sms/send-bulk`, `POST /api/sms/test` — super_admin
- `GET /api/sms/logs` — paginated list (`messagePreview` only)
- `GET /api/sms/logs/:id` — full log including message
- `GET /api/sms/logs/stats` — aggregate counts
- `GET /api/sms/templates` — active global templates (all authenticated)
- `POST/PATCH/DELETE /api/sms/templates/:id` — super_admin

## Notifications (authenticated, tenant-scoped)
- `GET /api/notifications` — `{ items, total, page, limit, unreadCount }` (`userId` null = tenant-wide)
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`
- `DELETE /api/notifications/:id`

## Client documents
- `GET/POST /api/clients/:id/documents` — multipart field `files[]`
- `DELETE /api/clients/:id/documents/:docId`

## Health
- `GET /api/health` → `{status, database, service, uptime, environment, timestamp}` (Public)

## Uploads
- `POST /api/upload` (via multer in tenant routes)
- `GET  /uploads/:filename` — static served from `UPLOAD_DIR`

---

## Gap vs. requested endpoint list

The following routes were listed in the spec but are **not implemented** in the current backend. They are out of scope for the VPS migration itself — open a separate work item if needed:

- `/api/homepage-content`
- `/api/pages` (CMS pages)
- `/api/packages` (travel packages — current model is `Service`/`Booking`, not a dedicated Package CRUD)
- `/api/services` (same as above — covered by existing tenant Service model? confirm with backend audit)
- `/api/categories`
- `/api/availability`
- `/api/inquiries` (covered by `/api/contact` + `/api/demo-requests`)
- `/api/blogs`
- `/api/testimonials`
- `/api/team`
- `/api/offers`
- `/api/reviews`
- `/api/promo-ads`
- `/api/seo`
- `/api/dashboard/stats` (existing `/api/dashboard` returns aggregate metrics — verify shape matches spec)

If you want any of these built, create a follow-up task per endpoint group.
