# GHM Product Target, Audit Reference & High-Value Workflow Roadmap

This document is the working reference for Claude Code and any AI/code editor working on GHM.

Use this as the product north star, audit checklist, and implementation guide.

The goal is not to copy large enterprise systems like AppFolio, Buildium, Rent Manager, or DoorLoop in a deep and complicated way. The goal is to adapt the highest-value workflows from those systems into a clean, friendly, efficient, AI-assisted property management app.

GHM should stay simple enough for small landlords, but powerful enough for a small-to-mid-size management company.

---

# 1. Product Vision

GHM is an AI-powered property management SaaS for landlords and small-to-mid-size management companies.

The app should simplify daily operations by combining traditional property management tools with an AI office assistant.

GHM should help users manage:

- Properties
- Units
- Tenants
- Applicants
- Leases
- Rent payments
- Late fees
- Security deposits
- Maintenance requests
- Vendors
- Bills
- Receipts
- Invoices
- Legal/court documents
- Financial records
- Messages
- Notices
- Tenant portal activity
- Documents and files
- Tasks and follow-ups
- Lease renewals
- Move-outs
- Inspections
- Work orders
- Owner/property reports if needed

The larger goal is to make GHM feel like an AI-powered management office.

The user should be able to upload information, speak to the AI, take a picture of a bill, ask questions, generate summaries, record payments, file documents, create charges, review tasks, and organize property operations without manually digging through folders and screens.

---

# 2. Core Product Principle

GHM should not just store data.

GHM should actively help the landlord or management company operate.

The AI should help answer:

- What needs to be paid?
- What needs to be billed?
- What rent is late?
- Which tenants owe money?
- What leases are expiring?
- What maintenance requests are open?
- Which bills are due?
- Which documents are missing?
- Where should this uploaded document go?
- What does this bill belong to?
- What needs follow-up today?
- What can be filed automatically?
- What needs human review?
- What should I do next?

The app should reduce confusion, reduce manual entry, and keep everything organized by property, unit, tenant, lease, maintenance request, transaction, application, vendor, and document.

---

# 3. Product Style Rule

GHM must remain:

- Clean
- Friendly
- Simple to understand
- Efficient
- Comprehensive where it matters
- Not bloated
- Not enterprise-heavy
- Not confusing

Do not copy AppFolio-style complexity. Copy only the workflow value.

Every feature should be designed around this question:

> Does this help the user manage properties faster, cleaner, and with less stress?

If the answer is no, do not build it yet.

---

# 4. Existing Repo Review Reference

Previous repo review confirmed that GHM already appears to include many core systems:

- Multi-tenant organization structure
- Landlord/staff users
- Properties and units
- Tenants
- Leases
- Rent payments
- Late fee configuration
- Maintenance requests
- Vendors
- Applications
- Application documents
- Lease documents
- Landlord/tenant messaging
- Notifications
- Tenant portal sessions
- Activity/audit events
- AI chat assistant
- AI tools for reading and writing property-management data
- Smart import / AI migration for extracting tenant/rent/ledger information from PDFs, CSVs, Excel files, and screenshots
- File upload/storage dependencies
- Resend email support
- Stripe dependency and Stripe-related payment fields

Important correction from repo review:

The AI assistant tool list appeared to contain around 30 tools, not only 24, based on `src/lib/ai/tools.ts` at the time of review.

Claude Code must verify this again directly from the current repo.

---

# 5. Claude Code First Rule

Before building anything new, Claude Code must audit the current codebase and produce a clear status report.

For every major feature, mark it as one of:

- `Built`
- `Partially Built`
- `Broken`
- `Missing`
- `Exists in schema only`
- `Exists in UI only`
- `Exists in API only`
- `Needs wiring`
- `Needs testing`

A feature is only `Built` if the database, backend route, UI flow, permissions, and practical user experience are connected.

Do not assume a feature works just because:

- A dependency exists
- A model exists
- A route exists
- A button exists
- A component exists
- A prompt mentions it

Claude Code must verify end-to-end functionality.

---

# 6. Do Not Duplicate Features

Before adding any new feature, Claude Code must search the repo for existing versions under different names.

Example:

Smart Document Center may be called:

- Documents
- Document Center
- Documentation Center
- AI Filing Cabinet
- File Organizer
- Smart Filing
- Upload Center
- Bills Upload
- Receipt Scanner
- AI Document Review

If something exists partially, improve it instead of rebuilding a duplicate system.

---

# 7. Main Audit Areas

Claude Code should audit these major areas:

1. Authentication & organizations
2. Properties & units
3. Tenants
4. Leases
5. Rent & payments
6. Financials
7. Maintenance
8. Vendors
9. Applications
10. Messaging
11. Notifications
12. Tenant portal
13. AI chat assistant
14. Smart Import / AI Migration
15. Smart Document Center
16. Bills & Payables
17. Tenant Charges / Receivables
18. Notices & Letters
19. Work Orders
20. Inspections
21. Move-Out Workflow
22. Lease Renewal Workflow
23. Court Packet Builder
24. Today’s Office / Command Center
25. Tasks & Follow-Ups
26. Calendar
27. Universal Timeline
28. Missing Documents Checklist
29. Owner Reports / Owner Statements
30. Security, permissions, and organization scoping

---

# 8. Current Core Feature Targets

## 8.1 Authentication & Organizations

Target:

- Landlord/staff login through NextAuth
- Organization-scoped data isolation
- User roles
- Tenant portal auth separated from landlord auth
- Secure magic-link tenant login
- Session expiration
- No cross-organization data leakage

Audit:

- Confirm organization scoping on every API route
- Confirm `requireOrg()` or equivalent protection
- Confirm tenant portal endpoints cannot access landlord data
- Confirm role permissions exist or note if roles are only stored but not enforced
- Check whether staff/member/viewer roles actually affect access

---

## 8.2 Properties & Units

Target:

- Create/edit/delete/archive properties
- Create/edit/delete units
- Property photos
- Unit photos
- Property status and unit status
- Vacancy summary
- Property expense profile
- Property detail page showing tenants, leases, units, maintenance, financials, documents, and activity

Audit:

- Confirm property CRUD routes
- Confirm unit CRUD routes
- Confirm property photos and unit photos upload and display
- Confirm property status stays accurate when leases/units change
- Confirm vacancy summary is reliable
- Confirm property expenses are editable and used in financial snapshots

---

## 8.3 Tenants

Target:

- Full tenant profile
- Contact info
- Emergency contact
- SSN last 4 / ID fields if legally permitted
- Notes
- Current lease and lease history
- Tenant ledger
- Tenant documents
- Tenant messages
- Tenant portal status
- Tenant activity history

Audit:

- Confirm tenant CRUD
- Confirm tenant profile page shows all important info
- Confirm tenant ledger is accurate
- Confirm tenant deletion is safe and does not break leases/history
- Confirm tenant documents exist or are missing

---

## 8.4 Leases

Target:

- Create fixed-term and month-to-month leases
- Link lease to unit and tenant(s)
- Rent amount
- Security deposit
- Deposit paid status
- Lease documents
- E-signature workflow
- Landlord countersignature
- Move-in checklist
- Move-in completed status
- Lease renewal workflow
- Lease expiration reminders
- Monthly recurring charges beyond rent

Audit:

- Confirm lease CRUD
- Confirm lease signing route works
- Confirm countersignature works
- Confirm lease documents upload/display
- Confirm move-in checklist exists and is connected
- Confirm lease expiration cron/notification works
- Confirm recurring monthly charges are used in rent/payment calculations or only stored

---

## 8.5 Rent & Payments

Target:

- Generate monthly rent payment records
- Track pending, partial, paid, overdue
- Record payments manually
- Tenant payment request flow
- Landlord confirm/reject payment request
- Receipt upload
- Late fee calculation
- Overdue cron job
- Payment history
- Payment statement/ledger
- Stripe/ACH online rent payments if implemented

Audit:

- Confirm rent generation route
- Confirm overdue marking route
- Confirm payment recording logic
- Confirm partial payment logic
- Confirm tenant payment request flow
- Confirm payment receipt handling
- Confirm late fee config is actually applied
- Confirm Stripe is only dependency/schema field or actually implemented
- Confirm monthly charges beyond rent are included or not

Important:

Do not mark online rent collection as built unless there is a real payment checkout/ACH/card flow connected end-to-end.

---

## 8.6 Financials

Target:

- Income and expense transactions
- Rent income
- Late fees
- Deposits
- Repairs
- Insurance
- Taxes
- Utilities
- Management expenses
- Other categories
- Property-level P&L
- Cash flow summary
- Portfolio financial snapshot
- AI financial question answering based on real data

Audit:

- Confirm transaction CRUD
- Confirm dashboard financial KPIs
- Confirm P&L view
- Confirm financial data is property-scoped
- Confirm AI financial tools use accurate data
- Confirm imported ledger entries are correctly represented
- Confirm no double-counting between RentPayment and Transaction

---

## 8.7 Maintenance

Target:

- Tenant submits maintenance request from portal
- Landlord creates/edits request
- Priority workflow
- Status workflow
- Assign vendor
- Upload photos
- Comment thread
- Track estimated and actual cost
- Convert completed repair into expense transaction if appropriate
- Keep maintenance history by tenant/unit/property

Audit:

- Confirm landlord maintenance routes
- Confirm portal maintenance routes
- Confirm photo upload and display
- Confirm comments work
- Confirm vendor assignment works
- Confirm actual cost is connected to financials or only stored

---

## 8.8 Vendors

Target:

- Vendor directory
- Vendor trade/type
- Contact info
- Notes
- Assigned maintenance jobs
- Vendor invoices/documents
- Vendor license/insurance expiration if implemented

Audit:

- Confirm vendor CRUD
- Confirm vendor assignment to maintenance
- Confirm vendor-related documents exist or are missing
- Confirm vendor invoice filing exists or is missing

---

## 8.9 Applications

Target:

- Public application invite links
- Multi-step rental application form
- Applicant personal info
- Identity/move-in details
- Employment/income
- Rental history
- Background questions where legally permitted
- Household/pets/vehicles
- References
- Document uploads
- Review and signature
- Status workflow
- Screening status
- Approve/deny
- Convert approved applicant to tenant and lease

Audit:

- Confirm public application route
- Confirm application upload route
- Confirm document requirements
- Confirm application detail/review UI
- Confirm status workflow works
- Confirm conversion creates tenant + lease correctly
- Confirm duplicate tenants are handled

---

## 8.10 Messaging

Target:

- Landlord/tenant threaded messaging
- Tenant portal messages
- Landlord app messages
- Read/unread status
- Attachments
- Related records such as lease, maintenance, payment
- Email/SMS notification if implemented

Audit:

- Confirm messaging routes
- Confirm tenant portal messages are isolated and secure
- Confirm read/unread status works
- Confirm attachments work or are only schema fields
- Confirm notifications are created when messages are sent

---

## 8.11 Notifications

Target:

- In-app bell
- Polling or realtime refresh
- Message notifications
- Payment due notifications
- Maintenance updates
- Lease expiry
- New applications
- Email notifications through Resend

Audit:

- Confirm notification model
- Confirm notification routes
- Confirm notification creation events
- Confirm bell UI
- Confirm mark-read behavior
- Confirm Resend templates/routes
- Confirm which notifications are email vs in-app only

---

## 8.12 Tenant Portal

Target:

Tenant can:

- Request magic link
- Log in without password
- View lease
- View next rent due
- View payment history
- Submit payment request
- Upload receipt
- Submit maintenance request
- Track maintenance status
- Message landlord
- Sign lease
- View documents if implemented

Audit:

- Confirm portal auth flow
- Confirm session cookie security
- Confirm portal pages
- Confirm portal APIs only expose current tenant data
- Confirm payment request flow
- Confirm maintenance flow
- Confirm message flow
- Confirm lease signing flow

---

## 8.13 AI Chat Assistant

Target:

The AI assistant should act like a property-management office assistant.

It should be able to:

- Answer questions from real portfolio data
- Look up tenants
- Look up properties
- Look up balances
- Look up overdue rent
- Look up expiring leases
- Look up maintenance
- Look up vendors
- Look up applications
- Create tenants
- Update tenants
- Create properties
- Add units
- Create leases
- Record payments
- Create maintenance requests
- Update maintenance status
- Send tenant messages
- Create transactions
- Create vendors
- Advance applications
- Set screening status
- Add application documents
- Confirm move-in
- Calculate financial scenarios

Audit:

- Confirm current tool list
- Count tools accurately
- Confirm every tool has a handler
- Confirm every handler is org-scoped
- Confirm destructive tools require confirmation
- Confirm AI does not hallucinate financial answers
- Confirm streaming works
- Confirm UI widget exists on landlord pages
- Confirm voice input/output if implemented

Important:

If a tool is defined in `tools.ts` but not implemented in handlers, mark it as broken.

---

## 8.14 Smart Import / AI Migration

Target:

The migration tool should let users upload files from another platform and extract structured data.

Supported input:

- PDF
- CSV
- Excel
- Screenshot/image
- Tenant ledger
- Rent roll
- Payment history
- Fee ledger

Extract:

- Tenant info
- Property/unit info
- Lease dates
- Rent amount
- Deposit
- Payment history
- Late fees
- Legal fees
- Court costs
- Attorney fees
- NSF fees
- Returned payments
- Credits
- Adjustments
- Running balance if present

Flow:

1. Upload file
2. AI/deterministic parser extracts data
3. User reviews extracted cards
4. Conflict check
5. Commit creates records
6. App creates tenants/properties/units/leases/rent payments/transactions

Audit:

- Confirm extraction route
- Confirm image handling
- Confirm PDF handling
- Confirm CSV/XLSX handling
- Confirm deterministic tenant-ledger parser
- Confirm conflict check
- Confirm commit flow
- Confirm review UI
- Confirm error handling
- Confirm duplicate handling
- Confirm imported ledger does not corrupt rent/payment records

---

# 9. High-Value Workflows To Add Or Tighten

These are inspired by major property-management apps but simplified for GHM.

Do not build them in a complicated enterprise way. Build clean, practical versions.

---

## 9.1 Today’s Office / Command Center

This should become the main operational dashboard.

Purpose:

Show the user what needs attention today.

Target cards:

- Late rent
- Payment requests waiting for confirmation
- Bills/documents needing review
- Open maintenance
- Emergency maintenance
- Lease expirations
- Applications waiting for review
- Messages needing reply
- Upcoming move-ins
- Upcoming move-outs
- Bills due soon
- Tasks due today
- AI suggested next actions

Example actions:

- Draft late notice
- Remind tenant
- Create expense from bill
- Assign vendor
- Start lease renewal
- Review uploaded documents
- Create task
- Mark bill paid

Definition of done:

- User can open one page and know what to do next
- Cards are based on real app data
- Each card links to the relevant record
- AI suggestions require user approval before sending/posting

---

## 9.2 Smart Document Center / AI Filing Cabinet

This is a major target feature.

User description:

> A documentation center where a user can take a picture of a bill and the AI will figure out where it belongs and place it there.

Target:

User uploads or takes a picture of any property-management document.

Examples:

- Utility bill
- Water bill
- Electric bill
- Gas bill
- Insurance bill
- Tax bill
- Repair receipt
- Vendor invoice
- Maintenance invoice
- Court filing
- Attorney letter
- Notice to tenant
- Lease document
- Lease renewal
- Security deposit statement
- Move-in checklist
- Move-out inspection
- Government ID
- Pay stub
- Proof of income
- Bank statement
- Previous lease
- Application document
- Tenant ledger
- Rent receipt
- Payment proof
- Zelle/Venmo screenshot
- Property photo
- Maintenance photo
- Other landlord document

Required flow:

1. User opens Smart Document Center.
2. User uploads a file or takes a picture.
3. App sends document/image to AI for classification and extraction.
4. AI identifies document type.
5. AI extracts key fields.
6. AI tries to match the document to existing records:
   - property
   - unit
   - tenant
   - lease
   - application
   - maintenance request
   - vendor
   - transaction
   - payment request
7. App shows a review card to the user.
8. User can approve, edit, or override the filing destination.
9. App files the document to the correct record.
10. If appropriate, app suggests creating a transaction, bill, reminder, or maintenance expense.
11. App records an activity event.
12. App makes the document searchable later.

Definition of done:

- Upload works
- Camera/photo upload works on mobile if possible
- File is stored securely
- AI classifies the document type
- AI extracts useful fields
- System matches document to existing records
- User sees review card
- User can approve/edit filing destination
- Document appears under the related record
- Bills/invoices can suggest transactions
- Low-confidence items go to Needs Review
- Organization scoping is enforced

---

## 9.3 Bills & Payables

Purpose:

Answer: What needs to be paid?

Target:

A simple bill/payables workflow connected to Document Center.

Fields:

- Bill/vendor name
- Property/unit
- Amount
- Due date
- Bill date
- Status: needs review / approved / paid / overdue
- Document attachment
- Category: utility / repair / insurance / tax / management / other

Workflow:

1. User uploads bill or enters bill manually.
2. AI extracts vendor, amount, due date, property, and category.
3. User approves.
4. Bill appears in payables list.
5. User marks bill as paid.
6. App creates expense transaction.

Definition of done:

- User can see all unpaid bills
- User can filter by property/vendor/status
- User can mark paid
- Paid bills create or link to expense transactions
- No duplicate expense is created accidentally

---

## 9.4 Tenant Charges / Receivables

Purpose:

Answer: What needs to be billed to tenants?

Target charge types:

- Late fee
- Repair chargeback
- Utility reimbursement
- Legal fee
- Court fee
- Attorney fee
- NSF fee
- Returned payment fee
- Other tenant charge

Workflow:

1. User selects tenant/lease.
2. User chooses charge type.
3. User enters or AI extracts amount.
4. Optional supporting document attached.
5. Charge appears on tenant ledger.
6. Optional message/notice sent to tenant.

Definition of done:

- Charge is tied to tenant/lease
- Charge appears in ledger
- Charge can be supported by document
- Optional tenant notification exists
- No double-counting with rent payments

---

## 9.5 Notices & Letters

Purpose:

Give landlords clean, reusable communication workflows.

Templates:

- Late rent notice
- Rent demand
- Balance reminder
- Notice to enter
- Lease renewal offer
- Non-renewal notice
- Maintenance access notice
- Documents requested
- Payment confirmation
- Payment rejection
- Application denial notice
- Security deposit deduction letter

Rules:

- AI may draft notices
- User must approve before sending
- Notices should be saved to tenant/lease timeline
- Avoid giving legal advice
- Include editable templates

Definition of done:

- User can generate a notice from tenant/lease/payment/application context
- User can edit before sending
- Sent notice is logged
- Notice can be included in court packet

---

## 9.6 Work Orders

Purpose:

Make maintenance more professional without becoming complicated.

Simple workflow:

1. Maintenance request comes in.
2. Landlord creates or confirms work order.
3. Vendor assigned.
4. Scope of work recorded.
5. Estimate added.
6. Approval status tracked.
7. Before/after photos uploaded.
8. Vendor invoice uploaded.
9. Cost becomes expense transaction when approved/paid.

Statuses:

- New
- Assigned
- Waiting for estimate
- Approved
- In progress
- Completed
- Billed/Paid

Definition of done:

- Maintenance request can become work order
- Vendor can be assigned
- Estimate and invoice can be tracked
- Completion can create/suggest expense transaction

---

## 9.7 Mobile Inspections

Purpose:

Support move-in, move-out, annual, and maintenance inspections.

Inspection types:

- Move-in inspection
- Move-out inspection
- Annual inspection
- Maintenance inspection

Each inspection should support:

- Room-by-room checklist
- Photos
- Notes
- Damage list
- Tenant signature if needed
- Export PDF

Definition of done:

- User can create inspection
- User can add photos/notes/checklist items
- Inspection is tied to property/unit/tenant/lease
- Inspection can be exported or attached to court/security deposit record

---

## 9.8 Move-Out Workflow

Purpose:

Guide landlord through move-out and deposit handling.

Workflow:

1. Tenant gives notice.
2. Move-out date set.
3. Move-out inspection scheduled.
4. Inspection completed.
5. Damages recorded.
6. Security deposit deductions calculated.
7. Final balance generated.
8. Deposit return statement created.
9. Unit status becomes vacant or under maintenance.
10. Turnover maintenance tasks created.

Definition of done:

- Move-out status exists
- Inspection and damages can be recorded
- Deposit deductions can be listed
- Final statement can be generated
- Unit status updates correctly

---

## 9.9 Lease Renewal Workflow

Purpose:

Prevent leases from expiring without action.

Workflow:

1. Lease expiring soon.
2. App shows renewal item in Today’s Office.
3. AI suggests renewal options if data is available.
4. User enters new rent/terms.
5. Renewal offer sent.
6. Tenant accepts/declines.
7. New lease/extension generated and signed.

Statuses:

- Upcoming
- Offer drafted
- Sent
- Accepted
- Declined
- Non-renewal
- Completed

Definition of done:

- Expiring leases surface clearly
- Renewal can be started from lease or dashboard
- Renewal status is tracked
- Accepted renewal updates or creates lease record

---

## 9.10 Court Packet Builder

Purpose:

Support court/attorney-ready documentation.

One-click export should include:

- Tenant ledger
- Lease
- Payment history
- Charges
- Notices sent
- Messages
- Documents
- Maintenance records if relevant
- Activity timeline

Definition of done:

- User selects tenant/lease
- App builds clean PDF bundle or ZIP
- Included items are clear and organized
- Court packet can be downloaded and/or emailed

---

## 9.11 Owner Reports / Owner Statements

Purpose:

Useful if users manage properties for other owners.

Start light. Do not build a complicated owner portal first.

Target:

- Monthly owner statement
- Income by property
- Expenses by property
- Repairs
- Net income
- Open issues
- Documents attached
- Export/send PDF

Definition of done:

- User can generate owner/property statement
- Statement uses real financial data
- Statement can be downloaded or emailed

---

## 9.12 Leasing CRM / Applicant Follow-Up

Purpose:

Connect vacancy marketing, showings, applications, and lease signing.

Simple pipeline:

- Lead
- Showing scheduled
- Applied
- Documents missing
- Screening
- Approved
- Lease sent
- Move-in scheduled
- Lost

Definition of done:

- Applicant/lead status is visible
- User can see who needs follow-up
- Missing documents trigger reminder option
- Approved applicant can convert to tenant/lease

---

## 9.13 Vacancy & Turnover Board

Purpose:

Show the lifecycle of units.

Columns:

- Occupied
- Notice given
- Moving out
- Turnover needed
- Ready to list
- Listed
- Application pending
- Lease pending
- Move-in scheduled

Definition of done:

- Units appear in correct status
- User can quickly see which units need action
- Board links to unit/tenant/application/lease

---

## 9.14 AI Maintenance Triage

Purpose:

Help classify and prioritize tenant maintenance requests.

AI should identify:

- Category
- Urgency
- Possible vendor type
- Whether emergency
- Suggested first response
- Whether photos are missing

Definition of done:

- New maintenance request can be AI-triaged
- User can approve category/priority/vendor suggestion
- Tenant response can be drafted

---

## 9.15 AI Message Drafts

Purpose:

Make communication faster.

Inside tenant messages, AI should help with:

- Draft friendly reminder
- Draft formal notice
- Summarize thread
- Identify what tenant asked for
- Create task from message

Definition of done:

- AI draft appears in message context
- User edits/approves before sending
- Draft uses real context and does not hallucinate facts

---

## 9.16 Universal Timeline

Purpose:

Every property/tenant/lease should show what happened.

Timeline items:

- Payments
- Charges
- Documents
- Notices
- Messages
- Maintenance
- Inspections
- AI actions
- Activity events

Definition of done:

- Tenant timeline exists
- Property timeline exists
- Lease timeline exists if practical
- Timeline links to source records
- Court packet can use timeline items

---

## 9.17 Management Rules / Light Automations

Purpose:

Simple automation rules, not a complex workflow builder.

Examples:

- If rent overdue by X days → create task / draft notice
- If lease expires in 60 days → create renewal task
- If maintenance open 7 days → remind manager
- If document uploaded and confidence low → send to Needs Review
- If bill due in 3 days → alert user
- If application missing documents → draft reminder

Definition of done:

- Rules are simple toggles/settings
- User can approve sensitive actions
- Automations create tasks/notifications/drafts, not risky silent changes

---

## 9.18 Calendar

Purpose:

Show property-management events in one place.

Calendar items:

- Rent due dates
- Lease expirations
- Showings
- Move-ins
- Move-outs
- Inspections
- Court dates
- Bill due dates
- Maintenance appointments
- Task due dates

Definition of done:

- Calendar page exists
- Events are generated from real records
- User can filter by property/type

---

## 9.19 Property Health Score

Purpose:

Give users quick clarity.

Score based on:

- Vacancy
- Late rent
- Open maintenance
- Expenses
- Lease expirations
- Missing documents

Simple labels:

- Healthy
- Needs attention
- High risk

Definition of done:

- Score is understandable
- Score links to reasons
- AI can explain the score using real data

---

## 9.20 Missing Documents Checklist

Purpose:

Make sure important files are not missing.

Tenant/lease missing document examples:

- Signed lease
- ID
- Proof of income
- Security deposit receipt
- Move-in checklist
- Renters insurance if required

Property missing document examples:

- Insurance policy
- Tax bill
- Utility bill/account
- Registration/license
- Inspection report

Definition of done:

- Checklist exists per tenant/lease/property/application
- Missing items can request upload or open Document Center
- Completed documents link to filed files

---

# 10. Smart Document Center Suggested Data Model

If not already implemented, add a general document model similar to this.

Adapt it to the existing schema style. Do not duplicate existing models unnecessarily.

```prisma
model Document {
  id              String   @id @default(cuid())
  organizationId  String

  fileName        String
  fileUrl         String
  fileKey         String?
  mimeType        String?
  fileSizeBytes   Int?

  documentType    String   // bill | receipt | invoice | lease | notice | id | pay_stub | court | insurance | tax | utility | maintenance_photo | other
  status          String   @default("pending_review") // pending_review | filed | rejected | needs_review

  relatedType     String?  // property | unit | tenant | lease | application | maintenance | vendor | transaction | payment_request
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

---

# 11. Smart Document Center AI Classification Target

AI should return structured JSON like:

```json
{
  "documentType": "utility_bill",
  "confidence": 0.92,
  "summary": "Electric bill for 123 Main St, due June 15, amount $248.16.",
  "extracted": {
    "amount": 248.16,
    "documentDate": "2026-05-31",
    "dueDate": "2026-06-15",
    "vendorName": "PSE&G",
    "propertyAddress": "123 Main St",
    "unitNumber": null,
    "tenantName": null,
    "invoiceNumber": "ABC123",
    "accountNumber": "****1234"
  },
  "suggestedFiling": {
    "relatedType": "property",
    "relatedId": "property_id_here",
    "reason": "The bill address matches this property address."
  },
  "suggestedActions": [
    {
      "type": "create_transaction",
      "category": "utility",
      "amount": 248.16,
      "date": "2026-05-31",
      "description": "Electric bill - PSE&G"
    }
  ],
  "needsReview": false
}
```

---

# 12. Security & Privacy Checklist

GHM may contain sensitive landlord and tenant information.

Claude Code must protect:

- Government IDs
- SSNs / SSN last 4
- Pay stubs
- Bank statements
- Court papers
- Legal documents
- Lease documents
- Tenant contact info
- Payment receipts
- Financial records

Rules:

- All document routes must be organization-scoped
- Tenant portal should only access tenant-authorized documents
- Public application uploads should only attach to that application
- Magic-link sessions must not expose other tenant files
- File URLs should not be exposed publicly unless intentionally designed
- Sensitive fields should not be over-shared in AI summaries
- AI should not invent financial/legal facts
- Destructive actions require explicit user confirmation

---

# 13. Build Priority Order

After auditing, Claude Code should prioritize in this order:

## Priority 1 — Fix broken existing features

Examples:

- Broken auth
- Broken org scoping
- Broken rent payment logic
- Broken tenant portal
- Broken AI tool handlers
- Broken imports
- Broken build/deploy

## Priority 2 — Complete partially built features

Examples:

- Feature exists in schema but no UI
- UI exists but API missing
- API exists but not connected
- AI tool defined but no handler
- File upload exists but not displayed

## Priority 3 — Smart Document Center

This is a major product differentiator.

## Priority 4 — Bills, Payables, and Tenant Charges

This turns documents into money workflows.

## Priority 5 — Today’s Office

This turns GHM into a daily operating system.

## Priority 6 — Notices, Move-Outs, Renewals, Work Orders, Inspections

These complete the landlord/management lifecycle.

## Priority 7 — Court Packet Builder and Owner Reports

These are high-value professional outputs.

## Priority 8 — UI/mobile polish

Keep the app clean, friendly, and efficient.

---

# 14. Feature Audit Report Template

Claude Code should produce reports using this format:

```md
# GHM Feature Audit Report

## Summary
- Built:
- Partially built:
- Broken:
- Missing:
- Highest-risk issues:

## Feature Status Table

| Feature | Status | Evidence in Repo | Missing Pieces | Recommended Fix |
|---|---|---|---|---|
| Properties | Built/Partial/Broken/Missing | files/models/routes | issue | fix |
| Units | | | | |
| Tenants | | | | |
| Leases | | | | |
| Rent Payments | | | | |
| Financials | | | | |
| Maintenance | | | | |
| Vendors | | | | |
| Applications | | | | |
| Messaging | | | | |
| Notifications | | | | |
| Tenant Portal | | | | |
| AI Assistant | | | | |
| Smart Import | | | | |
| Smart Document Center | | | | |
| Bills & Payables | | | | |
| Tenant Charges | | | | |
| Notices | | | | |
| Work Orders | | | | |
| Inspections | | | | |
| Move-Out Workflow | | | | |
| Lease Renewal Workflow | | | | |
| Court Packet Builder | | | | |
| Today’s Office | | | | |
| Calendar | | | | |
| Universal Timeline | | | | |

## Detailed Findings

### Feature Name
Status:
Files checked:
What works:
What is broken:
What is missing:
Recommended implementation steps:
Risk level:
```

---

# 15. Testing Requirements

Before marking any feature complete, Claude Code should check:

- TypeScript passes
- Build passes
- Prisma generate passes
- API route compiles
- UI page loads
- Org scoping is enforced
- Tenant portal isolation is enforced
- File upload works where relevant
- AI tool has both definition and handler
- AI tool handler is org-scoped
- Data is not double-counted
- Error states are handled
- Empty states are friendly
- Mobile layout is usable for key workflows

---

# 16. Do Not Do These Things

Claude Code should avoid:

- Duplicating models without checking existing schema
- Building new routes without using existing patterns
- Ignoring organization scoping
- Marking schema-only features as complete
- Auto-posting expenses without review
- Exposing private documents through public URLs
- Letting tenant portal access landlord-only files
- Creating AI tools without handlers
- Creating UI buttons that do nothing
- Breaking existing Smart Import while adding Document Center
- Double-counting rent payments and transactions
- Assuming Stripe is fully implemented just because dependency exists
- Building overly complex enterprise workflows too early

---

# 17. Recommended Claude Code Audit Prompt

Use this prompt with Claude Code:

```txt
Read docs/GHM_PRODUCT_TARGET_AND_AUDIT.md first.

Then audit the current GHM repo against that document.

Do not change code yet.

Return a structured report showing:
1. What is built
2. What is partially built
3. What is broken
4. What is missing
5. What exists only in schema
6. What exists only in UI
7. What exists only in API
8. Whether Smart Document Center exists end-to-end
9. Whether AI document filing from a picture/bill is actually implemented
10. Whether Bills & Payables exist
11. Whether Tenant Charges / Receivables exist
12. Whether Today’s Office exists
13. Whether work orders, inspections, move-out, renewal, notices, and court packet builder exist
14. The safest implementation plan in priority order

Pay special attention to:
- Smart Document Center / AI Filing Cabinet
- Smart Import vs Document Center difference
- AI tools and handlers
- File upload/document models
- Bills & Payables
- Tenant Charges
- Organization scoping/security
- Rent/payment/transaction double-counting
- Tenant portal isolation

Audit only. Do not modify code until I approve the plan.
```

---

# 18. Current Key Question

The important question right now is:

Does GHM truly have a Smart Document Center where a user can take a picture of a bill, AI understands it, matches it to the correct property/tenant/lease/vendor/transaction, and files it there?

Claude Code must verify this directly from the repo.

If it exists, document exactly where and how it works.

If it is partial, identify the missing pieces.

If it is missing, build it using the target design above.

---

# 19. Definition of Done for GHM Core Direction

GHM is on the right path when:

- Core landlord records work reliably
- Rent and financials are accurate
- Tenant portal is secure and useful
- Documents are organized intelligently
- AI helps but does not silently make risky decisions
- Today’s Office shows what needs attention
- Bills and tenant charges connect to financials
- Notices and court packets support legal workflows
- Move-in, renewal, maintenance, and move-out workflows are connected
- The app remains clean, friendly, and not overwhelming

