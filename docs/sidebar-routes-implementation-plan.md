# Sidebar & Routes Implementation Plan

Target navigation blueprint (tenant ERP + super admin) vs current unified sidebar. This plan maps **routes**, **sidebar structure**, **reuse vs new pages**, and **delivery phases** without breaking existing URLs.

**Status:** Plan only — implementation not started.  
**Baseline:** `main` at PR #6 merge (Student/Manpower bookings, Hajj refactor, agents, notifications).

---

## 1. Design principles

1. **Deep links first** — Every sidebar leaf must have a stable URL (bookmarkable, permission-gated).
2. **Reuse heavy pages** — `Packages.tsx`, `Bookings.tsx`, `Accounts.tsx`, `Invoices.tsx` stay as shells; filters come from route params or search params.
3. **Nested sidebar** — Use existing `SidebarMenuSub` / `Collapsible` from `src/components/ui/sidebar.tsx`; do not fork a second nav system.
4. **Permissions** — Extend `Module` in `src/lib/permissions.ts` only where a new top-level area needs RBAC (e.g. `documents`, `follow_ups`).
5. **i18n** — All new labels under `sidebar.*` in `en.json` / `bn.json`; avoid hardcoded BN/EN pairs in `AppSidebar.tsx` (migrate existing inline titles).
6. **Super admin unchanged path** — Keep `/admin/*`; align labels only (e.g. “Agencies” → “All Tenants” optional).

---

## 2. Target → route mapping

### 2.1 Overview

| Sidebar item | Route | Page / behavior | Work |
|--------------|-------|-----------------|------|
| Dashboard | `/dashboard` | `Dashboard.tsx` | None |

### 2.2 CRM

| Sidebar item | Route | Page / behavior | Work |
|--------------|-------|-----------------|------|
| Leads | `/leads` | `Leads.tsx` | None |
| Clients | `/clients` | `Clients.tsx` | None |
| Agents | `/agents` | `Agents.tsx` | None |
| Vendors | `/vendors` | `Vendors.tsx` | None |
| Follow-ups | `/follow-ups` | **New** `FollowUps.tsx` — list leads/tasks with `nextFollowUp` due/overdue | **P1 — new page + API** |
| Quotations | `/quotations` | Keep in CRM group (not in user tree but live today) | Optional: hide behind setting |

**Follow-ups backend (P1):** `GET /api/leads/follow-ups?status=due|overdue|upcoming` or extend leads list with filter; reuse lead detail follow-up dialog from `LeadDetails.tsx`.

### 2.3 Package Management

Single catalog page with **preset filters** (no duplicate CRUD logic).

| Sidebar item | Route | Filter on `Packages.tsx` | `serviceType` / notes |
|--------------|-------|--------------------------|------------------------|
| Tour Packages | `/packages/tour` | `tour_domestic` + `tour_international` | Query: `?types=tour_domestic,tour_international` |
| Hajj Packages | `/packages/hajj` | `hajj_umrah` + Hajj-only flag if added | Link to ops: `/hajj-umrah` in sub-nav |
| Umrah Packages | `/packages/umrah` | Same catalog, tag/filter `umrah` vs `hajj` if schema supports; else shared `hajj_umrah` | May need `packageCategory` field **P2** |
| Visa Services | `/packages/visa` | `visa` | |
| Hotel Packages | `/packages/hotel` | `hotel` | |
| Student Programs (BD) | `/packages/student` | `study_abroad` | Alias route |
| Manpower Programs (BD) | `/packages/manpower` | **New** `manpower` service type or `custom` + tag | **P2** — add `manpower` to `SERVICE_TYPES` |

**Implementation pattern:**

```tsx
// src/pages/Packages.tsx — read initial filter from URL
const { preset } = useParams(); // or useMatch('/packages/:preset')
// Map preset → default filterType + optional create defaults
```

**Redirects (backward compat):**

- `/travel-packages` → `/packages/tour` (or `/packages/all`)
- `/packages-and-services`, `/services`, `/app-packages` → same

### 2.4 Bookings

| Sidebar item | Route | Behavior | Work |
|--------------|-------|----------|------|
| All Bookings | `/bookings` | `Bookings.tsx`, `typeFilter=all` | Route default |
| Tour | `/bookings/tour` | `type=tour` | Search param or path segment |
| Flight / Air Ticket | `/bookings/flight` | `type=ticket` | |
| Hotel | `/bookings/hotel` | `type=hotel` | |
| Hajj | `/bookings/hajj` | `type=package` + subtype hajj **or** link Hajj bookings tab | **P2** if hajj booking type split |
| Umrah | `/bookings/umrah` | Same as Hajj split | **P2** |
| Visa | `/bookings/visa` | `type=visa` | |
| Student | `/bookings/student` | `type=student` | Done (PR #6) |
| Manpower | `/bookings/manpower` | `type=manpower` | Done (PR #6) |

**Implementation:**

- Add `src/lib/bookingRoutes.ts` — map path → `BookingType`.
- `Bookings.tsx`: `useParams()` / `useSearchParams()` to set `typeFilter` on mount; update URL when user changes tab.
- Optional wrapper: `BookingsByType.tsx` that passes `defaultType` (thin).

### 2.5 Hajj / Umrah operations (operations sub-group)

| Item | Route | Page | Work |
|------|-------|------|------|
| Hajj/Umrah Operations | `/hajj-umrah` | `HajjUmrah.tsx` | Add to sidebar under Package Management or Operations |
| Legacy guide | `/legacy/hajj-operations` | Info page only | Keep; remove confusing “legacy” CTA on Packages **P1 UX** |

### 2.6 Documents (new module)

| Sidebar item | Route | Work |
|--------------|-------|------|
| Client Documents | `/documents/clients` | **P1** — aggregate `clients` + documents API |
| Visa Documents | `/documents/visa` | **P2** — filter by booking type visa + hajj visa tab |
| Company Documents | `/documents/company` | **P2** — tenant org docs, new model + upload |

**Reuse today:** `clients.js` document routes, `bookings.js` document routes, client profile uploads.

**New:** `src/pages/DocumentsHub.tsx` with tabs; module `documents` in permissions.

### 2.7 Finance

| Sidebar item | Route | Today | Work |
|--------------|-------|-------|------|
| Invoices | `/invoices` | `Invoices.tsx` | None |
| Payments | `/payments` | Same page, payments view | Split tab via `?view=payments` **P1** |
| Expenses | `/finance/expenses` | Tab inside `Accounts.tsx` | **P1** — route → `Accounts` with `tab=expenses` or `Expenses.tsx` |
| Commissions | `/finance/commissions` | `Agents.tsx` / `AgentProfile` | **P1** — dedicated list or redirect |
| Accounts / Ledger | `/accounts` | `Accounts.tsx` | Sub-route `/accounts/ledger` → tab |
| Financial Reports | `/reports` | `Reports.tsx` | None |

### 2.8 Website CMS

| Sidebar item | Route | Today | Work |
|--------------|-------|-------|------|
| Home / Pages | `/website` | `WebsiteBuilderHome.tsx` | Rename group label “Website CMS” |
| Packages (auto-sync) | `/website/packages` | Partial — ERP packages feed public site | **P2** — explicit sync status UI |
| Blogs | `/website/blogs` | Not in ERP sidebar | **P3** — new CMS entity |
| Testimonials | `/website/testimonials` | In Theme Builder content | **P1** — deep link to customizer section |
| Sliders | `/website/sliders` | Hero in customizer | **P1** — deep link `?section=hero` |
| Theme Settings | `/website/builder` | `WebsiteCustomizer.tsx` | None |

**Pattern:** `WebsiteCustomizer.tsx` accepts `?focus=testimonials|hero` to scroll/open panel.

### 2.9 Administration

| Sidebar item | Route | Today | Work |
|--------------|-------|-------|------|
| Team | `/team` | Yes | |
| Roles & Permissions | `/roles` | Yes | |
| Notifications | `/notifications` | Yes | |
| Settings | `/settings` | Yes | |
| Activity Logs | `/activity-logs` | Super-admin audit only | **P2** — tenant-scoped audit API + page |

Hide or demote: Organization, Subscription, User Guide (keep routes, optional sidebar).

### 2.10 Support

| Item | Route | Work |
|------|-------|------|
| Tasks | `/tasks` | None |
| Help Center | `/help` | **P3** — static/FAQ hub |

### 2.11 Super Admin (`/admin/*`)

Align labels with blueprint; routes already exist in `App.tsx` + `AdminSidebar.tsx`. Optional renames only.

---

## 3. Sidebar component architecture

### 3.1 New config file

Create `src/config/navigation.ts`:

```ts
export type NavItem = {
  id: string;
  titleKey: string;
  url?: string;
  icon: LucideIcon;
  module: Module;
  minPlan?: PlanType;
  requiredFeature?: string;
  children?: NavItem[];
};

export const navigationTree: NavGroup[] = [ ... ];
```

### 3.2 New renderer

Create `src/components/AppSidebarNav.tsx`:

- Renders groups from `navigationTree`.
- Parent with `children`: `Collapsible` + `SidebarMenuSub` + `SidebarMenuSubButton` with `NavLink`.
- Leaf: current `SidebarMenuButton` behavior.
- Reuse `isPlanSufficient`, `canAccess`, lock tooltips from today’s `NavGroup`.

### 3.3 Slim `AppSidebar.tsx`

Replace inline `overviewItems`, `salesItems`, etc. with imports from `navigation.ts`.

### 3.4 Active state

- Parent collapsible **open** when any child route matches (`useLocation`).
- `NavLink` `end` only on exact leaf routes; prefix match for `/bookings/*`, `/packages/*`.

---

## 4. `App.tsx` route additions

Add routes (most are aliases):

```tsx
// Packages
<Route path="/packages/:preset" element={<P><Packages /></P>} />
<Route path="/travel-packages" element={<Navigate to="/packages/tour" replace />} />

// Bookings
<Route path="/bookings/:typePreset" element={<P><Bookings /></P>} />
// Keep /bookings/:id for details — order matters: use bookingId regex or separate path /bookings/view/:id

// Documents (P1)
<Route path="/documents/clients" element={<P><DocumentsHub tab="clients" /></P>} />
<Route path="/documents/visa" element={<P><DocumentsHub tab="visa" /></P>} />
<Route path="/documents/company" element={<P><DocumentsHub tab="company" /></P>} />

// Finance aliases
<Route path="/finance/expenses" element={<P><Accounts defaultTab="expenses" /></P>} />
<Route path="/finance/commissions" element={<P><Commissions /></P>} />

// CRM
<Route path="/follow-ups" element={<P><FollowUps /></P>} />

// Support
<Route path="/help" element={<P><HelpCenter /></P>} />

// Admin tenant activity (P2)
<Route path="/activity-logs" element={<P><TenantActivityLog /></P>} />
```

**Booking details conflict:** Today `/bookings/:id`. Use:

- List presets: `/bookings/type/:typePreset` **or**
- Query only: `/bookings?type=student` (simpler, less sidebar-friendly)
- Recommended: `/bookings/list/:typePreset` for sidebar + keep `/bookings/:id` for UUID ids (detect UUID in route guard).

---

## 5. Permissions matrix updates

Add modules:

| Module | Roles (default) |
|--------|-----------------|
| `follow_ups` | same as `leads` |
| `documents` | view: sales + ops; edit: manager+ |
| `commissions` | view: manager, accountant, owner |
| `activity_logs` | view: tenant_owner, manager |

Update `RoleManagement.tsx` and backend permission seeds if custom roles are stored server-side.

---

## 6. Delivery phases

### Phase 0 — Navigation shell (no new APIs) — **~1 PR**

- `navigation.ts` + nested sidebar
- Package/booking preset routes + URL sync
- Redirects from legacy URLs
- Add `Hajj/Umrah Operations` to sidebar
- i18n for all sidebar keys
- Fix Packages page CTA: “হাজ্জ/উমরাহ অপারেশনস” (not “legacy”)

**Acceptance:** Sidebar matches blueprint structure; clicking each item lands on correct filtered view; old URLs redirect.

### Phase 1 — Thin modules (reuse APIs) — **~2 PRs**

- Follow-ups list page
- Documents hub (clients + booking docs)
- Finance sub-routes (expenses, commissions)
- Website CMS deep links (testimonials, sliders)
- Payments tab deep link on Invoices

### Phase 2 — Schema / backend — **~2–3 PRs**

- Company documents model + uploads
- Tenant activity logs (audit subset)
- `manpower` service type; Hajj vs Umrah package category
- Package auto-sync status on website

### Phase 3 — New product areas

- Help Center
- Blogs CMS
- Full Hajj/Umrah booking type split in sidebar

---

## 7. Testing checklist

- [ ] Each sidebar leaf loads without 404
- [ ] Permission denied modules hidden (not just disabled)
- [ ] Plan gates (website, accounts, reports) still work
- [ ] BN/EN sidebar labels from i18n
- [ ] Collapsed sidebar: children accessible via tooltips or flyout
- [ ] Mobile sheet nav mirrors desktop tree
- [ ] `npm run build` passes
- [ ] Playwright: smoke navigate CRM → Packages preset → Bookings preset → Finance

---

## 8. VPS deploy (production PM2 path)

**Live server:** `/var/www/hearth-core-app`  
**PM2 process:** `hearth-api` (not `hearth-core-api`)  
**API health:** `https://api.travelagencyweb.com/api/health`

### After merge to `main` (includes PR #6)

On the VPS as root:

```bash
cd /var/www/hearth-core-app
git fetch origin main
git reset --hard origin/main   # or: git pull origin main if clean working tree

# Frontend
npm install
npm run build

# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
pm2 restart hearth-api
pm2 save

# Verify
curl -fsS https://api.travelagencyweb.com/api/health
```

Or use the repo script (after PR merge):

```bash
bash /var/www/hearth-core-app/scripts/vps-pm2-deploy.sh
```

### GitHub Actions note

`.github/workflows/deploy.yml` targets `/opt/projects/hearth-core` (Docker layout). It does **not** deploy the PM2 stack unless VPS secrets and paths are updated. Use manual/script deploy for PM2 production until workflow is aligned.

### Post-deploy verification

1. Login at `https://app.travelagencyweb.com`
2. Bookings → tabs include **Student** and **Manpower**
3. `/hajj-umrah` — pilgrims/groups UI loads
4. `/agents` — commission columns visible

---

## 9. Open decisions (confirm with product)

1. **Quotations** — stay in CRM sidebar or move under Sales tools?
2. **Hajj vs Umrah packages** — single `hajj_umrah` filter or split categories?
3. **Booking details URL** — keep `/bookings/:id` only vs `/bookings/view/:id`?
4. **Organization / Subscription / User Guide** — keep in Administration group?

---

## 10. File touch list (Phase 0)

| File | Change |
|------|--------|
| `src/config/navigation.ts` | New — tree definition |
| `src/components/AppSidebarNav.tsx` | New — nested renderer |
| `src/components/AppSidebar.tsx` | Use config |
| `src/App.tsx` | Preset routes + redirects |
| `src/pages/Packages.tsx` | URL-driven `filterType` |
| `src/pages/Bookings.tsx` | URL-driven `typeFilter`; UUID guard for `:id` |
| `src/lib/bookingRoutePresets.ts` | New — path ↔ type map |
| `src/lib/packageRoutePresets.ts` | New — path ↔ service types |
| `src/i18n/locales/en.json`, `bn.json` | `sidebar.*` keys |
| `src/pages/Packages.tsx` | Rename Hajj CTA button |
