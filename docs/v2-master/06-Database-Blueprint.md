# 06 — Database Blueprint

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - **Central Status Engine (frozen):** status value sets move to a shared code-level definition, validated on write. Columns stay `String` — **no DB migration required, fully backward-compatible**.
> - **Money stays `Float` for v2.** `Decimal` + double-entry accounting and Row-Level Security are **postponed to the Future Roadmap** ([11 §Future Roadmap](11-Architecture-Freeze.md)).

> **Source of truth:** `backend/prisma/schema.prisma` (~2000 lines). This doc is a map; the schema is authoritative.

## Global facts

- **Provider:** PostgreSQL (`DATABASE_URL`). Client: `prisma-client-js`.
- **~78 models.** IDs are `String @id @default(uuid())` almost everywhere.
- **No DB-level enums.** Every status/type is a plain `String` with a default — allowed values are enforced in **application code**, not the DB (see the status guard caveat in [05-Workflow-Book](05-Workflow-Book.md)).
- **Money is `Float`** (not `Decimal`). Default currency `"BDT"` where present. *(Float-for-money is a known precision risk to weigh in v2.)*
- **Multi-tenancy:** most models carry `tenantId` + `tenant Tenant @relation(onDelete: Cascade)`. Tenant-scoped composite indexes (`@@index([tenantId, …])`) and tenant-scoped uniqueness (`@@unique([tenantId, …])`) are pervasive.
- **Schema flow:** `backend/prisma/migrations/` **does** contain versioned migrations (`0_init` … `phase4_installments`), and prod uses `prisma migrate deploy`. Note the legacy `npm run setup` still uses `db push` — **v2 standardizes on migrations everywhere** (see [10-Development-Rules](10-Development-Rules.md)).

## Domain map

### 1. Tenancy, Auth & Platform (control plane)
- **Tenant** — ROOT. `slug @unique`, `subscriptionPlan/Status/Expiry`, `enabledServiceTypes/Subcategories/Modules[]`, legacy `enableHajjUmrahModule`/`enableBdOperationsModule`. 60+ child relations.
- **User** — staff/login. `email @unique`, `role` (def `sales_agent`), `status` (def `pending`), TOTP, verify/reset tokens. → `staffProfile`, `agentCommissionProfile`.
- **WhatsappOtp** *(global)* — signup/verify OTPs.
- **PlatformStaff** *(global)* — super-admin/platform accounts, `permissions[]`.

### 2. HRM / Payroll
- **StaffProfile** (1:1 `userId`) → salaryStructure, payslips.
- **StaffAttendance** — `@@unique([tenantId,userId,date])`.
- **StaffLeaveRequest** — `leaveType`, `status` (def `pending`).
- **SalaryStructure** (1:1) — basic + allowances + deductions.
- **PayrollRun** — `@@unique([tenantId,month,year])` → payslips.
- **PayslipEntry** — per-employee gross/net, day counts, `paidAt`.

### 3. CRM
- **Client** — `clientType` (def `individual`), `walletBalance`, `creditLimit`, passport/NID, `tags[]`, `customFields Json`. Owns family, wallet txns, documents, and links to bookings/invoices/leads/quotations/loyalty/support/visa/mice.
- **ClientDocument**, **ClientFamilyMember**, **WalletTransaction** (client wallet ledger).
- **Lead** — `status` (def `new`), `source`, `score`, `assignedTo`, `nextFollowUp`, `tags[]`, opt `clientId` → activities, quotations.
- **LeadActivity** — `type`, old/new status.
- **Complaint** — `priority`, `status` (def `open`), `rating`.
- **Campaign** — `channel` (def `sms`), `audienceType`, counts.
- **CrmConfig** (1:1 tenant) — `leadSources[]`, `followUpTypes[]`, `complaintCategories[]`, `customFields Json`, `automations Json`.
- **Task** — `status` (def `todo`), `priority`.
- **SupportTicket** — `@@unique([tenantId,ticketNumber])`, `status` (def `open`).

### 4. Agents & Vendors (partners/suppliers)
- **Agent** — `balance` → bookings, commissionProfile, transactions.
- **AgentTransaction** — agent ledger (`type` def `deposit`).
- **AgentCommissionProfile** (PK `agentId`) — `commissionRate`, opt linked `userId @unique`.
- **BookingAgentCommission** (PK `bookingId`) — `agentCommissionAmount`, `agentCommissionStatus` (def `pending`).
- **Vendor** — `category` (def `other`) → bills, notes, expenses.
- **VendorBill** — `totalAmount/paidAmount/dueAmount`, `status` (def `unpaid`) → payments.
- **VendorBillPayment**, **VendorNote**.
- **VisaStock** — visa inventory for trading; buy/sell/profit, `status` (def `available`).

### 5. Sales / Quotations & Packages
- **Quotation** — `status` (def `draft`), `version`, `items Json`, `itinerary Json`, cost/selling/profit totals, `grandTotal`, package snapshots → versions.
- **QuotationVersion** — `versionNumber`, `snapshot`.
- **TravelPackage** — sellable product. `serviceType` (def `tour_domestic`), `code`, `slug`, `basePrice`, `status` (def `draft`), `seasonalPricing Json`. `@@unique([tenantId,code])` + `([tenantId,slug])` → days, inclusions, pricing, media.
- **TravelPackageDay / Inclusion / Pricing / Media** — itinerary, inclusions/exclusions, tiered pricing, gallery.

### 6. Bookings & Operations
- **Booking** — central record. `type` (def `package`), `amount/cost/profit/paidAmount/dueAmount`, `paymentStatus` (def `unpaid`), `status` (def `pending`), `opsStatus`, `serviceDetails Json`, `followUpDate`. **6 composite tenantId indexes.** → segments, travelers, checklist, timeline, documents, agentCommission, and more.
- **BookingSegment / Traveler / ChecklistItem / TimelineEvent / Document** — the ops sub-records.

### 7. Finance / Invoicing & Accounting
- **Invoice** — `invoiceNumber`, `totalAmount/paidAmount/dueAmount/refundedAmount`, `status` (def `unpaid`), tax fields, `cancelReason` → payments, refunds, auditTrail, installments.
- **InvoiceInstallment** — `status` (def `pending`), `sortOrder`.
- **Payment** — `amount`, `method`, `transactionRef`, `proofUrl`, `receivedBy`.
- **InvoiceRefund**, **InvoiceAuditEvent** (audit trail).
- **Account** — cash/bank head, `type`, `balance`, `status` (def `active`) → transactions, expenses.
- **Transaction** — GL entry, polymorphic `referenceId/referenceType`, `status` (def `completed`).
- **Expense** — `status` (def `pending`), `approvedBy` → vendor, account.
- **TaxRule** — `rate`, `type` (def `percentage`), `isDefault`.

### 8. Hajj / Umrah
- **HajjPackage** — Makkah/Madinah nights & hotels, inclusion flags, price/cost/profit, `capacity/enrolled`, `status` (def `upcoming`) → groups, pilgrims.
- **HajjGroup** — departure group, flight details → pilgrims.
- **HajjPilgrim** — passport/NID, mahram, room, `status` (def `registered`), `visaStatus` (def `not_started`), `departureStatus` (def `not_departed`), amounts → payments.
- **HajjPilgrimPayment** — installments.

### 9. Air Ticketing (refund/void/reissue/BSP)
- **TicketRefund** — fares, `netRefundAmount`, `status` (def `requested`).
- **TicketVoid** — `voidDeadline`, `status` (def `pending`).
- **TicketReissue** — fare difference + fees, `status` (def `requested`).
- **BspUpload / BspRecord** — BSP reconciliation batches & lines (`matchStatus` def `unmatched`).

### 10. MICE / Corporate / Visa / Inventory / Recruitment (Phase 3)
- **MiceEvent / MiceEventItem** — events + cost lines.
- **TravelPolicy / TravelApprovalRequest** — corporate travel policy + approval workflow.
- **VisaApplication** — status tracker (`status` def `not_applied`), embassy/service fees.
- **HotelContract / TransportContract** — inventory/allotment contracts.
- **JobPosting / JobApplication** — manpower recruitment pipeline (`stage` def `applied`).

### 11. Loyalty & Referral
- **LoyaltyRule** (1:1) — points config + tier thresholds.
- **LoyaltyAccount** (1:1 client) — balance + `tier` (def `standard`) → transactions.
- **LoyaltyTransaction** — earn/redeem/expire ledger.
- **ReferralCode** — `@@unique([tenantId,code])`, `commissionRate` (def 5) → conversions.
- **ReferralConversion** — `commissionEarned`, `status` (def `pending`).

### 12. Group Tours
- **GroupTour** — fixed departure, `capacity`, `status` (def `upcoming`).
- **GroupTourBooking** — links booking↔tour, `@@unique([groupTourId,bookingId])`.

### 13. Subscriptions / Billing (SaaS)
- **Subscription** — `plan`, `startDate/endDate`, `status` (def `active`), `billingCycle` (def `monthly`).
- **PaymentRequest** — manual activation/upgrade request. `method` (def `manual`), `trxId`, `proofUrl`, `status` (def `pending`), `requestType` (def `activate`), coupon fields. (Large workflow model.)
- **SubscriptionHistory** — plan/status change audit.
- **SubscriptionCoupon** *(global)* — `code @unique`, `discountType`, `applicablePlans[]`.
- **PaymentMethodConfig** *(global)* — `methodCode @unique`.
- **DemoRequest**, **ContactSubmission** *(global)* — marketing captures.

### 14. Domains / Hosting
- **TenantDomain** — `domain @unique`, `status` (def `pending`), `sslStatus` (def `none`), `verificationStatus/Token`, `isPrimary`.

### 15. Website / CMS
- **WebsitePost** — `@@unique([tenantId,slug])`, `status` (def `draft`), SEO meta.

### 16. Notifications & Messaging
- **Notification** — in-app (tenant). `userId:null` ⇒ tenant-wide. Indexes on user/read/createdAt.
- **PlatformNotification** *(global)*.
- **NotificationAutomation** — per-event `sms`/`inApp` toggles, `@@unique([tenantId,eventType])`.
- **NotificationDelivery** — attempt log (`status` def `pending`), 4 tenantId indexes.
- **SmsTemplate / SmsLog / WhatsAppTemplate / WhatsAppLog** — `tenantId String?` (shared platform + optional tenant).
- **SmsSettings** (1:1) — `smsEnabled`, `notifyOnBooking/Payment/Lead`.

### 17. Master Data & Audit (platform reference)
- **MasterReference** *(global)* — countries/cities/airlines etc. Self-referential tree via `parentId`, `meta Json`, `nameBn`.
- **AuditLog** — `tenantId String?`. Actor + `module`/`action` + `targetType/Id` + old/new value + `ipAddress`.

## Tenant isolation reference

- **Global / platform models (NO `tenantId`):** `Tenant`(root), `PlatformStaff`, `WhatsappOtp`, `PaymentMethodConfig`, `SubscriptionCoupon`, `DemoRequest`, `ContactSubmission`, `PlatformNotification`, `MasterReference`.
- **Nullable tenant (shared + optional scope):** `SmsTemplate`, `SmsLog`, `WhatsAppTemplate`, `WhatsAppLog`, `AuditLog`.
- **Everything else is tenant-scoped** and cascades on tenant delete.

## Enum-like value sets (stored as `String`)

Because there are no DB enums, these value sets live in app code and **must be validated there** (see [05](05-Workflow-Book.md) / [10](10-Development-Rules.md)). Key ones: Tenant `subscriptionPlan`/`subscriptionStatus`; User `role`/`status`; Booking `status`/`paymentStatus`/`opsStatus`/`type`; Invoice + Installment `status`; Lead/Complaint/SupportTicket/Task/Quotation/TravelPackage/WebsitePost `status`; Hajj pilgrim `status`/`visaStatus`/`departureStatus`/`paymentStatus`; VisaApplication/VisaStock `status`; Ticket refund/void/reissue `status`; PaymentRequest `status`/`requestType`/`activationMode`; loyalty `tier`; TaxRule `type`/`appliesTo`.

## Uniqueness highlights

- Tenant-scoped: `StaffAttendance(tenantId,userId,date)`, `SupportTicket(tenantId,ticketNumber)`, `WebsitePost(tenantId,slug)`, `TravelPackage(tenantId,code)`+`(tenantId,slug)`, `PayrollRun(tenantId,month,year)`, `ReferralCode(tenantId,code)`, `NotificationAutomation(tenantId,eventType)`.
- Global `@unique`: `Tenant.slug`, `User.email`, `PlatformStaff.email`, `TenantDomain.domain`, `PaymentMethodConfig.methodCode`, `SubscriptionCoupon.code`.
- 1:1 uniques: `StaffProfile.userId`, `SalaryStructure.staffProfileId`, `LoyaltyRule.tenantId`, `LoyaltyAccount.clientId`, `CrmConfig.tenantId`, `SmsSettings.tenantId`, `AgentCommissionProfile.userId`.

---
*See also: [02-Business-Architecture](02-Business-Architecture.md) · [05-Workflow-Book](05-Workflow-Book.md)*
