# TravelAgencyWeb (TAWSS) — Final Master Plan (Revised)

**Version:** 1.1 · **Date:** June 2026  
**Audience:** Product owner, developers, agency owners, sales/ops staff  
**Goal:** **এজেন্ট-ফ্রেন্ডলি** travel ERP — যেকোনো এজেন্সি **৫ মিনিটে** দৈনন্দিন কাজ শুরু করতে পারবে।

**Related docs:** `saas-master-blueprint.md` · `final-travel-saas-scenario.md` · `serviceCatalog.ts`

**সচেতকভাবে বাদ (এই প্ল্যানে নেই):**
- Arabic / RTL UI
- Multi-currency
- Hotel allotment / contract module
- Stripe / international card gateways

**পেমেন্ট ফোকাস:** bKash · SSLCommerz · bank transfer · manual proof + admin approve (বাংলাদেশ মার্কেট)

---

## 1. এক লাইনে ভিশন

> **“Lead থেকে Payment — এক জায়গায়। ১৪টি সার্ভিস ক্যাটাগরি সাইনআপে বেছে নিন, দৈনন্দিন কাজ একই ৬ ধাপে।”**

| Dimension | TAWSS positioning |
|-----------|-------------------|
| **Market** | Bangladesh-first, EN/BN — global-ready architecture without extra i18n/pay scope |
| **vs Travel Suite ERP** | Unified booking flow; **broader signup catalog** (14 + 135) |
| **vs Hajj-only tools** | Hajj depth + visa, ticket, tour, manpower, study, corporate |
| **vs spreadsheets** | Cloud ERP + agency website + multi-tenant SaaS |

---

## 2. সাইনআপ সার্ভিস ক্যাটালগ (আসল সংখ্যা)

`Register` Step 2 → `ServiceCatalogPicker` (`src/lib/serviceCatalog.ts`)

| স্তর | সংখ্যা |
|------|--------|
| **মূল ক্যাটাগরি** | **১৪** |
| **সাব-ক্যাটাগরি** | **১৩৫** |
| **Agency preset** | **৬** |

### ১৪টি মূল ক্যাটাগরি

| # | Category | বাংলা |
|---|----------|-------|
| 1 | Air Ticketing | এয়ার টিকেটিং |
| 2 | Hajj & Umrah | হজ্জ ও উমরাহ |
| 3 | Visa Processing | ভিসা প্রসেসিং |
| 4 | Manpower & Overseas Employment | ম্যানপাওয়ার |
| 5 | Hotel & Accommodation | হোটেল ও আবাসন |
| 6 | Transportation | ট্রান্সপোর্ট |
| 7 | Tour Packages | ট্যুর প্যাকেজ |
| 8 | Cruise & Holiday | ক্রুজ ও হলিডে |
| 9 | Study Abroad | স্টাডি অ্যাবরড |
| 10 | Corporate Travel | কর্পোরেট ট্রাভেল |
| 11 | Travel Documentation | পাসপোর্ট / অ্যাটেস্টেশন |
| 12 | Event & Attraction Tickets | ইভেন্ট টিকেট |
| 13 | Travel Insurance | ট্রাভেল ইন্স্যুরেন্স |
| 14 | Additional Services | eSIM, lounge, concierge… |

### ৬টি Preset (দ্রুত বাছাই)

Hajj Agency · Tour Agency · Visa Center · Manpower Agency · Study Consultancy · Full Service

→ নির্বাচিত সাব-ক্যাটাগরি থেকে `enabledServiceTypes` তৈরি হয় → **মেনু ও বুকিং টাইপ ফিল্টার** হয়।

---

## 3. এজেন্টের একমাত্র নিয়ম (৬ ধাপ)

```mermaid
flowchart LR
  A["① Lead"] --> B["② Client"]
  B --> C["③ Quotation"]
  C --> D["④ Booking"]
  D --> E["⑤ Invoice"]
  E --> F["⑥ Payment"]
  D --> G["Ops"]
```

| ধাপ | স্ক্রিন |
|-----|--------|
| ① Lead | Leads |
| ② Client | Clients |
| ③ Quotation | Quotations |
| ④ Booking | Bookings |
| ⑤ Invoice | Invoices |
| ⑥ Payment | Payments |
| Ops | Booking Details / Ops desk |

**স্বর্ণ নিয়ম:** Package = ক্যাটালগ টেমপ্লেট · Booking = আসল বিক্রি · Hajj Ops = বড় সিজন/গ্রুপ ম্যানেজমেন্ট

---

## 4. টার্গেট সাইডবার (৭ গ্রুপ — সহজ)

```
📊 Dashboard
👥 CRM          — Leads · Clients · Agents · Vendors
💼 Sales        — Quotations · Bookings (এক পেজ, ট্যাব)
📦 Catalog      — Packages (১৪ ক্যাটাগরি ট্যাব)
⚙️ Operations   — Tasks · Documents · Visa/Ticket desk · Hajj Ops (optional)
💰 Finance      — Invoices · Payments · Accounts · Reports
🌐 Website      — Theme · Publish · Domain
🔧 Settings     — Team · Roles · Subscription · Guide
```

**Agent-First নিয়ম:** ৭ গ্রুপ · Next Step বাটন · Onboarding = ১৪ ক্যাটাগরি preset · অপ্রয়োজনীয় মডিউল লুকানো

---

## 5. Travel Suite vs TAWSS (আপডেট)

| Module | TAWSS আজ | প্ল্যান |
|--------|----------|---------|
| Sales & Quotation | ✅ | Next-step UX |
| CRM | ✅ | Pipeline + lead source |
| Booking | ✅ | Single page + tabs |
| Tour / Package | ✅ | Catalog tabs |
| Flight | ⚠️ PNR booking | **Ticket ops desk** (P2) |
| Hotel | ⚠️ booking fields | **Hotel ops desk** (P2) — allotment নয় |
| Visa | ⚠️ | **Visa ops desk** (P2) |
| Hajj/Umrah | ✅ গভীর | Simplify entry |
| Tasks | ✅ | Link to booking |
| Support Tickets | ❌ | P2 |
| HRM | ❌ | P2 light |
| Website CMS | ✅ | Blog P2 |
| Analytics | ✅ আংশিক | KPI by service P2 |
| **TAWSS extra** SaaS + SMS + 14-category signup | ✅ | Core USP |

---

## 6. মার্কেট ফোকাস (বাংলাদেশ-সেন্ট্রিক)

| Segment | Default preset | Payment |
|---------|----------------|---------|
| Hajj/Umrah agency | `hajj_agency` | bKash, bank |
| Visa center | `visa_center` | bKash, bank |
| Tour agency | `tour_agency` | bKash, SSLCommerz |
| Manpower | `manpower_agency` | bank, cash |
| Study consultancy | `study_consultancy` | bank |
| Full service | `full_service` | hybrid |

**Onboarding (৪ প্রশ্ন):**
1. Preset বা কাস্টম সার্ভিস (১৪ ক্যাটাগরি)
2. দৈনিক বুকিং ভলিউম (মেনু গভীরতা)
3. ভাষা EN / BN
4. bKash / SSLCommerz চালু করবেন?

---

## 7. রোল গাইড

| Role | দৈনিক |
|------|-------|
| Sales | Leads → Quote → Booking |
| Ops | Bookings → Ops tab / Service desk |
| Visa officer | Visa desk queue |
| Ticket officer | Ticket desk (PNR) |
| Accounts | Invoice → Payment → Reports |
| Hajj coord | Hajj/Umrah Ops |
| Owner | Dashboard, Subscription, Website |

---

## 8. প্রোডাক্ট রোডম্যাপ — ৩ ফেজ (রিভাইজড)

### Phase 1 — খুব সহজ (০–৮ সপ্তাহ) · **#1 অগ্রাধিকার**

| ID | Deliverable |
|----|-------------|
| 1.1 | Sidebar → ৭ গ্রুপ মেনু |
| 1.2 | Onboarding wizard (৬ preset + ১৪ ক্যাটাগরি picker) |
| 1.3 | Bookings — single page + type tabs |
| 1.4 | Catalog — single page + category tabs |
| 1.5 | Next Step: Lead→Quote→Book→Invoice |
| 1.6 | Trial **৭ দিন** + renewal SMS/email |
| 1.7 | **bKash + SSLCommerz** production |
| 1.8 | BN video guide (৩ মিন) + dashboard checklist |
| 1.9 | Empty states + human error messages (BN) |

### Phase 2 — Travel Suite parity + conversion (২–৪ মাস)

| ID | Deliverable |
|----|-------------|
| 2.1 | **Visa Operations desk** — embassy queue, status columns |
| 2.2 | **Ticket Operations desk** — PNR, reissue, refund workflow |
| 2.3 | **Hotel Operations desk** — confirmation, voucher (booking-based, no allotment) |
| 2.4 | **Support Ticket** — client complaint → assign → resolve |
| 2.5 | **Light HRM** — staff profile, attendance, leave (payroll নয়) |
| 2.6 | **B2B Agent Portal UI** — commission wallet |
| 2.7 | Website **Blog / News** |
| 2.8 | Dashboard KPI by **১৪ ক্যাটাগরি / booking type** |
| 2.9 | Lead **pipeline** + source report |
| 2.10 | **Corporate travel** basic (company client, monthly invoice summary) |

### Phase 3 — প্ল্যাটফর্ম শক্তি (৪–৮ মাস)

| ID | Deliverable |
|----|-------------|
| 3.1 | Marketing automation — drip SMS/email on trial day 1/2/last |
| 3.2 | WhatsApp template library (renewal, payment reminder) |
| 3.3 | Coupon / promo on subscription |
| 3.4 | **Student / Manpower ops desk** polish (`/operations/bd`) |
| 3.5 | Package ↔ website sync status UI |
| 3.6 | Super admin: tenant health score (active, expired, last login) |
| 3.7 | Mobile-friendly PWA shortcuts (ops notifications) |
| 3.8 | Optional: **GDS / flight API** partner (premium tier only — later decision) |

**স্পষ্ট বাদ:** Arabic UI · Multi-currency · Hotel allotment · Stripe

---

## 9. কমার্শিয়াল প্ল্যান

| Item | Plan |
|------|------|
| Trial | ৭ দিন Pro |
| Activation | bKash / SSLCommerz / bank proof → admin approve |
| Renewal | Auto-expire + SMS/WA (built) |
| Follow-up | Bulk notify from Subscriptions admin |
| Metrics | Signup→first booking 48h · Trial→paid 30d |

---

## 10. নতুন এজেন্সি — ৭ দিন

| Day | Action |
|-----|--------|
| D0 | Signup + **preset/service pick** (১৪ ক্যাটাগরি) |
| D1 | 1 Lead + 1 Client |
| D2 | 1 Quotation (catalog template) |
| D3 | 1 Booking |
| D4 | Invoice + Payment |
| D5 | Website publish |
| D6 | 1 team member (role preset) |
| D7 | Reports review |

---

## 11. টেক অ্যাংকর (ভাঙবেন না)

```
Lead → Quotation → Booking → Invoice → Payment → Account → Report → Website
```

- `enabledSubcategories` (১৩৫) → menu filter  
- `serviceDetails` JSON on Booking  
- Multi-tenant `tenantId`  
- Additive migrations only  

---

## 12. অগ্রাধিকার এক নজরে

| # | Focus |
|---|--------|
| **1** | সহজ UX — ৭ গ্রুপ মেনু, ৬ ধাপ, onboarding (১৪ ক্যাটাগরি) |
| **2** | Conversion — trial ৭d, bKash/SSLCommerz, renewal follow-up |
| **3** | Ops desks — Visa, Ticket, Hotel (booking-based) |
| **4** | Support ticket + light HRM + B2B portal |
| **5** | Marketing automation + platform analytics |

---

## 13. FAQ

| প্রশ্ন | উত্তর |
|--------|--------|
| সাইনআপে কত সার্ভিস? | **১৪ ক্যাটাগরি, ১৩৫ সাব-সার্ভিস, ৬ preset** |
| Arabic / Stripe? | **এই প্ল্যানে নেই** |
| Hotel allotment? | **নেই** — hotel booking + ops desk যথেষ্ট |
| Hajj এজেন্সি শুরু? | Preset `hajj_agency` → Leads → Bookings → Hajj Ops |
| Trial বন্ধ? | না — ৭ দিন |

---

## 14. Appendix — Flowcharts & Organograms

### A1. Master organogram (platform → tenant)

```mermaid
flowchart TB
  subgraph Platform["TravelAgencyWeb Platform (Super Admin)"]
    SA[Super Admin Panel]
    SA --> Agencies[Agencies / Tenants]
    SA --> Subs[Subscriptions & Plans]
    SA --> PayReq[Payment Requests]
    SA --> SMS[SMS / Audit / Reports]
  end

  subgraph Tenant["Each Travel Agency (Tenant)"]
    Owner[Owner / Manager]
    Owner --> Team[Team & Roles]
    Team --> Sales[Sales Staff]
    Team --> Ops[Operations Staff]
    Team --> Acct[Accounts Staff]

    Sales --> CRM[CRM]
    Sales --> SALES[Sales Layer]
    Ops --> OPS[Operations Layer]
    Acct --> FIN[Finance Layer]

    CRM --> L[Leads]
    CRM --> C[Clients]
    CRM --> Ag[Agents]
    CRM --> V[Vendors]

    SALES --> Q[Quotations]
    SALES --> B[Bookings]

    OPS --> T[Tasks]
    OPS --> DOC[Documents]
    OPS --> DESK[Service Desks: Visa · Ticket · Hotel]
    OPS --> HAJJ[Hajj/Umrah Ops optional]

    FIN --> INV[Invoices]
    FIN --> PAY[Payments]
    FIN --> ACC[Accounts & Reports]

    WEB[Website CMS] --> PUB[Public Agency Site]
  end

  Platform --> Tenant
  PUB --> L
```

### A2. Agent daily flow (6 steps)

```mermaid
flowchart LR
  subgraph In["Incoming"]
    PH[Phone / WhatsApp]
    WEBL[Website Lead Form]
    WALK[Walk-in]
  end

  PH & WEBL & WALK --> LEAD["① LEAD /leads"]
  LEAD -->|Convert| CLIENT["② CLIENT /clients"]
  CLIENT --> QUOTE["③ QUOTATION /quotations"]
  QUOTE -->|Approved| BOOK["④ BOOKING /bookings"]
  BOOK --> INV["⑤ INVOICE /invoices"]
  INV --> PAY["⑥ PAYMENT"]
  BOOK --> OPS["OPS Booking Details"]

  PKG["PACKAGE catalog"] -.->|optional| QUOTE
  PKG -.-> WEBPUB[Website display]
```

### A3. Signup → menu config (14 categories)

```mermaid
flowchart TB
  REG[Register Step 1: Name · Email · Agency]
  REG --> SVC[Register Step 2: Service Catalog Picker]

  subgraph Presets["6 Presets"]
    P1[Hajj Agency]
    P2[Tour Agency]
    P3[Visa Center]
    P4[Manpower]
    P5[Study Abroad]
    P6[Full Service]
  end

  SVC --> Presets
  SVC --> CAT["14 Main Categories · 135 Sub-services"]

  CAT --> SAVE["enabledSubcategories · enabledServiceTypes"]
  SAVE --> TRIAL["7-day Pro Trial → tenant created"]
  TRIAL --> MENU[Sidebar auto-filter]
  TRIAL --> DASH[Dashboard widgets]
```

### A4. Catalog → booking type mapping

```mermaid
flowchart LR
  subgraph Catalog["Signup Catalog (14)"]
    AT[Air Ticketing]
    HU[Hajj & Umrah]
    VP[Visa Processing]
    MP[Manpower]
    HO[Hotel]
    TR[Transport]
    TO[Tour Packages]
    CR[Cruise/Holiday]
    ST[Study Abroad]
    CO[Corporate]
    TD[Travel Docs]
    EV[Events]
    IN[Insurance]
    AD[Additional]
  end

  subgraph BookingTypes["Daily Bookings Menu"]
    BT1[Flight / Ticket]
    BT2[Hajj / Umrah]
    BT3[Visa]
    BT4[Hotel]
    BT5[Tour]
    BT6[Student]
    BT7[Manpower]
    BT8[Transport / Custom]
  end

  AT --> BT1
  HU --> BT2
  VP --> BT3
  HO --> BT4
  TO --> BT5
  ST --> BT6
  MP --> BT7
  TR --> BT8
  CR & CO & TD & EV & IN & AD --> BT8
```

### A5. Target sidebar (7 groups)

```mermaid
flowchart TB
  ROOT[TravelAgencyWeb ERP]

  ROOT --> D[Dashboard]
  ROOT --> CRM[CRM]
  ROOT --> SALES[Sales]
  ROOT --> CAT[Service Catalog]
  ROOT --> OPS[Operations]
  ROOT --> FIN[Finance]
  ROOT --> WEB[Website]
  ROOT --> SET[Settings]

  CRM --> L[Leads]
  CRM --> CL[Clients]
  CRM --> AG[Agents]
  CRM --> VE[Vendors]

  SALES --> QU[Quotations]
  SALES --> BK[Bookings tabs]

  CAT --> PK[Packages tabs by category]

  OPS --> TK[Tasks]
  OPS --> DC[Documents]
  OPS --> VD[Visa Desk]
  OPS --> TD[Ticket Desk]
  OPS --> HD[Hotel Desk]
  OPS --> HJ[Hajj/Umrah Ops]

  FIN --> IV[Invoices]
  FIN --> PY[Payments]
  FIN --> AC[Accounts]
  FIN --> RP[Reports]

  WEB --> TH[Theme Builder]
  WEB --> PB[Publish]
  WEB --> DM[Domain]

  SET --> TM[Team]
  SET --> RL[Roles]
  SET --> SB[Subscription]
  SET --> UG[User Guide]
```

### A6. Role organogram

```mermaid
flowchart TB
  OWNER[Owner / Manager]
  OWNER --> MGR[Manager]
  MGR --> SALES[Sales / Front Desk]
  MGR --> OPS[Operations]
  MGR --> ACC[Accounts]
  MGR --> HAJJ[Hajj Coordinator]

  SALES --> S1[Leads]
  SALES --> S2[Clients]
  SALES --> S3[Quotations]
  SALES --> S4[Bookings create]

  OPS --> O1[Booking Details]
  OPS --> O2[Visa / Ticket / Hotel Desk]
  OPS --> O3[Tasks & Documents]

  ACC --> A1[Invoices]
  ACC --> A2[Payments]
  ACC --> A3[Accounts & Reports]

  HAJJ --> H1[Hajj/Umrah Ops]
  HAJJ --> H2[Pilgrims & Groups]

  OWNER --> W1[Website CMS]
  OWNER --> W2[Team & Roles]
  OWNER --> W3[Subscription / Billing]
```

### A7. Hajj agency dual path

```mermaid
flowchart TB
  subgraph Normal["Standard sale"]
    L1[Lead] --> Q1[Quotation] --> B1[Booking Hajj/Umrah] --> I1[Invoice]
  end

  subgraph Bulk["Season management"]
    HO[Hajj/Umrah Ops]
    HO --> PKG2[Season Package]
    PKG2 --> GRP[Group]
    GRP --> PIL[Pilgrims]
    PIL --> COL[Collection / Due]
    PIL --> VIS[Visa Status]
  end

  B1 -.->|link| PIL
  PKG[Catalog Package] -.-> Q1
```

### A8. SaaS commercial flow (trial → paid)

```mermaid
flowchart TB
  SIGN[Agency Signup]
  SIGN --> TRIAL[Trial 7 days Pro features]
  TRIAL --> USE[Use ERP daily Lead to Booking]

  TRIAL -->|expiry| EXP[Status: EXPIRED]
  EXP --> BLOCK[Dashboard lock /subscription]
  BLOCK --> PAYCHOICE{Payment method}

  PAYCHOICE --> BK[bKash]
  PAYCHOICE --> SSL[SSLCommerz]
  PAYCHOICE --> BANK[Bank + proof upload]

  BK & SSL & BANK --> PREQ[Payment Request Pending]
  PREQ --> ADMIN[Super Admin Approve]
  ADMIN --> ACTIVE[Status: ACTIVE extended expiry]

  EXP --> NOTIFY[SMS / Email / WhatsApp renewal]
  NOTIFY --> BLOCK

  ADMIN --> SAALERT[Super Admin SMS TRIAL ENDED]
```

### A9. Technical stack

```mermaid
flowchart LR
  USER[Agency User Browser]
  USER --> FE[React Frontend app.travelagencyweb.com]
  FE --> API[Express API PM2 hearth-api]
  API --> DB[(PostgreSQL)]
  API --> SMS[SMS BulkSMSBD]
  API --> WA[WhatsApp]
  API --> EM[Email SMTP]
  API --> CRON[Cron expiry job]

  CUST[Customer] --> SITE[Tenant Website]
  SITE --> FE
```

### A10. Revised roadmap phases

```mermaid
flowchart LR
  P1["Phase 1: Simple UX · 7-group menu · bKash live"]
  P2["Phase 2: Visa/Ticket/Hotel desk · Support · B2B"]
  P3["Phase 3: Marketing auto · Tenant health · Ops polish"]

  P1 --> P2 --> P3

  OUT["Out of scope: Arabic · Multi-currency · Hotel allotment · Stripe"]
```

| Diagram | Shows |
|---------|--------|
| A1 | Platform → Tenant → Departments |
| A2 | **6-step** agent daily flow |
| A3 | Signup + **14 categories / 135 subs** |
| A4 | Catalog → Booking type mapping |
| A5 | **Target sidebar** (7 groups) |
| A6 | Role organogram |
| A7 | Hajj dual path |
| A8 | Trial → Paid SaaS |
| A9 | Tech stack |
| A10 | 3-phase roadmap |

---

*Implementation tickets: `WMP-1.1`, `WMP-2.1`, etc. · Maintainer: update on phase ship.*
