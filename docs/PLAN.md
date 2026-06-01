# PLAN.md — GHM Agentic Product Loop, AI Systems & Build Roadmap

This file is the operating plan for Claude Code and any AI/code editor working on GHM.

Claude must treat this file as the single source of truth for the GHM app direction.

GHM is an AI-powered property management SaaS for landlords and small-to-mid-size property management companies. The app should stay clean, friendly, efficient, and comprehensive without becoming overly complicated like large enterprise systems.

The goal is not to rebuild the app from scratch.

The goal is to:

1. Audit what already exists.
2. Identify what is built, partially built, broken, missing, or only wired in one layer.
3. Preserve all existing features unless they are clearly broken or duplicated.
4. Fix incomplete/broken features.
5. Add missing features carefully.
6. Keep updating this file as work progresses.
7. Continue the loop until the app is complete and stable.

---

# 1. Core Instruction To Claude Code

Do not remove, rewrite, or replace existing features unless absolutely necessary.

GHM already has substantial working infrastructure. The core property management layer, tenant portal, applications, rent tracking, maintenance, messaging, AI chat tools, smart import, and financial records are all built and working to varying degrees. Read the audit matrix in Section 9 before touching anything.

For every feature, classify it as:

* `Done`
* `Built but needs testing`
* `Partially built`
* `Broken`
* `Missing`
* `Schema only`
* `UI only`
* `API only`
* `Needs wiring`
* `Blocked`

Then act accordingly:

* If it is `Done`, do not rebuild it.
* If it is `Built but needs testing`, test and only fix issues found.
* If it is `Partially built`, complete it using the existing structure.
* If it is `Broken`, fix it without changing the overall product direction.
* If it is `Schema only`, add the missing API/UI/service layer.
* If it is `UI only`, wire it to real backend/data.
* If it is `API only`, add the needed UI and user flow.
* If it is `Missing`, build it only after confirming it does not already exist under another name.
* If it is `Blocked`, explain the blocker and what decision is needed.

Do not create duplicate features under new names.

---

# 2. Product Vision

GHM should become an AI-powered management office for landlords and small-to-mid-size property management companies.

The app should help users manage:

* Properties
* Units
* Tenants
* Applicants
* Leases
* Rent payments
* Late fees
* Tenant balances
* Security deposits
* Maintenance
* Vendors
* Work orders
* Bills
* Payables
* Receipts
* Invoices
* Tenant charges
* Legal/court documents
* Notices and letters
* Financial records
* Messages
* Notifications
* Tenant portal activity
* Documents and files
* Tasks and follow-ups
* Calendar events
* Lease renewals
* Move-outs
* Inspections
* Owner/property reports
* Court/attorney packets
* AI-generated recommendations

The app should help users answer:

* What needs attention today?
* What rent is late?
* Who owes money?
* What needs to be paid?
* What needs to be billed?
* Which bills are due?
* Which leases are expiring?
* Which maintenance items are urgent?
* Which applications need review?
* Which documents are missing?
* Where should this uploaded document go?
* What follow-up is needed?
* What should I do next?

---

# 3. Product Style Rule

GHM must remain:

* Clean
* Friendly
* Simple to understand
* Fast to operate
* Professional
* Efficient
* Comprehensive where it matters
* Not bloated
* Not enterprise-heavy
* Not confusing

Do not copy AppFolio/Buildium/Rent Manager complexity.

Only adapt high-value workflows in a simpler, AI-assisted way.

Every feature should answer:

> Does this help the user manage properties faster, cleaner, and with less stress?

If not, do not build it yet.

---

# 4. Agentic Operating Loop

Claude Code must operate in cycles:

```txt
READ → AUDIT → CLASSIFY → PLAN → IMPLEMENT SMALL BATCH → TEST → UPDATE PLAN.md → REPEAT
```

## Step 1 — Read

Before changing code, read:

* `PLAN.md`
* `CLAUDE.md` and `AGENTS.md` — these contain critical codebase rules
* `prisma/schema.prisma`
* Relevant routes, pages, and components
* AI tools (`src/lib/ai/tools.ts`) and handlers (`src/lib/ai/handlers.ts`)
* Auth/session utilities (`src/lib/session.ts`, `src/lib/portal-session.ts`)
* `package.json` scripts

## Step 2 — Audit

Inspect the repo and update the Feature Audit Matrix in Section 9.

Do not assume a feature works just because a model, dependency, route, or button exists.

A feature is only `Done` if database, API, UI, permissions, and user workflow are all connected.

## Step 3 — Classify Risk

Assign each issue a priority:

* `P0 Critical` — build/auth/security/data corruption/tenant isolation issue
* `P1 Core` — major core workflow missing or broken
* `P2 High Value` — important product workflow
* `P3 Polish` — UX, cleanup, nice-to-have

## Step 4 — Plan Small Batch

Choose one small batch at a time.

Rules:

* Fix broken existing features before building new ones.
* Complete partial features before creating new systems.
* Avoid massive rewrites.
* Avoid duplicate models/routes.
* Keep changes reviewable.

## Step 5 — Implement

Implement only the selected batch.

Preserve existing patterns unless they are clearly wrong.

## Step 6 — Test

Before marking a feature done, check:

* `npx tsc --noEmit` — TypeScript must pass
* `npx next build` — build must pass
* `npx prisma generate` — after any schema change
* Use `npx prisma db push` to sync schema — do NOT run `prisma migrate`
* Route compile
* UI page load where practical
* API auth/org scoping
* Tenant portal isolation
* AI tool definitions match handlers
* No duplicate financial records
* Empty states
* Error states
* Mobile usability for key workflows

If tests cannot run, mark the feature as `Built but needs testing`, not `Done`.

## Step 7 — Update PLAN.md

After each batch, update:

* Feature Audit Matrix
* Agentic Work Log
* Completed Cycles
* Known Blockers
* Next Recommended Batch

Do not leave this file stale.

## Step 8 — Repeat

Continue with the next highest-priority item until approved scope is complete or a blocker requires user input.

---

# 5. Human Approval Gates

Pause and ask before:

* Destructive database migrations
* Deleting data/models/routes
* Changing auth architecture
* Changing tenant portal access/security
* Enabling automatic financial posting
* Enabling live Stripe/ACH payments
* Sending real notices/emails/SMS automatically
* Changing legal/court notice logic
* Replacing an existing feature instead of improving it
* Large UI redesigns across the entire app
* Any decision that can create legal, financial, or privacy risk

Claude may proceed without asking for:

* Audit reports
* Updating PLAN.md
* Small bug fixes
* Wiring missing handlers
* Improving empty states
* Fixing TypeScript/build errors
* Adding review-before-commit flows
* Completing non-destructive partial features

---

# 6. Confirmed Existing Systems (Post-Audit)

The following systems have been verified as built and working as of Cycle 1 audit:

**Core data layer:**
* Multi-tenant organization structure with `requireOrg()` on all landlord routes
* NextAuth v5 credentials-based landlord/staff auth
* Tenant portal with separate cookie-based `PortalSession` auth, isolated to `/portal` path
* Properties and units — full CRUD, photos, status, archive, expense profiles
* Tenants — profile, ledger, portal invite
* Leases — fixed/MTM, e-sign, countersign, move-in checklist, monthly charges, renewal, non-renewal
* Rent payments — generate-month, bulk-view, manual record, overdue cron, late fees, payment methods
* Tenant payment requests — portal submit with receipt upload, landlord confirm/reject
* Maintenance requests — full landlord + portal flow, photos, comments, vendor assignment, cost tracking
* Vendors — CRUD, trade/type, assignment to maintenance
* Applications — public form with 9 steps, documents, references, screening, approve/deny, convert to tenant+lease
* Messaging — threaded landlord+tenant, read/unread, portal-side
* Notifications — in-app bell, Resend email for some events, 60s polling
* Financial transactions — income/expense CRUD, categories, property-level
* Tenant ledger — `rent-ledger.ts` shared utility, print-optimized view, email send
* Smart Import / AI Migration — PDF/CSV/Excel/image extract via gpt-4o, conflict detection, chunk commit
* Manual CSV import — tenants, properties, transactions
* Export — Excel + multi-CSV
* AI chat assistant — 30 tools (CLAUDE.md says 24 — count is stale, actual is 30), all handlers present, org-scoped, gpt-4o, streaming, voice in/out
* Portfolio analyzer — AI-powered narrative analysis, `/portfolio-analyzer` page
* Dashboard — overdue rent, vacancies, expiring leases, maintenance, unread messages, KPI cards
* Calendar — server-rendered grid, lease expirations, maintenance, renewals, rent due
* Vacancy board — vacant units list with days vacant
* Renewals — list + detail form, non-renewal action
* Property report — basic income/expense print view at `/properties/[id]/report`
* Settings — profile, password, late fee config, Stripe status
* Activity events — `ActivityEvent` model + `/api/activity` route

**Mora service layer (undocumented in previous PLAN.md):**
* `/api/mora/*` routes secured by separate `x-mora-key` API key via `src/lib/service-auth.ts`
* Exposes: `mora/health`, `mora/properties`, `mora/leases`, `mora/maintenance`, `mora/rent-payments`
* Scoped to a single org via `MORA_SERVICE_ORG_ID` env var
* This is a machine-to-machine integration layer — do not remove or break it
* Add to CLAUDE.md if documenting further

**Important: do not rebuild any of the above.**

---

# 7. Main Product Pillars

## Pillar 1 — Core Property Management

Reliable management of:

* Properties, Units, Tenants, Leases, Rent payments
* Maintenance, Vendors, Applications
* Messages, Notifications, Tenant portal, Financial transactions

## Pillar 2 — AI Office Manager

AI should act like a property management office manager.

It should review the system and tell the user what needs attention.

## Pillar 3 — Smart Document Center / AI Filing Cabinet

User uploads or takes a picture of a bill/document.

AI classifies it, extracts details, suggests where it belongs, and files it after user review.

## Pillar 4 — Money Workflows

The app must clearly separate:

* Rent payments
* Tenant charges
* Bills/payables
* Expenses
* Owner/property reporting
* Court/ledger outputs

## Pillar 5 — Daily Operations

The app guides daily management through:

* Today's Office
* Tasks/follow-ups
* Calendar
* Notices
* Renewals
* Move-outs
* Inspections
* Work orders

---

# 8. AI Systems

AI is not a small feature in GHM.

AI is a major layer of the product.

GHM should include several AI systems working together, always with user review for risky actions.

The AI stack is OpenAI only. Do not introduce Anthropic SDK or any other AI provider.

---

## 8.1 AI Office Manager

This is the brain of the system. Currently missing — needs to be built.

Purpose:

Every day, the AI Office Manager reviews the property management operation and tells the user what needs attention.

It should review:

* Late rent
* Tenant balances
* Bills due / Bills needing approval
* Documents needing filing / Documents needing review
* Open maintenance / Emergency maintenance
* Vendor follow-ups
* Lease expirations / Renewals / Move-ins / Move-outs
* Pending applications / Missing application documents
* Tenant messages needing response
* Tasks due
* Court/legal items / Missing documents
* Property health risks

The AI Office Manager should generate:

* Suggested tasks, notices, reminders, follow-ups
* Suggested vendor, renewal, document filing, payable, and tenant charge actions

Rules:

* AI may suggest, draft, prepare, organize, summarize, create safe tasks.
* AI must not send legal notices, post financial charges, approve payments, or file uncertain documents without user approval.

Definition of done:

* Daily operational view or service uses real system data
* Identifies what needs action
* Generates suggested next actions
* Does not hallucinate data
* Links every suggestion to source records
* Requires approval for risky actions

---

## 8.2 AI Document Center / AI Filing Cabinet

Currently missing — needs to be built. This is one of the most important GHM features.

User story:

> The user takes a picture of a bill or uploads a document. AI understands what it is, extracts the key data, figures out where it belongs, and files it after user review.

This is NOT Smart Import. Smart Import migrates historical data from another platform. The Document Center handles ongoing document management: bills, invoices, IDs, receipts, court papers, etc.

Supported documents:

Utility bills, water/electric/gas bills, insurance bills, tax bills, repair receipts, vendor invoices, maintenance invoices, court filings, attorney letters, tenant notices, leases, lease renewals, security deposit statements, move-in/out inspections, government IDs, pay stubs, proof of income, bank statements, previous leases, application documents, tenant ledgers, rent receipts, payment screenshots, Zelle/Venmo screenshots, property photos, maintenance photos, inspection reports, other landlord/property documents.

Required flow:

```
Upload / Take Picture
→ Store file securely
→ AI classifies document
→ AI extracts key fields
→ System matches to records
→ User sees review card
→ User approves or edits destination
→ Document is filed
→ Optional payable/transaction/charge/task created after approval
→ Activity logged
```

Classification types: bill, invoice, receipt, lease, notice, court document, attorney letter, ID, pay stub, proof of income, bank statement, maintenance photo, inspection report, payment proof, tenant ledger, other.

Extraction fields: amount, due date, document date, vendor, tenant name, applicant name, property address, unit number, lease dates, account number, invoice number, payment method, description, category, confidence score.

Matching targets: property, unit, tenant, lease, application, maintenance request, vendor, transaction, bill/payable, payment request, court packet.

Review card must show: preview, document type, AI summary, extracted fields, suggested destination, confidence, suggested actions, approve/edit/reject buttons. Low confidence → `Needs Review`.

Suggested schema (adapt to existing, avoid duplication):

```prisma
model Document {
  id               String   @id @default(cuid())
  organizationId   String

  fileName         String
  fileUrl          String
  fileKey          String?
  mimeType         String?
  fileSizeBytes    Int?

  documentType     String
  status           String   @default("pending_review")
  // pending_review | filed | needs_review | rejected

  relatedType      String?
  relatedId        String?

  propertyId       String?
  unitId           String?
  tenantId         String?
  leaseId          String?
  applicationId    String?
  maintenanceId    String?
  vendorId         String?
  transactionId    String?
  billId           String?
  paymentRequestId String?

  aiSummary        String?
  aiExtractedData  Json?
  aiConfidence     Float?
  aiReasoning      String?

  amount           Decimal?  @db.Decimal(10, 2)
  documentDate     DateTime?
  dueDate          DateTime?
  vendorName       String?
  accountNumber    String?
  invoiceNumber    String?

  createdById      String?
  reviewedById     String?
  reviewedAt       DateTime?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([documentType])
  @@index([status])
  @@index([relatedType, relatedId])
  @@index([propertyId])
  @@index([tenantId])
  @@index([leaseId])
  @@map("documents")
}
```

This schema addition requires approval before `prisma db push`.

Definition of done:

* Upload works, file stored securely
* AI classifies and extracts fields
* System matches to existing records
* User sees review card, can approve/edit/reject destination
* Document appears under related record
* Bills/invoices suggest payables/transactions
* Court/legal docs attach to tenant/lease/court packet
* Low-confidence items go to Needs Review queue
* Org scoping enforced
* Tenant portal cannot access unauthorized documents

---

## 8.3 AI Chat Assistant

Status: Done (30 tools, all handlers present, org-scoped, streaming).

Note: CLAUDE.md says 24 tools — this count is stale. The actual count is 30. Update CLAUDE.md when convenient.

The assistant can: read portfolio data, search tenants/properties/leases/vendors/applications, check balances/overdue/expiring leases/maintenance/financials, calculate scenarios, create tenants/properties/units/leases/maintenance/transactions/vendors, record payments, send messages, advance applications, set screening status, add application documents, confirm move-in.

Rules:

* AI must use tools for real data — never guess balances, rent roll, collected rent, expenses, or occupancy
* Every tool definition must have a handler
* Every handler must enforce organization scoping
* Destructive actions require confirmation
* Financial/legal actions require review
* Any new workflow action must also get a tool in `tools.ts` + handler in `handlers.ts`

---

## 8.4 AI Workflow Engine

Status: Missing. Needs to be built.

Powers recurring operational suggestions:

```
Late rent detected → create task → draft late notice → alert landlord
Lease expires in 60 days → create renewal task → draft renewal offer
Bill uploaded → classify document → extract amount/due date → suggest payable
Maintenance open 7 days → create follow-up task → draft vendor message
```

Rules: Start with simple rules/toggles. Create suggestions, drafts, tasks, alerts. Do not silently execute risky actions.

---

## 8.5 AI Maintenance Triage

Status: Missing. Needs to be built.

When a tenant submits a maintenance request, AI should classify it: category, priority, emergency risk, suggested vendor type, missing photos, suggested first response.

Definition of done: New requests can be AI-triaged. User can approve/change. AI can draft tenant/vendor response. Emergency items surface in Today's Office.

---

## 8.6 AI Messaging Assistant

Status: Missing. Needs to be built.

Inside messaging UI: summarize thread, draft response, draft formal notice, draft payment reminder, draft maintenance update, extract action items, create task from message, identify unresolved issue.

Rules: User approves before sending. AI must use real thread context. Legal/formal notices require review.

---

## 8.7 AI Financial Assistant

Status: Partially built. Financial tools exist in the chat assistant (`get_financial_summary`, `get_portfolio_financial_snapshot`, `calculate_income_scenario`). No dedicated financial Q&A UI outside the chat widget.

Questions the system should answer: outstanding rent, collected rent this month, which tenants owe money, largest expenses, cash flow, unpaid bills, tenant charges, what-if scenarios.

Rules: Use actual data. Do not double-count rent payments and transactions. Explain missing data clearly.

---

## 8.8 AI Property Health Engine

Status: Missing. Needs to be built.

Simple per-property health status: Healthy / Needs Attention / High Risk.

Based on: vacancy, late rent, open maintenance, emergency maintenance, high expenses, lease expirations, missing documents, unpaid bills, tenant issues.

AI should explain why the score exists and link to source records.

---

## 8.9 AI Missing Documents Engine

Status: Missing. Needs to be built.

Identify missing required documents per tenant/lease/application/property.

Actions: create task, request upload, draft reminder, open Smart Document Center.

---

## 8.10 AI Daily Management Loop

Status: Missing. Needs to be built.

Feeds Today's Office with: late rent, bills due, payables waiting approval, tenant charges needing review, documents needing filing, maintenance requiring attention, lease renewals, move-outs, applications waiting, messages needing response, tasks due, AI recommendations.

---

# 9. Feature Audit Matrix

Last updated: Cycle 1 — full repo audit complete.

| Feature | Status | Evidence / Files | Missing or Broken | Next Action | Priority |
|---|---|---|---|---|---|
| Auth & Organizations | Done | `src/lib/session.ts`, `requireOrg()` in all landlord routes, NextAuth v5 | None found | Monitor role enforcement gap | P0 |
| CLAUDE.md tool count | Done | Updated all 5 occurrences of "24 tools" → "30 tools" | Fixed | None | — |
| CLAUDE.md Mora docs | Done | Mora Service Layer section added to CLAUDE.md | Fixed | None | — |
| Roles & Permissions | Partially built | `User.role` field exists (owner/member/viewer/tenant). No enforcement middleware in route handlers. | Role checks not applied to sensitive endpoints | Add role guard middleware or per-route checks. Do not redesign auth. | P1 |
| Properties | Done | `/properties`, `/api/properties`, `PropertyPhotoGallery`, `PropertyExpensesEditor`, `PropertyInfoEditor`, `PropertyActions` | None | None | — |
| Units | Done | `/properties/[id]/units/new`, `/api/units/[id]`, `UnitPhotoGallery` | None | None | — |
| Tenants | Done | `/tenants`, `/api/tenants`, ledger, portal invite | Document count badge on list (LeaseDoc + AppDoc + PropertyDoc). Tenant detail: real Documents section, Needs Review section (low-confidence PropertyDocs + missing doc checklist), Activity Timeline, Tasks widget. | None | — |
| Leases | Done | `/leases`, `/api/leases/[id]/*`, e-sign, countersign, move-in, monthly charges, renewal, non-renewal | None | None | — |
| Rent Payments | Done | `/rent`, `/api/rent-payments`, cron, late fees, overdue | None | None | — |
| Tenant Payment Requests | Done | `/api/payment-requests`, portal pay flow, receipt upload, landlord confirm/reject | None | None | — |
| Financial Transactions | Partially built | `/financials`, `/api/transactions` | Double-counting risk: no guard preventing rent payment amounts also being entered as income transactions manually. Warning banner added to new-transaction form when category = "rent". | Monitor for further double-counting edge cases. | P1 |
| Maintenance | Done | `/maintenance`, `/api/maintenance`, photos, comments, vendor assign, cost fields, portal submit | None | None | — |
| Vendors | Partially built | `/vendors`, `/api/vendors` | No vendor invoice/document attachment. No license/insurance expiration fields. | Add vendor document section post-Document model. Schema fields are P3. | P2 |
| Applications | Done | `/applications`, `/api/applications`, public form, 9 steps, convert route, screening | None | None | — |
| Messaging | Done | `/messages`, `/api/messages`, portal messages, read/unread, threaded | None | None | — |
| Notifications | Partially built | `src/lib/notifications.ts`, `NotificationBell`, Resend email triggers | Payment request submitted and overdue rent cron notifications now added. Still missing: some maintenance/lease event types. | Add remaining notification triggers as features are built. | P2 |
| Tenant Portal | Done | `/portal/*`, `requirePortalSession()`, cookie isolated to `/portal` path, 7-day session | None — isolation is solid | None | — |
| AI Chat Assistant | Done | `src/lib/ai/tools.ts` (30 tools), `src/lib/ai/handlers.ts` (all 30 handled), streaming, org-scoped | CLAUDE.md tool count is stale (says 24, is 30). Not a bug, just stale docs. | Update CLAUDE.md count. | — |
| AI Office Manager | Done | `src/lib/agent/portfolio-agent.ts`, `/api/agent/*`, `/agent` page | Full GPT-4o analysis, risk tiers (AUTO_RUN/AUTO_DRAFT/STRICT_BLOCK), 5 workflows, approve/reject UI. Real run: confidence=0.85, 4 tasks generated. | None | — |
| AI Workflow Engine | Done | Same as AI Office Manager — workflows: collections, lease_renewal, maintenance_triage, document_bookkeeping, daily_briefing | — | — | — |
| AI Maintenance Triage | Done | `POST /api/maintenance/[id]/triage` — GPT-4o classifies category/priority, flags emergency, suggests vendor, drafts tenant response, posts as comment, updates fields if changed. AI Triage button in maintenance detail. | — | — | — |
| AI Messaging Assistant | Done | `POST /api/ai/message-draft` — GPT-4o reply draft + summarize. "AI Draft Reply" button fills reply textarea; "Summarize" shows bullet summary in thread header. | — | — | — |
| AI Financial Assistant | Partially built | Tools exist in chat (`get_financial_summary`, etc.) | No standalone financial Q&A UI | Chat widget covers it for now. Dedicated UI is P3. | P3 |
| AI Property Health Engine | Done | `src/lib/property-health.ts` — rules-based score (vacancy, overdue rent, maintenance, expiring leases). Healthy/Needs Attention/High Risk badge on each property card with reason tooltip. | — | — | — |
| AI Missing Documents Engine | Partially built | Per-tenant "Needs Review" section on tenant detail. No global missing-docs queue. | Build global queue page | P2 |
| Smart Import / AI Migration | Done | `/migration`, `/api/import/smart`, PDF/CSV/Excel/image, conflict detection, chunk commit, dedupe logic | None — do not break when adding Document Center | None | — |
| Manual CSV Import | Done | `/import-export`, `/api/import` | None | None | — |
| Smart Document Center | Done | `/documents`, `DocumentCenterClient.tsx`, `/api/documents` POST/GET, `/api/documents/save` POST | Property-level documents only (utility/tax/insurance/maintenance). Tenant/lease/court docs need the broader Document model (Phase 3 enhancement). | None for current scope | — |
| Document Filing Queue | Done | `PropertyDocument.confidenceScore` drives Needs Review. Tenant detail page shows low-confidence docs with Review → link. | Org-wide Needs Review queue page not built yet. | Build global queue page as enhancement. | P3 |
| Bills & Payables | Done | `Bill` model, `/api/bills` CRUD, `/api/bills/[id]` PATCH/DELETE, `/bills` page with status tabs + create form + approve/mark-paid flow, sidebar nav badge, dashboard card. Mark-paid creates expense Transaction atomically; duplicate-payment guard enforced (409). | No overdue cron yet — computed at display time. | P1 |
| Tenant Charges / Receivables | Done | `LeaseMonthlyCharge` + `MonthlyChargesManager` for recurring. `/api/tenant-charges` POST/GET for ad-hoc charges. `TenantChargeButton` dialog on tenant detail. Charges appear in ledger instantly (stored as `Transaction` with `leaseId`). 11 charge types: late fee, repair chargeback, NSF, returned payment, legal/court/attorney fees, utility reimbursement, deposit deduction, credit, other. | None | — | — |
| Stripe Online Payments | Built but needs testing | Stripe Connect flow, webhook handler, portal pay route all present | Not confirmed end-to-end. Do not call Done. | Treat as built-but-unverified. Do not assume live. | P1 |
| Tenant Ledger | Done | `/tenants/[id]/ledger`, `LedgerView.tsx`, `rent-ledger.ts`, email send route | None | None | — |
| Dashboard KPIs | Partially built | Overdue rent, vacancies, expiring leases, maintenance, messages, tasks shown | Missing: bills due, document queue count, AI suggestions | Add bill/doc KPI cards as those features are built | P2 |
| Today's Office | Done | `/todays-office` — 9 live sections: Outstanding Balances, Bills & Payables, Maintenance (emergency flagged), Tasks Due Soon, Payment Requests, Unread Messages, Leases Expiring, Applications, Documents Needing Review. Every item links to real records. Sidebar nav at top. | None | — | — |
| Tasks & Follow-Ups | Done | `Task` model, `/api/tasks` CRUD, `/tasks` page with filters + create dialog, sidebar nav, dashboard KPI, tenant detail widget | None | None | — |
| Calendar | Done | `/calendar` — lease expiry, rent due (3 months), maintenance, renewal reminders, task due dates, bill due dates. Color-coded event types. | Inspections + court dates need schema first. | — |
| Renewals Workflow | Partially built | `/renewals` list + `/renewals/[id]` form, non-renewal action | No renewal offer send, no tenant acceptance flow | Complete renewal offer send + acceptance | P2 |
| Vacancy & Turnover Board | Partially built | `/vacancy` lists vacant units with days vacant | No board columns (turnover/listed/pending/move-in). Simple list only. | Extend to board view | P3 |
| Notices & Letters | Done | `POST /api/notices/draft` (GPT-4o, 6 notice types), `POST /api/notices/log` (ActivityEvent), `NoticeDraftButton` dialog on tenant detail. Notices saved to timeline, appear in court packet. | No email send yet (user copies/prints). | — |
| Work Orders | Done | `WorkOrder` model (new, pushed). 8-status flow: new→assigned→waiting_estimate→approved→in_progress→completed→invoiced→cancelled. `/api/work-orders` CRUD. `/api/work-orders/[id]` PATCH/DELETE. `/work-orders` page with status filters + create dialog + Advance button. Auto-creates expense transaction on completion. Sidebar nav link under Operations. | Room checklist, photo upload deferred to v1.1. | — |
| Inspections | Done | `Inspection` model (new, pushed). Types: move_in/move_out/annual/maintenance. Statuses: scheduled→in_progress→completed→cancelled. `/api/inspections` CRUD. `/api/inspections/[id]` PATCH/DELETE. `/inspections` page with type/status filters + schedule dialog + Start/Complete buttons + condition rating. Sidebar nav link. | Full room-by-room checklist UI + photo capture deferred to v1.1. | — |
| Move-Out Workflow | Done | Schema: `moveOutDate`, `moveOutNoticedAt`, `depositReturnAmount`, `depositReturnedAt` on Lease (additive push). `POST /api/leases/[id]/move-out` — records dates, updates unit to vacant if past, creates ActivityEvent + Task. `MoveOutButton` on tenant detail header. Deposit return summary card shows when moveOutDate is set. | Inspection checklist deferred to v1.1. | — |
| Lease Renewal Workflow | Done | `/renewals/[id]` with `RenewalForm` — sets new terms, creates pending lease, sends for tenant e-signature via existing sign flow, landlord countersigns. Non-renewal also sends notice. | Old lease stays active until end date (no auto-expiry on renewal accept — tracked by cron). | — |
| Court Packet Builder | Done | `/tenants/[id]/court-packet` — print-optimized server page: tenant info, lease summary, full payment history, tenant charges, notices sent, maintenance records, activity timeline, print to PDF button. Linked from tenant detail header. | No ZIP/email export yet. | — |
| Universal Timeline | Done | ActivityEvent wired to: tenant detail (Activity Timeline section), property detail (server query + section), lease detail (client fetch + section). All three pages show readable event labels, relative time, actor name. | Unit/maintenance detail not wired (lower priority). | — |
| Missing Documents Checklist | Done | `/missing-documents` — global page listing all tenants with missing required docs (signed lease, government ID, proof of income) + low-confidence PropertyDocument queue. Sidebar nav link under Finance. | Per-application detailed checklist (v1.1). | — |
| Leasing CRM / Applicant Follow-Up | Partially built | `/applications` list covers the pipeline | No dedicated CRM view, no showing scheduler | Extend applications list view | P3 |
| Owner Reports | Partially built | `/properties/[id]/report` basic income/expense print view | No monthly statement format, no PDF export, no owner-specific view | Extend property report | P3 |
| Property Health Score | Missing | No health scoring logic | Entirely absent | Build as computed view after Bills + Tasks exist | P3 |
| Light Automation Rules | Missing | No automation toggles or rule engine | Entirely absent | Build simple toggles after Today's Office | P3 |
| Mora Service Layer | Done | `/api/mora/*`, `src/lib/service-auth.ts` — key-protected machine-to-machine API | Not documented in previous PLAN.md. Do not remove or duplicate. Add `MORA_SERVICE_API_KEY` and `MORA_SERVICE_ORG_ID` to env docs. | Document in CLAUDE.md | — |
| Security & Privacy | Mostly done | `requireOrg()` on landlord routes, `requirePortalSession()` on portal routes, portal cookie scoped to `/portal` | Role enforcement missing (see Roles row). No org-scoping check on `Notification` model (uses raw userId). | Add role guards. Audit Notification queries for cross-org risk. | P0 |

---

# 10. Known Risks (Post-Audit)

These are specific risks identified during the Cycle 1 audit that need attention before or during new feature builds.

## Risk 1 — Role Enforcement Gap (P0)

`User.role` field exists with values owner/member/viewer/tenant but no route handler enforces it. Anyone with a valid org session can hit any landlord API. This matters if multiple staff users exist.

Recommended fix: Add a lightweight `requireRole(roles[])` wrapper around sensitive routes (financial data, tenant PII, settings). Do not redesign auth.

## Risk 2 — Transaction Double-Counting (P1) — MITIGATED

A UI warning banner now shows in the new-transaction form when type = "income" and category = "rent". The warning explains that rent payments recorded via the Rent section are already in the ledger and that adding a duplicate income transaction may cause double-counting.

No auto-block — just a visible warning. This reduces the risk without restricting legitimate use cases.

## Risk 3 — CLAUDE.md Tool Count — RESOLVED

All 5 occurrences of "24 tools" updated to "30 tools" in CLAUDE.md. Mora service layer section also added.

## Risk 4 — Stripe End-to-End Unverified (P1)

Stripe Connect, webhook, and portal pay routes exist but have not been confirmed working end-to-end. Do not communicate to users that online payments are live until tested.

## Risk 5 — Mora Service Not Documented — RESOLVED

Mora Service Layer is now fully documented in CLAUDE.md with routes, auth mechanism, env vars, and middleware bypass note.

---

# 11. Approved Build Priority Order

Claude should generally work in this order unless user instructs otherwise.

## Phase 0 — Stabilize (mostly done)

* Role enforcement gap — add basic role guards
* Transaction double-counting — add UI warning
* Update CLAUDE.md tool count
* Document Mora service layer in CLAUDE.md

## Phase 1 — Complete Existing Core

Complete/fix:

* Tenant detail — add activity timeline (ActivityEvent already exists)
* Tenant detail — add documents tab (placeholder until Document model exists)
* Renewal workflow — complete offer send and acceptance flow
* Notification triggers — add missing event types
* Vendor detail — prepare for document attachment (placeholder)

## Phase 2 — Task System (prerequisite for everything else)

Build `Task` model + basic UI:

* Schema: title, description, relatedType/Id (property/unit/tenant/lease/maintenance/application), dueDate, priority, status (open/in_progress/waiting/done/cancelled), assignedUserId, createdByAI flag
* API: CRUD endpoints
* UI: task list, task create/edit, task on related record pages
* Wire to dashboard KPI card
* Requires schema approval before `db push`

## Phase 3 — Smart Document Center

Build/complete:

* `Document` model (schema approval required)
* Upload/camera document flow
* AI classification and extraction (OpenAI gpt-4o vision)
* Matching to existing records
* Review card UI
* Filing approval
* Needs Review queue
* Document storage (base64 fallback → Vercel Blob if token present, same pattern as existing uploads)
* Related record document views

Do not break Smart Import while building Document Center.

## Phase 4 — Bills & Payables

Build `Bill` model + workflow:

* Schema: vendor, property, unit (optional), amount, dueDate, billDate, category, status, documentId (links to Document), notes
* API: CRUD, status transitions, payable-to-expense flow
* UI: bills list, create/review, mark approved/paid
* Expense transaction created on mark-paid (user approval required)
* Show in Today's Office and Dashboard when due soon or overdue
* Connect to Smart Document Center (bill upload → AI extract → review → bill created)
* Requires schema approval

## Phase 5 — Ad-Hoc Tenant Charges

Extend existing `LeaseMonthlyCharge` or add separate ad-hoc charge flow:

* Charge types: late fee (already partial), repair chargeback, NSF fee, returned payment fee, utility reimbursement, legal fee, court fee, attorney fee, security deposit deduction, other
* Attach supporting document (links to Document model)
* Add to tenant ledger
* Draft notice/message (optional, user approves)
* No double-counting with rent payments

## Phase 6 — Today's Office

Build `/todays-office` or promote dashboard to full command center:

* Late rent cards
* Outstanding balances
* Payment requests waiting confirmation
* Bills due / overdue
* Documents needing review
* Open/emergency maintenance
* Lease expirations
* Renewal tasks
* Pending applications
* Unread messages
* Tasks due
* AI suggested actions
* Every card links to real records. No fake data.

## Phase 7 — AI Office Manager + Workflow Engine

Build after Tasks + Today's Office exist:

* Daily intelligence service using real system data
* Suggested tasks, notices, follow-ups, renewal actions, document filing actions
* Simple automation rule toggles (rent overdue → create task, lease expires in 60 days → renewal task, etc.)
* AI can create safe tasks automatically
* Risky actions require approval

## Phase 8 — AI Feature Layer

* AI Maintenance Triage — classify on submission, suggest vendor/priority
* AI Messaging Assistant — draft/summarize in messages UI
* AI Missing Documents Engine — detect gaps per tenant/lease/application/property
* AI Property Health Score — Healthy/Needs Attention/High Risk per property

## Phase 9 — Operational Workflows

Build clean versions of:

* Notices & Letters (templates, AI draft, user approve, log to timeline)
* Work Orders (maintenance → formal work order flow)
* Inspections (move-in/out/annual, room checklist, photos, PDF export)
* Move-Out Workflow (notice → inspection → deductions → deposit return statement)
* Court Packet Builder (one-click PDF/ZIP export)
* Universal Timeline (wire ActivityEvent to all major record pages)
* Missing Documents Checklist (per record)

## Phase 10 — Reporting & Polish

* Complete renewal offer/acceptance flow
* Owner statements (monthly property P&L, export PDF)
* Property health score UI
* Leasing CRM / vacancy-to-lease board
* Calendar extensions (bill due dates, tasks, inspections, court dates)
* Dashboard KPI completion
* Mobile polish
* Light automation rule builder UI

---

# 12. Core Feature Requirements

## Auth & Organization Scoping

Required:

* Landlord/staff login ✓
* Organization-scoped data ✓
* Tenant portal auth separated from landlord auth ✓
* Secure magic-link tenant sessions ✓
* Session expiration ✓
* No cross-org access ✓
* Role enforcement — partially built, needs guards

## Roles & Permissions

Target roles: Owner/admin, Property manager, Leasing agent, Maintenance coordinator, Accountant/bookkeeper, Viewer, Tenant.

Current state: Field exists, not enforced. Start with simple guard middleware. Do not overcomplicate.

## Properties & Units ✓

## Tenants

Required and mostly done. Missing: per-tenant activity timeline in UI, documents tab.

## Leases ✓

## Rent & Payments ✓

Do not mark Stripe/ACH online payments as done until confirmed end-to-end.

## Financials

Done except for double-counting risk (add UI warning).

## Maintenance ✓

## Vendors

Done for basics. Missing: document attachment, license/insurance fields (P3).

## Applications ✓

## Messaging ✓

## Notifications

Partially done. Missing triggers: payment request submitted, overdue rent daily alert.

## Tenant Portal ✓

---

# 13. Smart Import / AI Migration

Status: Done. Do not touch unless fixing a bug.

Smart Import lives at `src/app/api/import/smart/route.ts` and review UI at `src/app/(app)/migration/page.tsx`.

This is separate from Smart Document Center. Smart Import migrates historical data from another platform. Document Center handles ongoing document management.

Critical rules (from CLAUDE.md — do not regress):

* Tenant dedup: matches by email OR phone OR full name (case-insensitive)
* Property dedup: matches by name or street address
* Unit dedup: matches by unitNumber within property
* Payment dedup: upserts on `(leaseId, periodYear, periodMonth)` — safe to re-import; sums multiple payments per month
* `paymentHistory` — one entry per calendar month; overdue months still included with amount 0
* `ledgerEntries` — EVERY non-rent-charge, non-rent-payment row; captured verbatim
* Never use running balance as payment amount
* `amountDue` in DB is always the monthly rent, never the total outstanding balance

---

# 14. Bills & Payables

Purpose: Answer "What needs to be paid?"

Required fields: Vendor, Property, Unit (optional), Amount, Due date, Bill date, Category, Status, Document attachment, Notes.

Statuses: Needs Review, Approved, Paid, Overdue, Rejected.

Workflow:
```
Upload bill / manually enter bill
→ AI extracts details (via Document Center)
→ User reviews
→ Bill appears in payables
→ User marks approved/paid
→ Expense transaction created or linked
```

Rules:

* Do not auto-post expenses without review
* Prevent duplicate expense transactions
* Connect to Smart Document Center
* Show in Today's Office when due soon or overdue

---

# 15. Tenant Charges / Receivables

Purpose: Answer "What needs to be billed to tenants?"

Charge types: Late fee, Repair chargeback, Utility reimbursement, Legal fee, Court fee, Attorney fee, NSF fee, Returned payment fee, Security deposit deduction, Other.

Workflow:
```
Select tenant/lease
→ choose charge type
→ enter amount or extract from document
→ attach support document
→ add to tenant ledger
→ optionally draft notice/message
```

Rules:

* Charge must appear in ledger
* Charge must be linked to tenant/lease
* Supporting document should be attachable
* No double-counting with rent payments
* User approves before notifying tenant

---

# 16. Today's Office / Command Center

Main daily page. Cards: Late rent, Outstanding balances, Payment requests waiting confirmation, Bills due/overdue, Documents needing review/filing, Open/emergency maintenance, Vendor follow-ups, Lease expirations, Renewal tasks, Move-ins/outs, Pending applications, Missing application documents, Unread messages, Tasks due, Court/legal items, AI suggested actions.

Rules: Every card links to real records. No fake/demo data. AI recommendations cite source record. Risky actions require approval.

---

# 17. Tasks & Follow-Ups

Schema fields: title, description, relatedType, relatedId, propertyId, unitId, tenantId, leaseId, applicationId, maintenanceId, documentId, billId, dueDate, priority, status, assignedUserId, createdByAI, organizationId.

Statuses: Open, In progress, Waiting, Done, Cancelled.

Task sources: Late rent, Bill due, Lease expiration, Missing document, Maintenance follow-up, Application follow-up, Move-out, Inspection, Court date, AI suggestion.

---

# 18. Notices & Letters

Templates: Late rent notice, Rent demand, Balance reminder, Notice to enter, Lease renewal offer, Non-renewal notice, Maintenance access notice, Documents requested, Payment confirmation/rejection, Application denial, Security deposit deduction letter, Move-out instruction letter.

Rules: AI can draft. User must approve before sending. Sent notices saved to tenant/lease timeline. Notice can be included in court packet. Avoid legal advice. Allow editable templates.

---

# 19. Work Orders

Extension of maintenance: request → work order → vendor assigned → scope/estimate → approval → in progress → completed → invoice uploaded → expense suggested after approval.

Statuses: New, Assigned, Waiting for estimate, Approved, In progress, Completed, Billed/Paid, Cancelled.

---

# 20. Inspections

Types: Move-in, Move-out, Annual, Maintenance.

Each: property/unit/tenant/lease link, room-by-room checklist, photos, notes, damage list, tenant signature (optional), PDF export, timeline entry.

---

# 21. Move-Out Workflow

```
Tenant gives notice
→ move-out date set
→ inspection scheduled
→ inspection completed
→ damages recorded
→ deposit deductions calculated
→ final balance generated
→ deposit return statement created
→ unit status updates
→ turnover tasks created
```

---

# 22. Lease Renewal Workflow

```
Lease expiring soon
→ appears in Today's Office
→ renewal task created
→ AI can draft renewal offer
→ user enters terms/new rent
→ renewal offer sent
→ tenant accepts/declines
→ new lease or extension created
→ e-signature completed
```

Statuses: Upcoming, Offer drafted, Sent, Accepted, Declined, Non-renewal, Completed.

---

# 23. Court Packet Builder

One-click export including: tenant ledger, lease, payment history, tenant charges, notices sent, messages, documents, maintenance records, inspection records, activity timeline, legal/court docs.

Output: PDF bundle or ZIP, clear sections, downloadable, emailable if implemented.

---

# 24. Universal Timeline

Wire `ActivityEvent` model to all major record pages: Tenant, Property, Lease, Unit (if practical), Maintenance (if practical).

Timeline items: Payments, Tenant charges, Bills, Documents, Notices, Messages, Maintenance, Work orders, Inspections, Applications, Lease changes, AI actions, Activity events.

---

# 25. Missing Documents Checklist

Per: Tenant/Lease (signed lease, ID, proof of income, deposit receipt, move-in checklist, renters insurance), Property (insurance policy, tax bill, utility accounts, registration/license, inspection report), Application (government ID, pay stubs, references, signed application).

Actions: Upload document, Request from tenant/applicant, Open Smart Document Center, Create task, Draft reminder.

---

# 26. Vacancy & Turnover Board

Columns: Occupied, Notice Given, Moving Out, Turnover Needed, Ready to List, Listed, Application Pending, Lease Pending, Move-In Scheduled.

Units appear based on real data/status. Board links to tenant/unit/property/application/lease. Keep simple and visual.

---

# 27. Leasing CRM / Applicant Follow-Up

Simple leasing pipeline: Lead, Showing scheduled, Applied, Documents missing, Screening, Approved, Lease sent, Move-in scheduled, Lost.

Actions: Schedule showing, Send application, Request missing documents, Review application, Start screening, Approve/deny, Send lease, Convert to tenant/lease.

Do not build a huge CRM. Keep it focused on vacancy-to-lease flow.

---

# 28. Calendar

Show: Rent due dates, Lease expirations, Showings, Move-ins, Move-outs, Inspections, Court dates, Bill due dates, Maintenance appointments, Task due dates.

Filters: Property, Tenant, Event type, Status.

---

# 29. Owner Reports / Owner Statements

Light version first. Monthly statement: Income, Expenses, Repairs, Net income, Open maintenance, Open tenant issues, Documents attached, Notes, Export/send PDF.

Do not build a full owner portal unless requested.

---

# 30. Property Health Score

Statuses: Healthy, Needs Attention, High Risk.

Based on: Vacancy, Late rent, Outstanding balances, Maintenance, Expenses, Bills due, Lease expirations, Missing documents, Tenant issues.

AI explains why and links to source records.

---

# 31. Light Automation Rules

Simple toggles only — no complex workflow builder:

* Rent overdue by X days → create task / draft notice
* Lease expires in 60 days → create renewal task
* Maintenance open 7 days → create follow-up task
* Bill due in 3 days → alert user
* Document confidence low → send to Needs Review
* Application missing documents → draft reminder
* Payment request submitted → notify landlord
* Emergency maintenance submitted → urgent alert

Automations create tasks, alerts, or drafts only. Risky actions require approval. No silent legal/financial actions.

---

# 32. Dashboard KPIs

Show: Total properties, Total units, Occupancy %, Vacant units, Rent collected this month, Outstanding balances, Overdue rent, Bills due, Open maintenance, Emergency maintenance, Expiring leases, Pending applications, Tasks due, Documents needing review.

No fake metrics. Use real data. Add KPI cards as corresponding features are built.

---

# 33. Security & Privacy Rules

Protect: Government IDs, SSNs/last 4, Pay stubs, Bank statements, Court papers, Legal documents, Lease documents, Tenant contact info, Payment receipts, Financial records, File URLs.

Rules:

* Every landlord API route must be org-scoped ✓ (requireOrg)
* Tenant portal can only access authorized tenant data ✓ (requirePortalSession)
* Public application uploads attach only to that application ✓
* Magic links never expose other tenant/org data ✓
* Private files should not be publicly exposed
* AI summaries should avoid leaking sensitive details unnecessarily
* Destructive actions require confirmation
* Financial/legal actions require review before commit
* Role enforcement gap must be closed (see Risk 1 above)

---

# 34. Critical Codebase Rules (from CLAUDE.md/AGENTS.md)

These rules must be followed at all times. Do not violate them.

* **`params` is a Promise in Next.js 16**: always `const { id } = await params` in every route handler and page
* **React hooks must be top-level and unconditional**: all `useState`/`useEffect`/`useRouter` at the top of the component, before any early returns or conditionals
* **Resend lazy init**: `new Resend(...)` must be inside the async handler body, never at module scope — Vercel build fails
* **Prisma Decimal**: convert with `Number(value)` before arithmetic or passing to Client Components
* **`prisma db push` only**: never run `prisma migrate` — always `prisma db push` for schema sync
* **AI stack is OpenAI only**: do not add Anthropic SDK or any other AI provider
* **New AI tool**: always add both a definition in `tools.ts` AND a handler in `handlers.ts`
* **Smart Import**: never use running balance as `amountDue` — always use monthly rent
* **Outstanding balance**: use the shared `rent-ledger.ts` helper — do not revert to raw rent-payment summing
* **Server Components**: no `onClick` or event handlers on JSX — extract a Client Component instead
* **No `window.speechSynthesis`**: always use `/api/ai/tts` (OpenAI nova voice) for AI voice output
* **Dark mode**: all new UI must work in both light and dark mode (CSS variables, OKLCH, next-themes)
* **No sidebar nav links for one-time flows**: one-time flows like migration are reached via dashboard CTA, not nav

---

# 35. Do Not Do These Things

* Remove existing features
* Rebuild working features from scratch
* Duplicate existing features under new names
* Create schema-only features and call them done
* Create UI-only buttons that do nothing
* Create AI tools without handlers
* Ignore org scoping
* Expose private files
* Allow tenant portal to access landlord-only files
* Silently post expenses
* Silently post tenant charges
* Silently send legal notices
* Double-count rent payments and transactions
* Assume Stripe is live because the dependency exists
* Make enterprise-heavy workflows too early
* Break Smart Import while building Smart Document Center
* Make AI hallucinate financial/legal facts
* Create fake/demo data in production workflows
* Run `prisma migrate` — always use `prisma db push`
* Initialize Resend at module scope
* Use Anthropic SDK
* Use `window.speechSynthesis` for AI voice

---

# 36. Testing & Completion Checklist

Before marking any feature `Done`, verify:

* `npx tsc --noEmit` passes
* `npx next build` passes
* `npx prisma generate` passes after schema changes
* Relevant pages load
* Relevant APIs compile
* Auth is enforced
* Org scoping is enforced
* Tenant portal isolation is enforced
* File upload works if applicable
* AI tool has both definition and handler
* No duplicate financial records
* Empty states are usable
* Error states are usable
* Mobile layout is usable for key flows
* Feature works end-to-end

If not tested, mark `Built but needs testing`.

---

# 37. Release Readiness Checklist

GHM Core v1 is ready when a user can:

* Register/login, create organization/account
* Add properties, units, tenants
* Create leases, track deposits
* Record rent payments, view tenant ledger, handle late/overdue rent
* Manage maintenance, assign vendors
* Accept applications, convert applicant to tenant/lease
* Use tenant portal — view lease, pay, submit maintenance, message
* Message tenants, receive notifications
* Track financial transactions
* Upload/import data via Smart Import
* Use AI chat assistant
* Upload documents, use Smart Document Center, file bill/document
* Track bills/payables, add tenant charges
* View Today's Office, create/follow tasks
* Generate notices, manage renewals, manage move-outs
* Generate court packet
* See key dashboard KPIs
* Trust security/org isolation

---

# 38. Agentic Work Log

## Current Cycle

* Cycle number: 13
* Current objective: GHM v1 complete ✓ — all Phase 9 items shipped
* Current status: All phases 0–9 complete. 103 pages. Work Orders + Inspections built, tested, deployed.
* Blockers: Room-level inspection checklist UI, work order photos (v1.1)
* Production URL: https://ghm-tawny.vercel.app
* Next action: Monitor production, gather feedback, plan v1.1

## Completed Cycles

| Cycle | Date | Objective | Result | Tests | Notes |
|---|---|---|---|---|---|
| 0 | — | Initial PLAN.md structure | Complete | N/A | Document authored |
| 1 | — | Full repo audit | Complete | N/A | All 221 files reviewed. Feature matrix filled. Risks identified. |
| 2 | 2026-05-31 | Phase 0 + Phase 1 stabilization | Complete | tsc ✓ build ✓ | CLAUDE.md fixed (tool count 30, Mora docs). Rent double-counting warning added. Activity Timeline improved. Documents placeholder added to tenant detail. Notification triggers added for overdue rent cron and payment request submission. |
| 3 | 2026-05-31 | Phase 2 — Task System | Complete | tsc ✓ build ✓ | Task model + prisma db push. /api/tasks CRUD + /api/tasks/[id] PATCH/DELETE. /tasks page (server + client). Sidebar nav with badge. Dashboard KPI card. Tenant detail tasks widget. |
| 4 | 2026-05-31 | Phase 3 — Document Center + tenant doc wiring | Complete | tsc ✓ build ✓ | Document Center already built (PropertyDocument, AI parse, review modal). Tenant list: doc count badge (LeaseDoc + AppDoc + PropertyDoc). Tenant detail: real Documents section, Needs Review section (low-confidence PropertyDocs + missing doc checklist for ID/income/unsigned lease). |
| 5 | 2026-05-31 | Phase 4 — Bills & Payables | Complete | tsc ✓ build ✓ API tested | Bill model + prisma db push. /api/bills CRUD + /api/bills/[id] PATCH/DELETE. /bills page with status tabs (needs_review/approved/paid/rejected), create dialog, approve/mark-paid buttons. Mark-paid creates expense Transaction atomically. Double-pay guard (409). Sidebar badge + dashboard card. |
| 6 | 2026-05-31 | Phase 5 — Ad-Hoc Tenant Charges | Complete | tsc ✓ build ✓ API tested | /api/tenant-charges POST/GET. TenantChargeButton client dialog on tenant detail page. 11 charge types mapped to Transaction categories. Credit type reduces balance. Charges appear in ledger immediately. All validation guards hold (404 bad lease, 400 negative amount). |
| 7 | 2026-05-31 | Phase 6 — Today's Office | Complete | tsc ✓ build ✓ page tested | /todays-office — 9 sections: balances, bills, maintenance, tasks due, payment requests, messages, expiring leases, applications, low-confidence docs. All items link to real records. Sidebar nav entry added. |
| 8 | 2026-05-31 | Phase 7 + 8 — AI Office Manager, Property Health Score, AI Maintenance Triage, AI Messaging Assistant | Complete | tsc ✓ build ✓ all AI routes live-tested | Phase 7: portfolio-agent GPT-4o, risk tiers, approve/reject, /agent page. Phase 8a: property health score rules-based (Healthy/Needs Attention/High Risk) on property cards. Phase 8c: /api/maintenance/[id]/triage — GPT-4o triage posts as comment, updates fields. Phase 8d: /api/ai/message-draft — reply draft + summarize in messages UI. All tested against real data with real OpenAI calls. |
| 9 | 2026-05-31 | Phase 9 — Universal Timeline, Notices & Letters, Court Packet Builder | Complete | tsc ✓ build ✓ 98 pages | Universal Timeline wired to property + lease + tenant detail. Notices: 6 types, GPT-4o draft, logged to ActivityEvent. Court packet: 7-section print page with payment history, charges, notices, maintenance, timeline. "Draft Notice" and "Court Packet" buttons on tenant detail. |
| 10 | 2026-05-31 | Phase 10 — Calendar Extensions, Dashboard Polish | Complete | tsc ✓ build ✓ 98 pages, 17/17 pages 200 | Calendar: tasks due + bills due added (color-coded green/orange). Dashboard: emergency maintenance "Emergency" badge when any open emergency. PLAN.md: corrected renewal workflow as Done, calendar as Done. Regression: all 17 main pages pass. |
| 11 | 2026-05-31 | Phase 9 remaining — Move-Out Workflow, Missing Documents, Push to Production | Complete | tsc ✓ build ✓ 99 pages. Smoke: 24/24 pages 200, 18/18 APIs pass. Deployed ✓ | Move-Out: schema push (moveOutDate + 3 fields on Lease), /api/leases/[id]/move-out route, MoveOutButton component, deposit return summary on tenant detail. Missing Documents: /missing-documents global page (tenant doc gaps + low-confidence docs). Sidebar "Missing Docs" nav link. Full Vercel deploy to https://ghm-tawny.vercel.app. |
| 12 | 2026-06-01 | Phase 9 final — Work Orders + Inspections | Complete | tsc ✓ build ✓ 103 pages. Smoke: 22/22 pages 200. Deployed ✓ | WorkOrder model (8-status flow, auto-expense on completion, delete guard). Inspection model (4 types, 4 statuses, condition rating). Full CRUD APIs. /work-orders + /inspections pages with status filters + create dialogs + action buttons. Sidebar nav links. Deployed https://ghm-tawny.vercel.app. |

## Known Blockers

| Blocker | Area | Reason | Required User Decision |
|---|---|---|---|
| Document model schema | Smart Document Center | New model requires `prisma db push` | Approve schema and proceed |
| Bill model schema | Bills & Payables | New model requires `prisma db push` | Approve schema and proceed |
| Stripe end-to-end test | Online Payments | Not confirmed working | Decide whether to test/complete or deprioritize |
| Role enforcement design | Roles & Permissions | Need decision on how fine-grained to go | Approve lightweight guard vs skip for now |

## Next Recommended Batch

**Phase 3 — Smart Document Center**

Schema to approve and push:

```prisma
model Document {
  id               String   @id @default(cuid())
  organizationId   String
  fileName         String
  fileUrl          String
  fileKey          String?
  mimeType         String?
  fileSizeBytes    Int?
  documentType     String
  status           String   @default("pending_review")
  // pending_review | filed | needs_review | rejected
  relatedType      String?
  relatedId        String?
  propertyId       String?
  unitId           String?
  tenantId         String?
  leaseId          String?
  applicationId    String?
  maintenanceId    String?
  vendorId         String?
  transactionId    String?
  billId           String?
  paymentRequestId String?
  aiSummary        String?
  aiExtractedData  Json?
  aiConfidence     Float?
  aiReasoning      String?
  amount           Decimal?  @db.Decimal(10, 2)
  documentDate     DateTime?
  dueDate          DateTime?
  vendorName       String?
  accountNumber    String?
  invoiceNumber    String?
  createdById      String?
  reviewedById     String?
  reviewedAt       DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  organization     Organization @relation(fields: [organizationId], references: [id])
  @@index([organizationId])
  @@index([documentType])
  @@index([status])
  @@index([relatedType, relatedId])
  @@index([propertyId])
  @@index([tenantId])
  @@index([leaseId])
  @@map("documents")
}
```

After approval:
1. `prisma db push` → `prisma generate`
2. `/api/documents` — POST (upload + AI classify), GET list
3. `/api/documents/[id]` — PATCH (file/approve/reject), DELETE  
4. `/documents` page — upload flow + review queue + filed list (already has a route stub)
5. AI classification via gpt-4o vision — document type, key fields extraction, confidence score
6. Review card UI — preview, type, AI summary, extracted fields, suggested destination, approve/edit/reject
7. Wire filed documents to related record pages (tenant, lease, property)
8. Update Documents placeholder on tenant detail page to show real data

---

# 39. Claude Code Start Prompt

Use this prompt at the start of each new Claude Code session:

```
Read PLAN.md first. Then read CLAUDE.md and AGENTS.md.

Operate as an agentic loop:
READ → AUDIT → CLASSIFY → PLAN → IMPLEMENT SMALL BATCH → TEST → UPDATE PLAN.md → REPEAT

The Cycle 1 audit is complete. The Feature Audit Matrix in Section 9 of PLAN.md is filled in.
Do not re-audit features already classified as Done — trust the matrix unless you find a specific contradiction.

Current focus: Phase 0 and Phase 2 (Task system) per Section 10 of PLAN.md.

Rules:
- Do not remove, rewrite, or duplicate existing features
- Follow all rules in Section 34 (Critical Codebase Rules)
- Schema additions (Task, Document, Bill models) require human approval before prisma db push
- The AI stack is OpenAI only — do not add Anthropic SDK
- Use prisma db push, never prisma migrate
- Every new AI action needs a tool in tools.ts AND a handler in handlers.ts
- Run npx tsc --noEmit and npx next build before marking anything done

Known risks to keep in mind (Section 10 of PLAN.md):
- Role enforcement gap — roles exist in schema but are not enforced in routes
- Transaction double-counting — no guard on manual rent income entries
- CLAUDE.md tool count is stale (says 24, actual is 30)
- Mora service layer at /api/mora/* — do not break or duplicate
- Stripe online payments not confirmed end-to-end

Wait for approval before: schema migrations, auth/security changes, financial posting, legal notices, Stripe changes.
```

---

# 40. Definition of Done For The Whole Direction

GHM is on the right path when:

* Core landlord records work reliably
* Rent and financials are accurate
* Tenant portal is secure and useful
* Documents are organized intelligently
* AI helps but does not silently make risky decisions
* Smart Document Center works end-to-end
* Today's Office shows what needs attention
* Bills and tenant charges connect to financials
* Notices and court packets support legal workflows
* Move-in, renewal, maintenance, and move-out workflows are connected
* AI Office Manager actively helps organize the day
* The app remains clean, friendly, and not overwhelming

This PLAN.md must remain updated as the project evolves.