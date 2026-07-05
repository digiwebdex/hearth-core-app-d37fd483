# 01 — Vision

> 🧊 **ARCHITECTURE FREEZE (v2) — 2026-07-05.** Authoritative frozen design: [11-Architecture-Freeze](11-Architecture-Freeze.md).
> - Scope is **Bangladesh-first**. "Global-ready" is aspirational only — multi-currency and internationalization are **postponed to the Future Roadmap** ([11 §Future Roadmap](11-Architecture-Freeze.md)).

> **Product:** TravelAgencyWeb (TAWSS) · **Codename/repo:** Hearth Core App · **Domain:** travelagencyweb.com · **API process:** `hearth-api`

## One-line vision

> **Lead → Payment, in one place.** Pick from 14 service categories at signup; run every service line through the same 6 daily steps.

*(Bangla: "Lead থেকে Payment — এক জায়গায়। ১৪টি সার্ভিস ক্যাটাগরি সাইনআপে বেছে নিন, দৈনন্দিন কাজ একই ৬ ধাপে।")*

## What it is

A **multi-tenant travel-agency ERP + SaaS platform**: sell services → manage bookings → collect money → optionally publish a branded agency website — with deep **Hajj/Umrah operations** for pilgrimage agencies. One cloud "travel business OS" replacing spreadsheets and fragmented tools.

## The problem

Travel agencies juggle disconnected tools: spreadsheets for clients, WhatsApp for leads, paper for bookings, separate books for accounts, a third-party site for web presence. Nothing reconciles. TAWSS unifies the entire **sales-to-cash lifecycle** — CRM, Sales, Operations, Finance, Website, Team, and Subscription — behind one interface, usable by **non-technical agency staff**.

## Who it's for

Travel agency **owners and their staff**. A single agency can run many service lines at once (Hajj, tours, visa, air ticketing, manpower, study abroad, corporate, MICE…). Staff personas map to the app's roles: Owner, Manager, Sales/front-desk, Operations, Accountant, plus Hajj coordinators. See [03-Master-Organogram](03-Master-Organogram.md).

## Design principles

1. **Agent-first / Bangla-first.** 10-group menu, a universal 6-step daily flow, empty states and errors in EN/BN. An agency should start real work within **~5 minutes** of signup.
2. **Show only what you sell.** At signup an agency picks service categories; unused modules stay hidden. Menus derive from `enabledServiceTypes` — see [04-Service-Modules](04-Service-Modules.md).
3. **One flow, every service.** Lead → Client → Quotation → Booking → Invoice → Payment (+ Ops) works identically across all 14 service types — see [05-Workflow-Book](05-Workflow-Book.md).
4. **Tenant isolation is sacred.** Every row is scoped by `tenantId`; one agency can never see another's data — see [02-Business-Architecture](02-Business-Architecture.md) and [10-Development-Rules](10-Development-Rules.md).

## The 5 product pillars

| # | Pillar | "Question it answers" | Covers |
|---|--------|-----------------------|--------|
| 1 | **CRM** | *Who* | Leads, Clients, Agents, Vendors |
| 2 | **Catalog** | *What you sell* | Service Packages (reusable templates) |
| 3 | **Sales** | *Deals* | Quotations, Bookings |
| 4 | **Operations** | *Deliver the trip* | Booking ops (checklist/docs/travelers), Hajj/Umrah ops, Tasks |
| 5 | **Money & Web** | *Get paid & get found* | Invoices, Payments, Accounts; Website CMS |

**Golden rule:** *Package = reusable catalog template. Booking = one customer's sale. Hajj/Umrah Operations = many pilgrims under one season (the bulk special case).*

## Market scope

**Bangladesh-first, global-ready.** EN/BN UI; payment focus on **bKash, SSLCommerz, bank transfer, and manual proof + admin approval**. Deliberately **out of scope for now:** Arabic/RTL, multi-currency, hotel allotment contracts as core, international card gateways (Stripe), live GDS/flight APIs (a possible future premium add-on). The architecture is multi-tenant and global-capable; the *product scope* is intentionally BD-centric.

## Success metrics

- **Signup → first booking within 48 hours.**
- **Trial → paid within 30 days.**

## Naming

The product is referred to interchangeably as **TravelAgencyWeb / TAWSS** (product/marketing) and **Hearth Core App** (repo/codename); production hosts live on `travelagencyweb.com` and the API PM2 process is `hearth-api`.

---
*See also: [02-Business-Architecture](02-Business-Architecture.md) · [04-Service-Modules](04-Service-Modules.md) · [05-Workflow-Book](05-Workflow-Book.md)*
