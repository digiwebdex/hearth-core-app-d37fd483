# Video tutorial scripts — TravelAgencyWeb

Ready-to-record scripts for the 10 in-app tutorials. Record with any screen
recorder (OBS Studio is free) using the **demo Pro account** so the screen is
already full of realistic data:

- URL: `https://app.travelagencyweb.com/login`
- Login: `demo@travelagencyweb.com` / `DemoPass@2026`

**Production tips**
- 1280×720 or 1080p, 25–30 fps. Zoom the browser to 110–125% so text is readable.
- Keep each video to the target length; short beats thorough.
- Record English and Bangla voiceovers over the same screen capture (the UI
  switches language with the top-bar button, so you can film both).
- After uploading to YouTube (unlisted is fine), paste each link into the
  matching `userGuide.videoTutorials.items[].url` value in
  `src/i18n/locales/en.json` and `bn.json`, then redeploy — the "Coming soon"
  buttons become "Watch".

Each script below has: **Goal**, **Show** (on-screen actions), and **Say**
(narration). Bangla narration follows the same beats — translate the "Say" lines.

---

## 1. Getting started & your dashboard · 4 min

**Goal:** First login, orient the user, read the dashboard.

**Show → Say**
1. Login screen → type demo credentials, sign in.
   *"Welcome to TravelAgencyWeb. Log in with the email and password your agency was given."*
2. Point to the language button top-right.
   *"The system opens in English. One tap here switches everything to Bangla, and back."*
3. Land on the Dashboard; sweep across the top cards.
   *"This is your home base. These cards show revenue, dues, bookings and profit for the current period."*
4. Scroll to the follow-up strip.
   *"Below, the follow-up list shows the customers you need to contact today — this is the one screen you open every morning."*
5. Click a card to jump to its list, then back.
   *"Click any number to jump straight to the details behind it."*
6. Point to the sidebar groups.
   *"Everything is grouped in the left menu: contacts, sales and bookings, money, and settings. We'll cover each in the next videos."*

---

## 2. Add a client & upload documents · 3 min

**Goal:** Create a client, store passport, set expiry alert.

**Show → Say**
1. Sidebar → Clients. Click "New client".
   *"Your clients are your most valuable asset. Let's add one."*
2. Enter name and phone.
   *"Only name and phone are required — everything else is optional but useful."*
3. Add passport number and set passport expiry a few months out.
   *"Add the passport number and expiry. The system will alert you before it lapses — a lifesaver for travel."*
4. Save. Open the client's profile.
   *"Open any client to see their full history — every booking, invoice and payment in one place."*
5. Upload a document (any PDF/image).
   *"Upload passport scans and documents right here, so you never dig through email again."*
6. Show the corporate toggle.
   *"For companies, mark the client as corporate to track all their staff travel together."*

---

## 3. Create & send a quotation · 4 min

**Goal:** Build a price quote and share it.

**Show → Say**
1. Sidebar → Quotations → New.
   *"When a customer wants a formal price, send a quotation."*
2. Pick a client, set destination and travellers.
   *"Choose the client, destination and number of travellers."*
3. Start from a package to auto-fill, or add line items manually.
   *"Start from one of your packages to fill the details instantly, or add line items yourself — flights, hotel, transport."*
4. Show the total and profit.
   *"The system totals it and shows your profit as you go."*
5. Save and set status to Sent.
   *"Send it to the customer and track whether it's accepted or rejected."*
6. Click "Convert to booking".
   *"When they say yes, convert it to a booking in one click — nothing gets retyped."*

---

## 4. Turn an inquiry into a booking · 5 min

**Goal:** The core sales flow — inquiry → confirmed booking.

**Show → Say**
1. Sidebar → Bookings → New. Set type and client.
   *"Here's the heart of the system. Someone just asked for a price — let's capture them."*
2. Set status to **Inquiry**. Save.
   *"Set the status to Inquiry. That's it — ten seconds, and they're saved."*
3. Go to Dashboard; show them in the follow-up list.
   *"They now appear on your Dashboard under follow-ups, so you never forget them."*
4. Back on the booking, enter selling amount and cost.
   *"When they're ready, add the selling price and your cost — profit is calculated automatically."*
5. Change status to **Confirmed**.
   *"Change the status to Confirmed and the deal is locked in."*
6. Click "Create invoice".
   *"Then raise the invoice straight from the booking — on to getting paid."*

---

## 5. Raise an invoice & record payment · 4 min

**Goal:** Invoice, take an advance, track the balance.

**Show → Say**
1. From a confirmed booking, click "Create invoice".
   *"From the booking, generate the invoice — the totals are already filled in."*
2. Show the invoice with total, paid, due.
   *"You always see exactly what's owed."*
3. Click "Add payment"; enter an advance, choose bKash.
   *"Record the first payment — cash, bKash, bank or card. Let's take a bKash advance."*
4. Save; show the balance update.
   *"The balance updates instantly, everywhere."*
5. Go to Invoices list; point to an overdue one.
   *"Overdue and partly-paid invoices are highlighted here and on your Dashboard, so nothing is missed."*
6. Mention installments.
   *"For Hajj or big tours, record each installment as it comes in — the system keeps the running balance."*

---

## 6. Dues, expenses & the ledger · 5 min

**Goal:** Receivables, expenses, and reading accounts.

**Show → Say**
1. Sidebar → Invoices; filter to overdue/partial.
   *"First, money coming in. Filter to see who still owes you."*
2. Sidebar → Expenses → New. Add an expense (rent/marketing).
   *"Now money going out. Log every expense with a category, so your profit is real."*
3. Sidebar → Accounts & Ledger.
   *"Everything flows into your accounts automatically."*
4. Show cash/bank balances and the ledger.
   *"See your cash, bank and bKash balances, and every transaction in the ledger."*
5. Point to receivables vs payables.
   *"Receivables is what customers owe you; payables is what you owe suppliers."*
6. Click Export CSV.
   *"Export any of it for your accountant in one click."*

---

## 7. Reports & business insights · 3 min

**Goal:** Read the reports.

**Show → Say**
1. Sidebar → Financial Reports. Set a date range.
   *"Reports turn your data into decisions. Pick a date range."*
2. Sales report.
   *"Sales shows revenue and bookings over time."*
3. Profitability.
   *"Profitability shows selling price minus cost — per booking and overall."*
4. Payments and receivables.
   *"See what came in by method, and what's still outstanding by customer."*
5. Staff/agent performance.
   *"And who on your team is driving the revenue."*
6. Export.
   *"Export any report to share or keep."*

---

## 8. Manage your team & roles · 3 min

**Goal:** Invite staff, assign roles.

**Show → Say**
1. Sidebar → Staff Members. Click invite.
   *"Add your team so everyone has their own login."*
2. Enter email, pick a role (e.g., Sales agent).
   *"Choose a role — Owner, Manager, Sales agent, Accountant or Operations."*
3. Sidebar → Roles & Permissions; show what each role sees.
   *"Each role sees only the parts of the system it needs."*
4. Note the accountant separation.
   *"Keep your accountant separate from booking approval — it protects your cash."*
5. Show deactivate.
   *"When someone leaves, deactivate them and their access ends immediately."*

---

## 9. Settings, plan & optional modules · 4 min

**Goal:** Branding, plan, switching modules.

**Show → Say**
1. Sidebar → Organization Profile. Set name, logo, phone.
   *"Your agency's identity appears on invoices, quotes and your website — set it here."*
2. Sidebar → Subscription & Plan.
   *"Your plan sets your limits and which modules you can use."*
3. Sidebar → Settings → Optional modules.
   *"This is where advanced modules live — Hajj desk, website builder, HR, sub-agents."*
4. Show the "Business & Ultimate" locks on a Pro account.
   *"On Basic and Pro, these are locked. Business and Ultimate owners switch them on here whenever they need them."*
5. Show notification preferences.
   *"Set which events send you alerts — new bookings, payments and inquiries."*

---

## 10. Switch language (English ⇄ Bangla) · 1 min

**Goal:** Show the language toggle.

**Show → Say**
1. Point to the language button in the top bar.
   *"The whole system works in English and Bangla."*
2. Tap it; the interface flips to Bangla.
   *"One tap switches everything — menus, buttons, labels."*
3. Tap again; back to English.
   *"Tap again to switch back. Your choice is remembered next time."*
4. Note per-user.
   *"Each staff member picks their own language — it doesn't change it for anyone else."*

---

## Suggested playlist order

Start (1) → Clients (2) → Quotation (3) → Booking (4) → Invoice (5) →
Finance (6) → Reports (7) → Team (8) → Settings (9) → Language (10).

Total runtime ≈ 36 minutes across 10 short videos.
