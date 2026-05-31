# GHM Product Target & Audit Reference

This document is the working reference for Claude Code and any AI/code editor working on GHM.

The purpose of this file is to clearly define what GHM is supposed to become, what major features must exist, what needs to be audited, and how to compare the current codebase against the intended product vision.

Claude Code should use this document as a north-star checklist before making changes. The goal is not to randomly add features. The goal is to systematically inspect the repo, identify what already exists, what is partially built, what is broken, and what still needs to be built.

---

# 1. Product Vision

GHM is a property management SaaS for landlords and small-to-mid-size management companies.

The app should simplify day-to-day property management by combining standard landlord tools with AI-powered automation.

The system should help users manage:

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

The larger goal is to make GHM feel like an AI-powered management office.

The user should be able to upload information, speak to the AI, take a picture of a bill, ask questions, generate summaries, record payments, file documents, and organize property operations without manually digging through folders and screens.

---

# 2. Core Principle

GHM should not just store data.

GHM should actively help the landlord or management company operate.

The AI should help answer:

- What needs to be paid?
- What needs to be billed?
- What rent is late?
- Which tenants owe money?
- What leases are expiring?
- What maintenance requests are open?
- Which documents are missing?
- Where should this uploaded document go?
- What does this bill belong to?
- What needs follow-up today?
- What can be filed automatically?
- What needs human review?

The app should reduce confusion, reduce manual entry, and keep everything organized by property, unit, tenant, lease, maintenance request, transaction, and application.

---

# 3. Existing Report Reference

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

The AI assistant tool list appears to contain around 30 tools, not only 24, based on `src/lib/ai/tools.ts`.

Claude Code should verify this again directly from the current repo.

---

# 4. What Claude Code Must Do First

Before building anything new, Claude Code should audit the current codebase and produce a clear status report.

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

Claude Code should identify:

1. Which models exist in Prisma
2. Which API routes exist
3. Which UI pages/components exist
4. Which features are connected end-to-end
5. Which features are only partially connected
6. Which features have broken or missing logic
7. Which features duplicate other features
8. Which features need database migrations
9. Which features need UI polish
10. Which features need security/permission review

Claude Code should not assume a feature works just because a dependency exists.

A feature should only be considered `Built` if the database, backend route, UI flow, and practical user experience are connected.

---

# 5. Main Feature Areas To Audit

## 5.1 Authentication & Organizations

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

Status to determine:

- Built / Partial / Missing / Broken

---

## 5.2 Properties & Units

Target:

- Create/edit/delete/archive properties
- Create/edit/delete units
- Property photos
- Unit photos
- Property status and unit status
- Vacancy summary
- Property expense profile
- Property detail page should clearly show tenants, leases, units, maintenance, financials, documents, and activity

Audit:

- Confirm property CRUD routes
- Confirm unit CRUD routes
- Confirm property photos and unit photos actually upload and display
- Confirm property status stays accurate when leases/units change
- Confirm vacancy summary is reliable
- Confirm property expenses are editable and used in financial snapshots

---

## 5.3 Tenants

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

## 5.4 Leases

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

## 5.5 Rent & Payments

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

## 5.6 Financials

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

## 5.7 Maintenance

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

## 5.8 Vendors

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

## 5.9 Applications

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

## 5.10 Messaging

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

## 5.11 Notifications

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

## 5.12 Tenant Portal

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

## 5.13 AI Chat Assistant

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

## 5.14 Smart Import / AI Migration

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

# 6. Smart Document Center — Required Target Feature

This is a major target feature.

The user described this feature as:

> A documentation center where a user can take a picture of a bill and the AI will figure out where it belongs and place it there.

This should become a core GHM feature.

Recommended name:

- Smart Document Center
- AI Filing Cabinet
- Document Center

The best product-facing name is probably:

## Smart Document Center

---

# 7. Smart Document Center Vision

The Smart Document Center should allow users to upload or take a picture of any property-management document.

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

The AI should scan the document, understand what it is, extract useful details, and recommend where it belongs.

---

# 8. Smart Document Center Required Flow

Target user flow:

1. User opens Smart Document Center.
2. User uploads a file or takes a picture.
3. App sends document/image to AI for classification and extraction.
4. AI identifies document type.
5. AI extracts key fields.
6. AI tries to match the document to existing records:
   - organization
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
10. If appropriate, app creates a transaction, bill, reminder, or maintenance expense.
11. App records an activity event.
12. App makes the document searchable later.

---

# 9. Smart Document Center Data Model Target

If not already implemented, add a general document model similar to this:

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
  relatedId        String?

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

Claude Code should adapt this to the existing schema style and avoid duplicating existing document models unless needed.

---

# 10. Smart Document Center AI Classification Target

The AI should return structured JSON like:

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

# 11. Smart Document Center Matching Logic

AI classification alone is not enough.

The app should use deterministic matching after extraction.

Match by:

- property address
- unit number
- tenant name
- applicant name
- vendor name
- lease dates
- invoice number
- account number
- email/phone if present
- maintenance request title/category if applicable

Rules:

- High-confidence exact property address match can auto-suggest property.
- Tenant documents should attach to tenant/application/lease depending on context.
- Bills and invoices should usually attach to property and optionally create expense transaction.
- Repair invoices should attach to maintenance request if one matches; otherwise property/vendor.
- Court/legal docs should attach to tenant + lease + document center.
- If confidence is low, mark as `needs_review`.
- Never silently file uncertain documents without review.

---

# 12. Smart Document Center UI Target

Required UI pages/components:

## Main page

Route suggestion:

- `/documents`
- or `/document-center`

Page should include:

- Upload button
- Camera capture on mobile
- Drag-and-drop upload
- Pending review queue
- Filed documents list
- Filters by document type
- Filters by property/tenant/lease/application/maintenance/vendor
- Search by text, amount, vendor, address, tenant name
- Status tabs: Pending Review / Filed / Needs Review / Rejected

## Upload/review flow

After upload, show review card:

- File preview
- AI document type
- AI summary
- Extracted amount/date/vendor/address
- Suggested destination
- Suggested action, such as creating expense transaction
- Confidence badge
- Edit destination manually
- Approve & File button
- Reject / Save Unfiled button

## Filed document detail

Document page should show:

- File preview/download
- AI summary
- Extracted fields
- Related record link
- Activity log
- Created transaction if any
- Edit metadata

---

# 13. Smart Document Center API Target

Recommended routes:

```txt
GET    /api/documents
POST   /api/documents/upload
POST   /api/documents/classify
POST   /api/documents/[id]/file
PATCH  /api/documents/[id]
DELETE /api/documents/[id]
GET    /api/documents/[id]
POST   /api/documents/[id]/create-transaction
```

Possible simpler route design:

```txt
POST /api/documents?action=upload
POST /api/documents?action=classify
POST /api/documents?action=file
GET  /api/documents
PATCH /api/documents/[id]
```

Claude Code should choose the style that best fits the existing app.

---

# 14. Smart Document Center Transaction Rules

When the uploaded document is a bill, receipt, or invoice, the system should suggest creating a transaction.

Examples:

- Water bill → expense / utility
- Electric bill → expense / utility
- Gas bill → expense / utility
- Insurance bill → expense / insurance
- Property tax bill → expense / tax
- Repair invoice → expense / repair
- Maintenance receipt → expense / repair
- Management fee → expense / management
- Rent receipt → income / rent or payment proof
- Late fee notice → income / late_fee if charged to tenant
- Security deposit document → deposit tracking or transaction depending on context

Important:

- Do not automatically create financial records without review unless the user explicitly enables auto-file/auto-post.
- Avoid double-counting imported payments and transactions.
- The review card should clearly show whether filing the document will also create a transaction.

---

# 15. Smart Document Center Security & Privacy

The document center may contain sensitive information.

Claude Code must audit and protect:

- Government IDs
- SSNs / SSN last 4
- Pay stubs
- Bank statements
- Court papers
- Legal documents
- Lease documents
- Tenant contact info
- Payment receipts

Rules:

- All document routes must be organization-scoped.
- Tenant portal should only access tenant-authorized documents.
- Public application uploads should only attach to that application.
- Magic-link sessions must not expose other tenant files.
- File URLs should not be exposed publicly unless intentionally designed.
- Sensitive fields should not be over-shared in AI summaries.

---

# 16. Missing / Broken / Partial Audit Template

Claude Code should produce a report using this format:

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

# 17. Build Priorities

After auditing, Claude Code should prioritize in this order:

## Priority 1 — Fix broken existing features

Do not build shiny new features before core flows work.

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

## Priority 3 — Build Smart Document Center

This is a major product differentiator.

## Priority 4 — Improve AI management-office behavior

Make AI proactively help with daily operations.

## Priority 5 — UI/UX polish

Keep the app simple, clean, and management-company friendly.

---

# 18. AI Management Office Target

Long-term, GHM should feel like an AI-powered office manager.

The AI should help users know what to do next.

Possible features:

- Daily management summary
- Late rent follow-up suggestions
- Maintenance follow-up reminders
- Lease expiration action list
- Bills due list
- Documents needing review
- Applications waiting for screening
- Tenants missing documents
- Vendors waiting on payment
- Properties with high expenses
- Suggested messages/notices
- Suggested transactions from uploaded bills

Future page idea:

## Today’s Office

This page shows:

- Urgent items
- Rent issues
- Maintenance issues
- Bills/documents to file
- Pending applications
- Lease expirations
- AI suggested next actions

---

# 19. Do Not Do These Things

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

---

# 20. Recommended Claude Code First Prompt

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
10. The safest implementation plan in priority order

Pay special attention to:
- Smart Document Center / AI Filing Cabinet
- Smart Import vs Document Center difference
- AI tools and handlers
- File upload/document models
- Organization scoping/security
- Rent/payment/transaction double-counting
- Tenant portal isolation

Audit only. Do not modify code until I approve the plan.
```

---

# 21. Current Key Question

The important question right now is:

Does GHM truly have a Smart Document Center where a user can take a picture of a bill, AI understands it, matches it to the correct property/tenant/lease/vendor/transaction, and files it there?

Claude Code must verify this directly from the repo.

If it exists, document exactly where and how it works.

If it is partial, identify the missing pieces.

If it is missing, build it using the target design above.

---

# 22. Definition of Done for Smart Document Center

Smart Document Center is only complete when all of this works:

- User can upload or take a picture of a document
- File is stored securely
- AI classifies the document type
- AI extracts useful fields
- System matches document to existing records
- User sees review card
- User can approve/edit filing destination
- Document is saved in a general document table or equivalent
- Document appears under the related property/tenant/lease/application/maintenance/vendor/transaction
- Bills/invoices can create suggested transactions
- Activity event is logged
- Organization scoping is enforced
- Tenant portal cannot access unauthorized documents
- Errors and low-confidence matches go to `Needs Review`

If any of those are missing, the feature is not fully complete.
