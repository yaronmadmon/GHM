# GHM Agentic Product Loop, Audit Reference & Build Roadmap

This file is the operating document for Claude Code and any AI/code editor working on GHM.

It is not only a product description. It is an agentic loop: Claude should use this file to repeatedly audit, plan, implement, test, update status, and continue until the approved scope is complete.

GHM is an AI-powered property management SaaS for landlords and small-to-mid-size management companies. It should stay clean, friendly, efficient, and comprehensive without becoming AppFolio-level complicated.

The main product direction is:

1. Core property management must work reliably.
2. AI should reduce manual work.
3. Documents, bills, charges, maintenance, rent, notices, and daily tasks should be organized around real landlord workflows.
4. The app should feel like an AI-powered management office.

---

# 1. Agentic Operating Rule

Claude Code should not treat this as a one-time checklist.

Claude Code should operate in cycles:

```txt
READ → AUDIT → CLASSIFY → PLAN → IMPLEMENT SMALL BATCH → TEST → UPDATE THIS FILE → REPEAT
```

The loop continues until one of these stop conditions is reached:

- All approved priority items are marked `Done`.
- A blocking issue requires user approval.
- A database migration, destructive refactor, payment/legal/security decision, or major architecture decision requires confirmation.
- Tests/build cannot pass after reasonable fixes and the blocker must be reported.

Claude should not wander into random features. Every action must connect back to this file.

---

# 2. Agentic Loop Steps

## Step 1 — Read

Before making changes, Claude must read:

- `docs/GHM_PRODUCT_TARGET_AND_AUDIT.md`
- Prisma schema
- relevant routes
- relevant components/pages
- AI tools and handlers
- package scripts
- existing migrations if needed

## Step 2 — Audit

Claude must inspect the current repo and classify each feature as:

- `Done`
- `Built but needs testing`
- `Partially built`
- `Broken`
- `Missing`
- `Schema only`
- `UI only`
- `API only`
- `Needs wiring`
- `Blocked`

A feature is only `Done` if database, API, UI, permissions, and user flow are connected.

## Step 3 — Classify Risk

For every issue, assign:

- `P0 Critical` — app/security/data corruption/build broken
- `P1 Core` — major core workflow broken or incomplete
- `P2 High Value` — important product workflow
- `P3 Polish` — UX cleanup or nice-to-have

## Step 4 — Plan Small Batch

Claude should select one small batch at a time.

Rules:

- Prefer fixing broken existing features before new features.
- Prefer completing partial features before creating new systems.
- Avoid massive rewrites.
- Avoid duplicate models/routes.
- Keep changes easy to review.

## Step 5 — Implement

Implement only the selected batch.

Claude should:

- Follow existing project patterns.
- Preserve org scoping.
- Preserve tenant portal isolation.
- Avoid double-counting rent/payments/transactions.
- Avoid silently posting financial or legal actions.
- Require user review for risky AI suggestions.

## Step 6 — Test

Before marking anything done, Claude should run/check:

- TypeScript
- Build
- Prisma generate
- route compile
- UI load where practical
- API auth/org scoping
- tenant portal isolation
- AI tool definitions match handlers
- no duplicate financial records
- empty/error states

If a test cannot run, Claude must state why and mark as `Needs testing`, not `Done`.

## Step 7 — Update This File

After every batch, Claude must update the status tables in this file.

Do not leave this file stale.

Update:

- feature status
- completed work
- remaining issues
- blockers
- next recommended batch

## Step 8 — Repeat

Claude should continue the loop using the next highest-priority item.

---

# 3. Human Approval Gates

Claude must pause and ask before:

- destructive database migrations
- deleting data/models/routes
- changing auth/security architecture
- changing tenant portal access rules
- enabling automatic financial posting
- enabling live Stripe/ACH payments
- sending real emails/SMS/notices automatically
- changing legal/court notice logic
- major UI redesigns that affect the whole app
- replacing an existing feature instead of improving it

Claude may proceed without asking for:

- audits
- status updates
- small bug fixes
- wiring missing handlers
- improving empty states
- fixing TypeScript/build errors
- adding non-destructive UI around existing data
- adding review-before-commit flows

---

# 4. Product Style Rule

GHM must remain:

- clean
- friendly
- simple to understand
- fast to operate
- comprehensive where it matters
- not bloated
- not enterprise-heavy
- not confusing

Do not copy AppFolio complexity. Adapt the workflow value only.

Every feature should answer:

> Does this help the user manage properties faster, cleaner, and with less stress?

---

# 5. Main Product Pillars

## Pillar 1 — Core Management

Reliable management of:

- properties
- units
- tenants
- leases
- rent payments
- maintenance
- vendors
- applications
- messages
- notifications
- tenant portal
- financial transactions

## Pillar 2 — AI Management Office

AI should help answer:

- What needs to be paid?
- What needs to be billed?
- What rent is late?
- Which tenants owe money?
- What leases are expiring?
- What maintenance requests are open?
- Which bills are due?
- Which documents are missing?
- Where should this uploaded document go?
- What should I do next?

## Pillar 3 — Smart Document Center

The user can upload or take a picture of a bill/document, AI classifies it, extracts details, suggests where it belongs, and files it after review.

## Pillar 4 — Money Workflows

The app should clearly separate:

- rent payments
- tenant charges
- bills/payables
- expenses
- owner/property reporting
- court/ledger outputs

## Pillar 5 — Daily Operations

The app should guide daily work through:

- Today’s Office
- tasks/follow-ups
- calendar
- notices
- renewals
- move-outs
- inspections
- work orders

---

# 6. Current Feature Audit Matrix

Claude must update this table after every audit/build cycle.

| Feature | Status | Evidence / Files | Missing or Broken | Next Action | Priority |
|---|---|---|---|---|---|
| Auth & Organizations | Unknown | TBD | TBD | Audit org scoping/auth routes | P0 |
| Roles & Permissions | Unknown | TBD | TBD | Verify role enforcement | P1 |
| Properties | Unknown | TBD | TBD | Audit CRUD/UI/status/photos | P1 |
| Units | Unknown | TBD | TBD | Audit CRUD/status/photos | P1 |
| Tenants | Unknown | TBD | TBD | Audit profile/ledger/docs | P1 |
| Leases | Unknown | TBD | TBD | Audit CRUD/signing/move-in/docs | P1 |
| Rent Payments | Unknown | TBD | TBD | Audit generation/manual/overdue/late fees | P1 |
| Tenant Payment Requests | Unknown | TBD | TBD | Audit portal request + landlord confirm/reject | P1 |
| Financial Transactions | Unknown | TBD | TBD | Audit P&L/cashflow/double-counting | P1 |
| Maintenance | Unknown | TBD | TBD | Audit portal+landlord+photos+comments | P1 |
| Vendors | Unknown | TBD | TBD | Audit CRUD/assignment/invoices | P2 |
| Applications | Unknown | TBD | TBD | Audit public form/docs/conversion | P1 |
| Messaging | Unknown | TBD | TBD | Audit landlord+portal/read/unread | P1 |
| Notifications | Unknown | TBD | TBD | Audit bell/email/events | P2 |
| Tenant Portal | Unknown | TBD | TBD | Audit isolation/session/payment/maintenance/messages | P0 |
| AI Chat Assistant | Unknown | TBD | TBD | Verify tools and handlers | P1 |
| Smart Import / AI Migration | Unknown | TBD | TBD | Audit extract/review/commit/conflicts | P1 |
| Smart Document Center | Unknown | TBD | TBD | Verify if exists; complete or build | P1 |
| Bills & Payables | Unknown | TBD | TBD | Add/audit bill workflow | P2 |
| Tenant Charges / Receivables | Unknown | TBD | TBD | Add/audit tenant charge workflow | P2 |
| Notices & Letters | Unknown | TBD | TBD | Add/audit templates + logging | P2 |
| Work Orders | Unknown | TBD | TBD | Add/audit maintenance-to-work-order flow | P2 |
| Inspections | Unknown | TBD | TBD | Add/audit move-in/out/annual inspections | P2 |
| Move-Out Workflow | Unknown | TBD | TBD | Add/audit move-out/deposit flow | P2 |
| Lease Renewal Workflow | Unknown | TBD | TBD | Add/audit renewal statuses/actions | P2 |
| Court Packet Builder | Unknown | TBD | TBD | Add/audit export bundle | P2 |
| Today’s Office | Unknown | TBD | TBD | Add/audit command center | P1 |
| Tasks & Follow-Ups | Unknown | TBD | TBD | Add/audit task system | P2 |
| Calendar | Unknown | TBD | TBD | Add/audit calendar events | P3 |
| Universal Timeline | Unknown | TBD | TBD | Add/audit timeline per record | P2 |
| Missing Documents Checklist | Unknown | TBD | TBD | Add/audit checklist system | P2 |
| Owner Reports | Unknown | TBD | TBD | Add/audit light monthly statements | P3 |
| Security & Privacy | Unknown | TBD | TBD | Audit sensitive file/data exposure | P0 |

---

# 7. Approved Build Priority Order

Claude should generally work in this order unless the user instructs otherwise:

## Phase 0 — Stabilize

Fix:

- build errors
- TypeScript errors
- Prisma errors
- broken auth
- broken org scoping
- broken tenant portal isolation
- broken AI tool handlers
- broken critical routes

## Phase 1 — Complete Existing Core

Complete or fix:

- properties/units
- tenants
- leases
- rent payments
- financials
- maintenance
- applications
- messaging
- tenant portal
- smart import

## Phase 2 — Smart Document Center

Build or complete:

- upload/camera document flow
- AI classification
- extraction
- matching to records
- review card
- file destination approval
- document storage/indexing
- low-confidence Needs Review queue

## Phase 3 — Money Workflows

Build or complete:

- bills & payables
- tenant charges/receivables
- suggested transactions from documents
- charge support documents
- no double-counting rules

## Phase 4 — Today’s Office

Build the daily command center:

- late rent
- bills due
- docs needing review
- maintenance
- lease expirations
- pending applications
- unread messages
- tasks due
- AI suggested actions

## Phase 5 — Operational Workflows

Build clean versions of:

- notices & letters
- work orders
- inspections
- move-out workflow
- lease renewal workflow
- court packet builder
- universal timeline
- missing documents checklist

## Phase 6 — Reporting & Polish

Add/tighten:

- owner statements
- property health score
- calendar
- mobile polish
- UX cleanup

---

# 8. Core Feature Requirements

## Auth & Organization Scoping

Required:

- landlord/staff NextAuth login
- organization-scoped data
- tenant portal auth separated from landlord auth
- magic-link tenant sessions
- no cross-org access
- role enforcement if roles exist

Done only when every API route is scoped correctly.

## Properties & Units

Required:

- create/edit/delete/archive properties
- create/edit/delete units
- photos
- vacancy/status summary
- property expense profile
- property detail with units, tenants, leases, maintenance, financials, docs, activity

## Tenants

Required:

- full profile
- emergency contact
- lease history
- ledger
- documents
- messages
- portal status
- activity timeline

## Leases

Required:

- fixed/month-to-month
- link tenants and unit
- deposit tracking
- documents
- e-signature
- countersignature
- move-in checklist
- expiration reminders
- renewal workflow eventually

## Rent & Payments

Required:

- monthly rent records
- pending/partial/paid/overdue
- manual payments
- tenant payment requests
- receipt upload
- late fees
- overdue cron
- ledger/statement
- clear distinction between real online payments and manual records

Do not mark Stripe/ACH as done unless a real checkout/ACH/card flow exists.

## Financials

Required:

- income/expense transactions
- categories
- property-level financials
- P&L/cashflow
- portfolio snapshot
- no double-counting between rent payments and transactions

## Maintenance

Required:

- tenant submits request
- landlord manages request
- priority/status
- vendor assignment
- photos/comments
- estimated/actual cost
- optional conversion to expense

## Applications

Required:

- public invite link
- multi-step form
- documents
- references
- screening/status
- signature
- approve/deny
- convert to tenant/lease

## Messaging & Notifications

Required:

- landlord/tenant threads
- portal messages
- read/unread
- related records
- in-app notifications
- email notifications where appropriate

## AI Chat Assistant

Required:

- every tool in `tools.ts` has a handler
- every handler is org-scoped
- destructive actions require confirmation
- financial answers use real data tools
- no hallucinated balances/expenses

---

# 9. Smart Document Center Definition

This is a major differentiator.

User story:

> User takes a picture of a bill. AI understands what it is, extracts the key details, figures out where it belongs, and files it after review.

Supported documents:

- utility bills
- water/electric/gas bills
- insurance bills
- tax bills
- repair receipts
- vendor invoices
- maintenance invoices
- court filings
- attorney letters
- tenant notices
- leases
- lease renewals
- security deposit statements
- move-in/move-out inspections
- government IDs
- pay stubs
- proof of income
- bank statements
- previous leases
- tenant ledgers
- rent receipts
- payment screenshots
- property photos
- maintenance photos

Required flow:

1. Upload or camera capture.
2. Store file securely.
3. AI classifies document type.
4. AI extracts fields.
5. System matches property/unit/tenant/lease/application/maintenance/vendor/transaction.
6. User sees review card.
7. User approves/edits filing destination.
8. Document is filed.
9. If bill/invoice/receipt, app suggests transaction or payable.
10. Low confidence goes to Needs Review.
11. Activity event is logged.
12. Document appears under related record.

Suggested document model:

```prisma
model Document {
  id              String   @id @default(cuid())
  organizationId  String
  fileName        String
  fileUrl         String
  fileKey         String?
  mimeType        String?
  fileSizeBytes   Int?
  documentType    String
  status          String   @default("pending_review")
  relatedType     String?
  relatedId       String?
  propertyId      String?
  unitId          String?
  tenantId        String?
  leaseId         String?
  applicationId   String?
  maintenanceId   String?
  vendorId        String?
  transactionId   String?
  aiSummary       String?
  aiExtractedData Json?
  aiConfidence    Float?
  aiReasoning     String?
  amount          Decimal? @db.Decimal(10, 2)
  documentDate    DateTime?
  dueDate         DateTime?
  vendorName      String?
  accountNumber   String?
  invoiceNumber   String?
  createdById     String?
  reviewedById    String?
  reviewedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id])

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

Claude should adapt this to existing schema and avoid duplication.

---

# 10. Bills & Payables

Purpose:

Answer: what needs to be paid?

Required:

- bill/vendor name
- property/unit
- amount
- due date
- bill date
- status: needs review / approved / paid / overdue
- document attachment
- category: utility / repair / insurance / tax / management / other
- mark paid
- create/link expense transaction

Must connect to Smart Document Center.

---

# 11. Tenant Charges / Receivables

Purpose:

Answer: what needs to be billed to tenants?

Charge types:

- late fee
- repair chargeback
- utility reimbursement
- legal fee
- court fee
- attorney fee
- NSF fee
- returned payment fee
- other tenant charge

Required:

- tied to tenant/lease
- appears on ledger
- optional support document
- optional notice/message
- no double-counting with rent payments

---

# 12. Today’s Office / Command Center

Purpose:

One page that tells the manager what needs attention today.

Cards:

- late rent
- payment requests waiting confirmation
- bills/documents needing review
- open maintenance
- emergency maintenance
- lease expirations
- applications waiting review
- unread messages
- move-ins/move-outs
- tasks due
- AI suggested next actions

Each card must link to real records.

---

# 13. High-Value Workflows To Add Cleanly

## Notices & Letters

Templates:

- late rent notice
- rent demand
- balance reminder
- notice to enter
- lease renewal offer
- non-renewal notice
- maintenance access notice
- documents requested
- payment confirmation/rejection
- application denial
- security deposit deduction letter

AI can draft; user approves before sending. Sent notices are logged.

## Work Orders

Maintenance request → work order → vendor → estimate → approval → completed → invoice → expense.

## Inspections

Move-in, move-out, annual, maintenance inspections with photos, checklist, notes, damages, signatures, PDF export.

## Move-Out Workflow

Notice received → move-out date → inspection → damages → deposit deductions → final balance → deposit return statement → unit status update → turnover tasks.

## Lease Renewal Workflow

Expiring lease → renewal task → offer drafted → sent → accepted/declined → new lease/extension signed.

## Court Packet Builder

One-click export for attorney/court:

- ledger
- lease
- payment history
- charges
- notices
- messages
- documents
- maintenance if relevant
- activity timeline

## Universal Timeline

Every tenant/property/lease should show payments, charges, docs, notices, messages, maintenance, inspections, AI actions, and activity events.

## Missing Documents Checklist

Show missing required docs per tenant/lease/property/application and allow upload/request.

## Calendar

Events for rent due, lease expirations, showings, move-ins, move-outs, inspections, court dates, bill due dates, maintenance appointments, task due dates.

## Owner Statements

Light version first: monthly property income, expenses, repairs, net income, open issues, documents, export/email PDF.

---

# 14. Security & Privacy Rules

Protect:

- IDs
- SSNs/SSN last 4
- pay stubs
- bank statements
- court/legal docs
- leases
- payment receipts
- tenant contact info
- financial records

Rules:

- every document route is org-scoped
- tenant portal sees only authorized tenant documents
- public application uploads attach only to that application
- magic links never expose other tenants/files
- file URLs are not public unless intentionally designed
- AI summaries should not leak sensitive data unnecessarily
- destructive actions require confirmation
- financial/legal actions require review before commit

---

# 15. Testing & Completion Checklist

Before marking a feature `Done`, verify:

- TypeScript passes
- build passes
- Prisma generate passes
- relevant pages load
- relevant APIs compile
- auth is enforced
- org scoping is enforced
- tenant portal isolation is enforced
- file upload works if applicable
- AI tool has both definition and handler
- no duplicate financial records
- empty states are usable
- error states are usable
- mobile layout is usable for key flows

If not tested, mark `Built but needs testing`.

---

# 16. Do Not Do These Things

Claude must avoid:

- duplicating existing features
- creating schema-only features and calling them done
- creating UI-only buttons that do nothing
- creating AI tools without handlers
- ignoring org scoping
- exposing private files
- allowing tenant portal to access landlord files
- silently posting expenses/charges/notices without review
- double-counting rent payments and transactions
- assuming Stripe is live because dependency exists
- making enterprise-heavy workflows too early
- breaking Smart Import while building Document Center

---

# 17. Agentic Work Log

Claude must maintain this section.

## Current Cycle

- Cycle number: 0
- Current objective: Initial audit against this file
- Current status: Not started
- Blockers: None yet
- Next action: Audit repo and fill Feature Audit Matrix

## Completed Cycles

| Cycle | Date | Objective | Result | Tests | Notes |
|---|---|---|---|---|---|
| 0 | TBD | Initial audit | Pending | Pending | Start here |

## Known Blockers

| Blocker | Area | Reason | Required User Decision |
|---|---|---|---|
| None yet | TBD | TBD | TBD |

## Next Recommended Batch

1. Audit all routes/models/components for current feature status.
2. Verify whether Smart Document Center already exists under another name.
3. Verify AI tools all have handlers.
4. Verify tenant portal isolation.
5. Verify rent/payment/transaction double-counting risks.

---

# 18. Claude Code Start Prompt

Use this exact prompt:

```txt
Read docs/GHM_PRODUCT_TARGET_AND_AUDIT.md first.

Operate as an agentic loop:
READ → AUDIT → CLASSIFY → PLAN → IMPLEMENT SMALL BATCH → TEST → UPDATE THIS FILE → REPEAT.

Start with audit only. Do not change product code yet.

Return:
1. Feature Audit Matrix status updates
2. Built / partial / broken / missing list
3. Smart Document Center verification
4. AI tools vs handlers verification
5. tenant portal isolation risks
6. rent/payment/transaction double-counting risks
7. safest next implementation batch

After the audit, update this MD file with the findings and wait for approval before code changes if the next step involves migrations, security/auth changes, destructive changes, payments, or legal notices.
```

---

# 19. Definition of Done For The Whole Direction

GHM is on the right path when:

- core landlord records work reliably
- rent and financials are accurate
- tenant portal is secure and useful
- documents are organized intelligently
- AI helps but does not silently make risky decisions
- Today’s Office shows what needs attention
- bills and tenant charges connect to financials
- notices and court packets support legal workflows
- move-in, renewal, maintenance, and move-out workflows are connected
- the app remains clean, friendly, and not overwhelming

