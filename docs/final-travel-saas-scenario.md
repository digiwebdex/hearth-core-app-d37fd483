# Final Travel Agency SaaS Scenario

## Product Direction

Build the platform as a unified multi-service travel agency SaaS instead of a Hajj/Umrah-only system.

A single agency can enable multiple service areas at the same time, such as:

- Hajj & Umrah
- Domestic Tour
- International Tour
- Visa Processing
- Air Ticketing
- Hotel Booking
- Transport / Car Rental
- Cruise / Launch Booking
- Study Abroad
- Medical Tourism
- Corporate Travel
- B2B Agent / Sub-Agent

## Core Principle

Do **not** rewrite the current core system. Extend it safely.

Reusable backbone:

- Lead
- Quotation
- Booking
- Invoice
- Payment
- Account / Transaction
- Website / CMS
- Subscription / Payment Request

All new service modules should reuse this common flow.

---

## Final Navigation Structure

### Overview
- Dashboard

### Sales / CRM
- Leads
- Clients
- Agents
- Vendors
- Quotations

### Services & Operations
- Packages & Services
- Bookings
- Tasks

### Finance
- Invoices
- Payments
- Accounts
- Reports

### Website & Marketing
- Website
- Blog / News
- Testimonials
- SEO
- Domains / Publish

### Management
- Team
- Roles & Permissions
- Organization
- Subscription
- Notifications
- Settings
- User Guide

### Super Admin
- Agencies
- Pending Signups
- Plans
- Features
- Domains
- Payment Requests
- SMS Templates
- SMS Logs
- Reports
- Audit Log

---

## Unified Packages & Services Module

Merge the current package manager and the old Hajj & Umrah entry into one unified module:

### Packages & Services

Service type filters:

- Hajj & Umrah
- Domestic Tour
- International Tour
- Visa
- Air Ticket
- Hotel
- Transport
- Cruise
- Study Abroad
- Medical Tourism
- Corporate Travel
- Custom

### Inside the module

#### Catalog / Template Layer
- Package create / edit / delete
- Service type
- Itinerary builder
- Inclusions / exclusions
- Image gallery
- Pricing slabs
- Seasonal pricing
- Visa requirement
- Terms / cancellation rules
- Publish / draft / archive
- Featured package selection

#### Service-specific operation tabs

When a package or service type needs specialized workflow, show extra tabs:

- Hajj & Umrah: pilgrims, groups, rooming, visa, installments
- Visa: applicants, embassy status, submission, interview, passport return
- Ticketing: PNR, airline, sector, baggage, issue, reissue, refund
- Hotel: rooms, nights, confirmation, voucher, allotment
- Transport: route, vehicle, pickup, driver, vendor cost
- Corporate: traveler approval, company billing, monthly statement
- Study Abroad: admission, document checklist, visa status
- Medical Tourism: hospital, doctor reference, travel bundle tracking

---

## Multi-Service Agency Setup

At signup or onboarding, allow agencies to select **multiple** service types.

Recommended selectable options:

- Hajj/Umrah
- Tour & Holiday
- Visa Processing
- Air Ticketing
- Corporate Travel
- Study Abroad
- Medical Tourism

This should enable relevant modules, menus, defaults, and website sections.

---

## Final Core Workflow

Universal operational flow:

1. Lead
2. Quotation
3. Booking / Service Case
4. Invoice
5. Payment
6. Vendor Payable
7. Profitability / Reporting

This same flow should work across tours, tickets, visas, hotels, transport, and Hajj/Umrah.

---

## High-Value Modules

### Package Management
- Tour package CRUD
- Itinerary builder
- Day-wise plan
- Inclusion / exclusion
- Gallery
- Seasonal pricing

### Booking Management
- Inquiry to quotation to booking to invoice to payment
- Passenger list
- Passport / NID upload
- Status tracking
- Cancellation / refund

### Ticketing Module
- PNR
- Airline
- Sector
- Baggage
- Fare and due date
- Issue / reissue / refund

### Visa Module
- Document checklist
- Embassy status
- Submission date
- Interview date
- Passport return date

### Hotel & Vendor Management
- Hotel suppliers
- Room allocation
- Transport vendors
- Supplier payable
- Guide / vendor costing

### Accounting Module
- Income / expense
- Customer due
- Supplier payable
- Agent commission
- Profit per booking
- Cash / bank / mobile banking ledger

### CRM & Lead Management
- Website lead
- Facebook / WhatsApp lead
- Follow-up reminder
- Pipeline
- Lead source report

### Website + CMS
- Website builder
- Package pages
- Blog / news
- Testimonials
- Contact form
- Custom domain
- SEO fields

### B2B Agent Portal
- Sub-agent login
- Package view
- Booking submit
- Commission wallet
- Due statement

### Communication
- SMS
- Email
- WhatsApp-ready integration layer
- Invoice reminder
- Payment reminder
- Tour reminder
- Visa alert
- Passport expiry alert

---

## Bangladesh Market Essentials

- bKash / Nagad / Rocket / Bank Transfer
- Manual payment approval
- Bangla + English UI
- Passport expiry alert
- Visa document upload
- Installment tracking
- Agent commission settlement
- Blackout dates / holiday calendar
- Coupon / promo code
- Traveler insurance option

---

## Safe Rollout Rules

This repository is already used in testing and should be treated as a live-prep system.

### Do not break these core areas
- Auth / login / register
- Tenant isolation
- Booking CRUD
- Invoice / payment / accounts / transactions
- Subscription / payment requests
- Domain / website publishing
- Existing Hajj data

### Safe engineering rules
- Additive schema only when possible
- No destructive migrations
- New columns nullable by default
- Preserve backward compatibility
- Reuse current APIs where safe
- Ship phase by phase with regression checks

---

## Phased Implementation Roadmap

### Phase 1 — Foundation
- Travel package catalog
- Package-service linkage on quotation and booking
- Public website package feed

### Phase 1B / 1C / 1D
- Nested itinerary, inclusions, pricing, media
- Public website publishing
- Booking package snapshot visibility
- Navigation cleanup and Bangla labels

### Phase 2 — Unified UX
- Rename and merge into Packages & Services
- Remove duplicate Hajj menu confusion
- Reorder sidebar by business flow
- Keep Bangla default UI consistent

### Phase 3 — Service Operations
- Visa operations
- Ticketing operations
- Hotel operations
- Transport operations
- Group departures

### Phase 4 — Finance & Automation
- Installments
- Commissions
- Reminders
- Supplier payable depth
- Renewal automation

### Phase 5 — Growth Modules
- B2B portal
- Corporate travel
- Study abroad
- Medical tourism

---

## Production Readiness Checklist

Before production approval, verify at minimum:

- Login / logout / session flow
- Bangla default labels
- Sidebar visibility by role
- Package CRUD
- Quotation from package
- Booking conversion from quotation
- Invoice and payment flow
- Account and transaction flow
- Subscription and payment request flow
- Domain mapping and public website
- Public package display
- Old Hajj flows still work
- No regression in tenant data isolation

---

## Final Goal

The system should feel like one organized travel business OS where a tenant can manage:

- Sales
- Operations
- Finance
- Website
- Team
- Subscription

from one clean Bangla-first interface, while still supporting multiple travel service types inside one agency account.
