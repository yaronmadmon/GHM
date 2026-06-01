# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# GHM — Property Management App

## Commands

```bash
npm run dev              # start dev server
npm run build            # prisma generate + next build
npx tsc --noEmit         # type-check without building
npx prisma db push       # sync schema to Neon (use this, NOT prisma migrate)
npx prisma generate      # regenerate client after schema change
npx prisma studio        # browse data locally
npx vercel --prod --yes  # deploy to production
```

No test suite exists.

## Stack
| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.1 — App Router, React 19, TypeScript 5 |
| Database | Prisma 5 + Neon PostgreSQL (cloud) |
| Auth | NextAuth v5 beta (`@auth/prisma-adapter`) — credentials provider |
| Styling | Tailwind CSS v4 (no `tailwind.config.js` — config lives in CSS variables) |
| UI Components | shadcn/ui → `src/components/ui/` |
| Email | Resend (`src/lib/email.ts`) — **initialize `new Resend()` lazily inside handler functions, never at module top-level** |
| AI | OpenAI SDK — gpt-4o for chat widget (streaming, 30 tools) and smart import (vision + text) |
| Toasts | Sonner — `import { toast } from "sonner"` |
| File upload | base64 data URIs stored in PostgreSQL (fallback); auto-upgrades to Vercel Blob when `BLOB_READ_WRITE_TOKEN` env var is present |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Dark mode | next-themes — class-based, default dark, persisted in localStorage |

## Critical Next.js 16 Patterns

- **`params` is a Promise**: always `const { id } = await params` in every route handler and page that uses params
- **React hooks must never be called conditionally**: hooks violations cause "Cannot read properties of undefined (reading 'subscribe')" at runtime — all `useState`/`useEffect`/`useRouter` calls must be at the top level of the component, before any early returns or conditionals
- **Resend lazy init**: `const resend = new Resend(process.env.RESEND_API_KEY)` must live inside the async handler body — Vercel build fails if it's at module level

## Environment Variables (`.env.local`)
```
DATABASE_URL=           # Neon PostgreSQL connection string
NEXTAUTH_SECRET=
NEXTAUTH_URL=           # http://localhost:3000 (dev) | https://ghm-tawny.vercel.app (prod)
OPENAI_API_KEY=         # Used for AI chat, maintenance triage, notices, message draft, smart import
RESEND_API_KEY=
EMAIL_FROM=             # e.g. GHM <noreply@yourdomain.com>
CRON_SECRET=            # Bearer token for /api/cron/* routes
MORA_SERVICE_API_KEY=   # x-mora-key header for /api/mora/* routes
MORA_SERVICE_ORG_ID=    # org to scope Mora queries to
```

## Cron Schedule (`vercel.json`)
| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/generate-monthly-rent` | `0 6 1 * *` | 6am on the 1st — create RentPayments for all active leases |
| `/api/cron/mark-overdue-payments` | `0 9 * * *` | 9am daily — mark overdue, apply per-lease late fees |
| `/api/cron/check-expiring-leases` | `0 8 * * *` | 8am daily — notify landlords of leases expiring ≤60 days |
| `/api/cron/portfolio-agent` | `0 12 * * *` | 12pm daily — run AI Office Manager analysis |

## Project Structure

```
src/
  app/
    (app)/                    # Landlord/staff app — requires NextAuth session
      layout.tsx              # Auth guard, AppShell, ChatWidget
      todays-office/          # Daily command center — 9 live sections (balances, bills, tasks, maintenance, messages, etc.)
      dashboard/              # KPI cards, overdue rent, expiring leases, activity feed
                              # Shows migration CTA when properties.total === 0
      properties/             # Property list with health score badges; [id]/ detail + activity timeline
        [id]/units/new/       # Add unit to property
        [id]/report/          # Income/expense report, print-optimized
        new/                  # Create property
      tenants/                # Tenant list with doc count badges; [id]/ detail; new/
        [id]/ledger/          # Print-optimized full ledger with email send
        [id]/court-packet/    # 7-section print-ready court packet PDF
      leases/                 # Lease list; [id]/ detail with activity timeline; new/
      rent/                   # Rent ledger — per-lease charge breakdown, record payments
                              # Due date uses lease.paymentDueDay; late fee trigger shown per row
      maintenance/            # Request list; [id]/ detail with AI Triage button + comments
      work-orders/            # Work order list — 8-status flow (new→invoiced), auto-expense on completion
      inspections/            # Inspection scheduling — move-in/out/annual/maintenance types
      vendors/                # Vendor/contractor list — full CRUD
      messages/               # Landlord ↔ tenant messaging with AI Draft Reply + Summarize
      applications/           # Rental applications; [id]/ workflow
      financials/             # Income/expense transactions
        new-transaction/      # Transaction creation form (rent double-counting warning)
      bills/                  # Bills & payables — status flow, mark-paid creates expense TX
      tasks/                  # Task list with priority, due date, status filters
      calendar/               # Grid + agenda — rent due, lease expiry, tasks, bills, maintenance
      missing-documents/      # Global view of tenants with missing required docs
      documents/              # Document Center — upload, AI classify, review, file
      import-export/          # Export (Excel/CSV) + Smart Import tab (links to /migration)
      migration/              # AI migration center — card review flow (upload → review → done)
      renewals/               # Lease renewal list; [id]/ form — sends new lease for e-sign
      vacancy/                # Vacant units board
      agent/                  # AI Office Manager — run history, pending task approval
      settings/               # Profile, password, late fee config
    (auth)/                   # Unauthenticated — login, register
    portal/                   # Tenant self-service portal (cookie auth, separate from NextAuth)
      page.tsx                # Tenant dashboard — next payment, lease summary
      payments/               # View rent history, submit payment requests
      maintenance/            # Submit and track maintenance requests
      messages/               # Tenant ↔ landlord messaging (uses /api/portal/messages/*)
      lease/                  # View lease details and signing status
      login/                  # Magic-link login entry point
      auth/[token]/           # Validates magic link token, issues session cookie
      setup/[token]/          # First-time portal account setup
    apply/[token]/            # Public 9-step rental application form (no auth)
    lease-sign/[token]/       # Public e-signature page (no auth)
    api/
      auth/[...nextauth]/     # NextAuth handler
      auth/register/          # Create org + user
      properties/             # CRUD
      units/[id]/             # Unit CRUD
      tenants/                # CRUD
      leases/                 # CRUD
        [id]/send-for-signing/  # Email tenant signing link
        [id]/countersign/       # Landlord countersignature
        [id]/move-in/           # Complete move-in checklist
      rent-payments/          # Record payments; bulk-view; generate-month
      maintenance/            # CRUD + [id]/comments/
      messages/               # Create thread; [id]/ reply (landlord-side)
      applications/           # CRUD + invites + [id]/documents/ + [id]/convert/
      notifications/          # GET list + PATCH mark-all-read; [id]/ PATCH mark-read
      transactions/           # Financial transaction CRUD
      vendors/                # Vendor CRUD; [id]/ PATCH + DELETE
      import/                 # Manual CSV column-mapping import (parse + commit actions)
      import/smart/           # AI import: extract | check-conflicts | commit actions
      export/                 # Excel + multi-CSV export
      ai/chat/                # AI chat widget (gpt-4o, streaming, 30 tools)
      ai/tts/                 # POST text → OpenAI TTS audio/mpeg (nova voice)
      portal/                 # Portal-scoped endpoints (all use requirePortalSession cookie auth)
        auth/[token]/         # Validate magic token → set session cookie
        logout/               # Clear session cookie
        me/                   # Current portal user + lease data
        payments/             # Submit payment request
        maintenance/          # Submit maintenance request
        messages/             # GET threads (portal auth)
        messages/[id]/        # GET thread + mark read; POST reply (portal auth)
        request-link/         # Send new magic link
        setup/[token]/        # First-time account setup
      apply/[token]/          # Process public application submission
      apply/[token]/upload/   # Public file upload for applicants (base64 fallback, upgrades to Vercel Blob)
      tenants/[id]/ledger/send/ # Email ledger PDF to attorney/social worker via Resend
      lease-sign/[token]/     # Process e-signature submission
      leases/
        [id]/move-out/          # POST — record move-out, mark unit vacant, create Task + ActivityEvent
        [id]/renew/             # POST — create new pending lease, send for e-sign
        [id]/non-renewal/       # POST — send non-renewal notice
      cron/
        generate-monthly-rent/  # POST (cron 6am on 1st) — creates RentPayment for all active leases
                                # Uses lease.paymentDueDay for due date (not always the 1st)
        check-expiring-leases/  # POST (cron 8am daily) — notify landlords of leases expiring ≤60 days
        mark-overdue-payments/  # POST (cron 9am daily) — mark pending past-due payments overdue
                                # Also auto-applies late fees per-lease: only if lateFeeAmount>0,
                                # grace period passed, no existing late_fee TX for that period
        portfolio-agent/        # POST (cron 12pm daily) — run AI Office Manager
      bills/                  # GET list; POST create
        [id]/                 # PATCH (approve/mark-paid with atomic expense TX); DELETE
      tasks/                  # GET list; POST create
        [id]/                 # PATCH (status/details); DELETE
      work-orders/            # GET list; POST create
        [id]/                 # PATCH (advance status, auto-expense on completed); DELETE
      inspections/            # GET list; POST schedule
        [id]/                 # PATCH (start/complete/cancel); DELETE
      tenant-charges/         # POST create (wraps Transaction: income for charges, expense for credits)
                              # 11 types: late_fee, repair_chargeback, nsf_fee, etc.
      notices/draft/          # POST — GPT-4o drafts notice text using tenant+lease context
      notices/log/            # POST — saves approved notice to ActivityEvent metadata
      ai/message-draft/       # POST — GPT-4o reply draft or thread summarize
      maintenance/
        [id]/triage/          # POST — GPT-4o classifies, suggests vendor, drafts tenant response, posts as comment
      payment-requests/       # Landlord confirms/rejects tenant payment requests
      dashboard/              # Aggregate dashboard data
      activity/               # Activity event feed (entityType + entityId filters)
      settings/profile/       # Update name/email
      settings/password/      # Change password
      settings/late-fees/     # Update LateFeeConfig
  lib/
    auth.ts                   # NextAuth config — credentials provider, session callbacks
    prisma.ts                 # Prisma client singleton
    session.ts                # requireOrg() → { userId, organizationId, role }
                              # requireOrgOrNull() — non-throwing variant
    portal-session.ts         # Cookie "portal_session" — getPortalSession(),
                              # requirePortalSession(), setPortalCookie(), clearPortalCookie()
    email.ts                  # Resend wrappers:
                              #   sendApplicationInvite, sendLeaseForSigning,
                              #   sendLeaseSigned, sendPortalInvite,
                              #   sendNewApplicationAlert, sendLedgerReport
    notifications.ts          # createNotification(input), createNotifications(inputs[])
                              # Types: message | payment_due | maintenance_update | lease_expiry | new_application
    utils.ts                  # cn, formatCurrency, formatDate, formatRelativeTime,
                              # daysUntil, getInitials
    property-health.ts        # computePropertyHealth(input) → { level, score, reasons }
                              # Levels: healthy | needs_attention | high_risk
                              # Factors: vacancy rate, overdue rent, emergency maintenance, expiring leases
    monthly-charges.ts        # leaseMonthlyDueForPeriod() — rent + active LeaseMonthlyCharge sum
                              # isMonthlyChargeActiveForPeriod() — date-range check
    document-parser.ts        # OpenAI gpt-4o vision → ParsedDocument (classification + extraction)
                              # Used by /api/documents for Document Center AI classification
    service-auth.ts           # verifyMoraServiceKey(), moraServiceGuard() — Mora API key validation
    ai/handlers.ts            # AI chat tool implementations (30 tools, all Prisma)
    ai/tools.ts               # AI chat tool definitions (OpenAI function-calling format)
    agent/portfolio-agent.ts  # runPortfolioAgent() — GPT-4o daily portfolio analysis
                              # gatherPortfolioState() — collects real DB data for context
                              # approveAndExecuteTask() — handles approved AgentTask execution
                              # Risk tiers: AUTO_RUN (immediate) | AUTO_DRAFT (queued) | STRICT_BLOCK (data only)
  contexts/
    MigrationContext.tsx      # Upload → extract → conflict check state (wraps entire app shell via AppShell)
  components/
    GlobalSearch.tsx          # ⌘K search — GlobalSearch (sidebar trigger) + GlobalSearchTrigger (mobile icon)
    ThemeProvider.tsx         # next-themes wrapper — defaultTheme="dark", attribute="class"
    ThemeToggle.tsx           # Sun/Moon toggle button — variant="sidebar" | "menu"
    layout/
      AppShell.tsx            # Sidebar + main content wrapper, responsive
      Sidebar.tsx             # Nav links, NotificationBell, ThemeToggle, sign-out
      MobileTopBar.tsx        # Mobile header — logo, NotificationBell, hamburger menu
                              # Drawer includes ThemeToggle + sign-out
      NotificationBell.tsx    # Bell icon + dropdown; side="right" (sidebar) | "bottom" (mobile)
      BottomNav.tsx           # Mobile bottom tab bar (5 key tabs)
    ai/ChatWidget.tsx         # Floating AI assistant — gpt-4o, 30 tools, voice in/out
                              # STT: Web Speech API (SpeechRecognition) — mic input only
                              # TTS: OpenAI nova voice via /api/ai/tts — NOT Web Speech API
    applications/             # DocumentsSection, InviteButton, ScreeningSection,
                              # WorkflowVerificationPanel
    leases/MoveInChecklist.tsx
    tenants/SendPortalInviteButton.tsx
    tenants/TenantMessageButton.tsx
    ui/                       # shadcn components (avatar, badge, button, calendar,
                              # card, command, dialog, dropdown-menu, input, label,
                              # popover, progress, select, separator, sheet, sonner,
                              # table, tabs, textarea)
```

## Auth Patterns

**Landlord/staff** — server components: `const session = await auth()`. API routes: `const { userId, organizationId, role } = await requireOrg()`. Throws → 401 on failure.

**Tenant portal** — completely separate. Cookie `portal_session` scoped to path `/portal`. Server: `await requirePortalSession()` returns `{ tenant, lease, ... }`. No NextAuth involved. Portal messaging uses `/api/portal/messages/*`, NOT the landlord `/api/messages/*`.

**Public** — `apply/[token]`, `lease-sign/[token]`, `portal/login`, `portal/auth/[token]`, `portal/setup/[token]` — no auth.

## API Route Conventions

Multi-action routes use `?action=` query param:
```ts
const action = searchParams.get("action") ?? "default"
if (action === "parse")  { ... }
if (action === "commit") { ... }
```

All API routes return `Response.json(...)`. Errors return `{ error: string }` with appropriate status code.

## AI Chat Widget

`src/components/ai/ChatWidget.tsx` — floating assistant, bottom-right corner.
- **Model**: gpt-4o via `/api/ai/chat` (route has `export const maxDuration = 60` for Vercel timeout)
- **Tools**: 30 tools defined in `src/lib/ai/tools.ts` (OpenAI function-calling format)
- **Voice input**: Web Speech API (`SpeechRecognition`) — auto-sends on recognition end
- **Voice output**: OpenAI TTS (`nova` voice) via `POST /api/ai/tts` → returns `audio/mpeg` → played via `new Audio(url)`. Do NOT use `window.speechSynthesis` for the assistant voice.
- **Tool loop**: `finish_reason === "tool_calls"` → call handlers → send `role: "tool"` results → repeat
- **Conversational behavior**: The system prompt instructs the AI to ask for one piece of information at a time when collecting details for a task (adding a property, creating a tenant, etc.). Never list all required fields upfront.
- **Rule**: Any new workflow action must also get a corresponding tool in `tools.ts` + handler in `handlers.ts`

`src/lib/ai/handlers.ts` — implements all 30 tools with direct Prisma calls. Signature: `handleTool(name, input, organizationId, userId)`.

## Smart Import / Migration Center

`api/import/smart/route.ts` — exports `ExtractedTenant` interface. Three actions:
- `extract` — FormData file → gpt-4o (vision for images, text for PDF/CSV/XLSX) → `ExtractedTenant[]`
  - Images (PNG, JPG, WEBP, etc.): sent as base64 to GPT-4o vision API — reads screenshots and photos
  - PDFs: text extracted with `pdf2json`, then sent as text
  - CSV/XLSX: parsed to CSV text, then sent as text
  - Pasted text: wrapped as a File("pasted.csv") on the frontend, same text path
- `check-conflicts` — `{ emails: string[] }` → `{ existing: string[] }`
- `commit` — `{ records, options: { createLeases, createPayments } }` → creates tenants / properties / units / leases / payments / transactions
  - Tenant dedup: matches by email OR phone OR full name (case-insensitive)
  - Property dedup: matches by name or street address
  - Unit dedup: matches by unitNumber within property
  - Payment dedup: upserts on `(leaseId, periodYear, periodMonth)` — safe to re-import; multiple payments per month are **summed**, not replaced
  - `ledgerEntries` → committed as `Transaction` records

### Smart Import extraction rules (critical — do not regress)

**`paymentHistory`** — one entry per calendar month from lease start through today:
- Months where rent was received: `date` = receipt date, `amount` = amount received, `status` = "paid"/"partial"
- Months where NO payment was received: `date` = first of month, `amount` = 0, `status` = "overdue" — **must still be included**
- The "Balance" or "Running Balance" column is cumulative debt — **never** use those figures as `amount`
- `amountDue` in the DB is always the monthly rent (`rec.rentAmount`), never the total outstanding balance

**`ledgerEntries`** — EVERY row that is not a regular monthly rent charge or rent payment:
- Types: `late_fee`, `nsf_fee`, `returned_payment` (positive amount — adds back to owed), `attorney_fee`, `court_cost`, `legal_fee`, `deposit`, `credit` (negative amount), `adjustment`, `other`
- Capture every row verbatim. When in doubt, use `type: "other"`. Do not skip anything.
- `returned_payment`: a payment that was submitted but bounced/reversed — positive amount, increases what's owed

Front-end at `(app)/migration/page.tsx`:
- Review screen shows tenant **cards** (not a table) — one card per tenant, click-to-edit fields
- Batches commit in chunks of 15 to avoid serverless timeouts

## Dark Mode & Theming

- CSS variables for light (`:root`) and dark (`.dark`) defined in `src/app/globals.css` — OKLCH color space
- `next-themes` applies `.dark` class to `<html>`, default is dark, persists to localStorage
- `ThemeProvider` wraps the root layout body
- `ThemeToggle` component in Sidebar (desktop) and MobileTopBar drawer (mobile)
- No `tailwind.config.js` — all Tailwind v4 config via `@theme inline {}` in globals.css

## Mobile Layout

- **Desktop (md+)**: Sidebar (240px, collapsible to 64px) + scrollable main content
- **Mobile**: Sticky `MobileTopBar` (56px) + fixed `BottomNav` (5 tabs) + content with `pb-16`
- `BottomNav`: Home, Properties, Rent, Maintenance, Applications
- `MobileTopBar`: logo + NotificationBell + hamburger → slide-over drawer with full nav
- `ChatWidget` floats at `bottom-20 right-4` on mobile (above BottomNav), `bottom-6 right-6` on desktop

## Notifications

`src/lib/notifications.ts` — `createNotification` / `createNotifications` → write to `Notification` table.

Currently triggered by:
- New message thread (`api/messages/route.ts`)
- Message reply (`api/messages/[id]/route.ts`)
- Maintenance status change (`api/maintenance/[id]/route.ts`)
- Expiring lease cron (`api/cron/check-expiring-leases/route.ts`)
- New application submitted (`api/apply/[token]/route.ts` — also fires `sendNewApplicationAlert` email to all org users)

`NotificationBell` polls every 60 s. `side="right"` for sidebar (opens rightward), `side="bottom"` for mobile top bar (opens downward).

## Mora Service Layer

Machine-to-machine API for external integrations (e.g. the Mora service). **Do not remove, duplicate, or expose to the tenant portal.**

| Route | Method | Description |
|---|---|---|
| `/api/mora/health` | GET | Counts properties, active leases, open maintenance, overdue payments |
| `/api/mora/properties` | GET | Lists all non-archived properties with unit/vacancy summary |
| `/api/mora/leases` | GET | Lists leases; supports `?status=` and `?expiringWithinDays=` filters |
| `/api/mora/maintenance` | GET | Lists maintenance requests; supports `?status=open,in_progress` |
| `/api/mora/rent-payments` | GET | Lists rent payments; supports `?status=overdue` |

**Auth:** Every route calls `moraServiceGuard(request)` from `src/lib/service-auth.ts`, which checks the `x-mora-key` header against `MORA_SERVICE_API_KEY` (timing-safe compare).

**Org scope:** All queries are scoped to `MORA_SERVICE_ORG_ID` env var.

**Middleware:** `/api/mora` is in `isPublicApiRoute` in `src/proxy.ts` — bypasses NextAuth so the external service can authenticate with its own key.

**Env vars required:** `MORA_SERVICE_API_KEY`, `MORA_SERVICE_ORG_ID`

## Email (`src/lib/email.ts`)

Requires `RESEND_API_KEY`. Gracefully no-ops if key is missing (throws with clear message).

| Function | Trigger |
|---|---|
| `sendApplicationInvite` | Landlord invites prospect |
| `sendLeaseForSigning` | Lease sent for tenant signature |
| `sendLeaseSigned` | Tenant signed → landlord countersign prompt |
| `sendPortalInvite` | Tenant granted portal access |
| `sendNewApplicationAlert` | Applicant submits application → all org users notified |
| `sendLedgerReport` | Ledger emailed to attorney/social worker/court |

## Rent & Late Fee Logic

**Generating monthly rent (`/api/rent-payments/generate-month` + cron):**
- Due date = `lease.paymentDueDay` (1–28) for the given month — NOT always the 1st
- `amountDue` = base rent + all active `LeaseMonthlyCharge` items for that period
- Cron runs at **6am on the 1st** of each month via `vercel.json`

**Late fee auto-application (`/api/cron/mark-overdue-payments`, runs 9am daily):**
- Marks `status: "pending"` payments with `dueDate < now` as `"overdue"`
- Then per-lease: if `lease.lateFeeAmount > 0` AND `daysOverdue >= lease.lateFeGraceDays` AND no existing `late_fee` Transaction for that period → creates income Transaction
- **This is per-lease, not global** — tenants without a `lateFeeAmount` on their lease are never charged

**Recurring charges (utilities, pet fee, parking, etc.):**
- Set up per-lease via `LeaseMonthlyCharge` (MonthlyChargesManager on tenant/lease detail)
- Already factored into `amountDue` at generation time
- Displayed as line items on the rent page charge breakdown column

## Data Model — Key Fields

**`Lease`** — `status`: `active | expired | terminated | pending`. `signingStatus`: `draft | sent | tenant_signed | fully_signed`. `paymentDueDay` (1–28, default 1). `lateFeeAmount`, `lateFeGraceDays`. Move-out: `moveOutDate`, `moveOutNoticedAt`, `depositReturnAmount`, `depositReturnedAt`.

**`RentPayment`** — unique on `(leaseId, periodYear, periodMonth)`. `status`: `pending | partial | paid | overdue`. Use `upsert` when importing.

**`Task`** — `status`: `open | in_progress | waiting | done | cancelled`. `priority`: `low | medium | high | urgent`. `dueDate`, `tenantId`, `leaseId`, `maintenanceId`, etc. `createdByAI` flag.

**`Bill`** — `status`: `needs_review | approved | paid | overdue | rejected`. Mark-paid atomically creates expense `Transaction`. `transactionId` stored to prevent double-charging.

**`WorkOrder`** — `status`: `new | assigned | waiting_estimate | approved | in_progress | completed | invoiced | cancelled`. Auto-creates expense Transaction on `completed` if `actualCost` and `propertyId` set.

**`Inspection`** — `inspectionType`: `move_in | move_out | annual | maintenance`. `status`: `scheduled | in_progress | completed | cancelled`. `overallCondition`: `excellent | good | fair | poor`. `checklist` (JSON).

**`Application`** — `status`: `pending | documents_requested | under_review | screening | approved | denied`. `convertedTenantId` + `convertedLeaseId` set on approval.

**`MaintenanceRequest`** — `status`: `open | in_progress | pending_parts | completed | cancelled`. `priority`: `low | medium | high | emergency`.

**`AgentRun` / `AgentTask`** — AI Office Manager output. `riskTier`: `AUTO_RUN | AUTO_DRAFT | STRICT_BLOCK`. Task `status`: `pending | approved | rejected | executed | failed | auto_executed | blocked`.

**`Notification`** — `userId` is a landlord User ID (not tenant). `type`: `message | payment_due | maintenance_update | lease_expiry | new_application`.

**`PortalSession`** — `type`: `magic` (short-lived login link) | `session` (active session, 7-day cookie).

**`Transaction`** — `type`: `income | expense`. `category`: `rent | late_fee | deposit | repair | insurance | tax | utility | management | other`.

## Tenant Ledger (`/tenants/[id]/ledger`)

`tenants/[id]/ledger/LedgerView.tsx` — client component, print-optimized.
- Merges `RentPayment` records + `Transaction` records into one chronological table (charges, payments, running balance)
- Sort order: chronological; on same date, charges come before payments
- Print CSS uses `visibility: hidden` on `body *` + `visibility: visible` on `.ledger-document` — only the document renders in print/PDF
- "Print / Save as PDF" calls `window.print()` — no library needed
- "Send by Email" sheet → `POST /api/tenants/[id]/ledger/send` → Resend HTML email

## Tenants Page (`/tenants`)

- Groups tenants by **unit**, not by lease record — if two active leases exist for the same unit (e.g. imported separately), their tenants are merged into one card
- Unattached tenants (no active lease) each get their own card with a "No lease" badge
- Server Component — no event handlers on JSX elements (no `onClick` on `<a>` tags)

## Do Not
- Run `prisma migrate` — always `prisma db push`
- Initialize `new Resend(...)` at module top-level — always inside the async handler body
- Call React hooks conditionally — all `useState`, `useEffect`, `useRouter` etc. must be at the component top level before any `if` or early return
- Use `Decimal` values from Prisma directly in arithmetic — convert with `Number(value)` first
- Pass Prisma objects with `Decimal` fields directly to Client Components — serialize with `Number()` in the server page first
- Use `window.speechSynthesis` for AI voice output — always use `/api/ai/tts` (OpenAI nova voice)
- Add `onClick` or other event handlers to JSX in Server Components — extract a Client Component instead
- Use Anthropic SDK — the entire AI layer uses OpenAI (gpt-4o)
- Add sidebar nav links for one-time flows (migration is reached via dashboard CTA, not nav)
- Use `rec.balance` as `amountDue` in import commit — `amountDue` is always the monthly rent (`rec.rentAmount`)
