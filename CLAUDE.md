@AGENTS.md

# GHM — Property Management App

## Stack
| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.1 — App Router, React 19, TypeScript 5 |
| Database | Prisma 5 + Neon PostgreSQL (cloud) |
| Auth | NextAuth v5 beta (`@auth/prisma-adapter`) — credentials provider |
| Styling | Tailwind CSS v4 (no `tailwind.config.js` — config lives in CSS variables) |
| UI Components | shadcn/ui → `src/components/ui/` |
| Email | Resend (`src/lib/email.ts`) |
| AI | Anthropic SDK — Haiku for chat widget, Sonnet 4.6 for smart import |
| Toasts | Sonner — `import { toast } from "sonner"` |
| File upload | UploadThing |
| Forms | react-hook-form + zod |
| Charts | Recharts |

## Environment Variables (`.env.local`)
```
DATABASE_URL=           # Neon PostgreSQL connection string
NEXTAUTH_SECRET=
NEXTAUTH_URL=           # e.g. http://localhost:3000
ANTHROPIC_API_KEY=
RESEND_API_KEY=         # rnd_vESjERnLXk6wNSaWZrPzlwnVm90B
EMAIL_FROM=             # e.g. GHM <noreply@yourdomain.com>
UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=
```

## Project Structure

```
src/
  app/
    (app)/                    # Landlord/staff app — requires NextAuth session
      layout.tsx              # Auth guard, AppShell, ChatWidget
      dashboard/              # KPI cards, overdue rent, expiring leases, activity feed
                              # Shows migration CTA when properties.total === 0
      properties/             # Property list; [id]/ detail + photo gallery
        [id]/units/new/       # Add unit to property
        new/                  # Create property
      tenants/                # Tenant list; [id]/ detail; new/
      leases/                 # Lease list; [id]/ detail; new/
      rent/                   # Rent ledger — record payments, view history
      maintenance/            # Request list; [id]/ detail with comments
      messages/               # Landlord ↔ tenant threaded messaging
      applications/           # Rental applications; [id]/ workflow
      financials/             # Income/expense transactions
        new-transaction/      # Transaction creation form
      import-export/          # Export (Excel/CSV) + Smart Import tab (links to /migration)
      migration/              # AI migration center — 3-screen flow (upload → review → done)
      settings/               # Profile, password, late fee config
    (auth)/                   # Unauthenticated — login, register
    portal/                   # Tenant self-service portal (cookie auth, separate from NextAuth)
      page.tsx                # Tenant dashboard — next payment, lease summary
      payments/               # View rent history, submit payment requests
      maintenance/            # Submit and track maintenance requests
      messages/               # Tenant ↔ landlord messaging
      lease/                  # View lease details and signing status
      login/                  # Magic-link login entry point
      auth/[token]/           # Validates magic link token, issues session cookie
      setup/[token]/          # First-time portal account setup
    apply/[token]/            # Public rental application form (no auth)
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
      messages/               # Create thread; [id]/ reply
      applications/           # CRUD + invites + [id]/documents/ + [id]/convert/
      notifications/          # GET list + PATCH mark-all-read; [id]/ PATCH mark-read
      transactions/           # Financial transaction CRUD
      import/                 # Manual CSV column-mapping import (parse + commit actions)
      import/smart/           # AI import: extract | check-conflicts | commit actions
      export/                 # Excel + multi-CSV export
      ai/chat/                # AI chat widget (Claude Haiku, streaming)
      portal/                 # Portal-scoped endpoints
        auth/[token]/         # Validate magic token → set session cookie
        logout/               # Clear session cookie
        me/                   # Current portal user + lease data
        payments/             # Submit payment request
        maintenance/          # Submit maintenance request
        request-link/         # Send new magic link
        setup/[token]/        # First-time account setup
      apply/[token]/          # Process public application submission
      lease-sign/[token]/     # Process e-signature submission
      cron/
        check-expiring-leases/  # Notify landlords of leases expiring within 60 days
        mark-overdue-payments/  # Mark unpaid past-due payments as overdue
      payment-requests/       # Landlord confirms/rejects tenant payment requests
      dashboard/              # Aggregate dashboard data
      activity/               # Activity event feed
      settings/profile/       # Update name/email
      settings/password/      # Change password
      settings/late-fees/     # Update LateFeeConfig
      vendors/                # Vendor CRUD
  lib/
    auth.ts                   # NextAuth config — credentials provider, session callbacks
    prisma.ts                 # Prisma client singleton
    session.ts                # requireOrg() → { userId, organizationId, role }
                              # requireOrgOrNull() — non-throwing variant
    portal-session.ts         # Cookie "portal_session" — getPortalSession(),
                              # requirePortalSession(), setPortalCookie(), clearPortalCookie()
    email.ts                  # Resend wrappers:
                              #   sendApplicationInvite, sendLeaseForSigning,
                              #   sendLeaseSigned, sendPortalInvite
    notifications.ts          # createNotification(input), createNotifications(inputs[])
                              # Types: message | payment_due | maintenance_update | lease_expiry
    utils.ts                  # cn, formatCurrency, formatDate, formatRelativeTime,
                              # daysUntil, getInitials
    ai/handlers.ts            # AI chat tool implementations
    ai/tools.ts               # AI chat tool definitions (Anthropic tool-use format)
  components/
    layout/
      AppShell.tsx            # Sidebar + main content wrapper, responsive
      Sidebar.tsx             # Nav links, NotificationBell, sign-out
      MobileTopBar.tsx        # Mobile header — logo, NotificationBell, menu
      NotificationBell.tsx    # Bell icon + dropdown; side="right" (sidebar) | "bottom" (mobile)
      BottomNav.tsx           # Mobile bottom tab bar
    ai/ChatWidget.tsx         # Floating AI assistant (Haiku, tool-use)
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

**Tenant portal** — completely separate. Cookie `portal_session` scoped to path `/portal`. Server: `await requirePortalSession()` returns `{ tenant, lease, ... }`. No NextAuth involved.

**Public** — `apply/[token]`, `lease-sign/[token]`, `portal/login`, `portal/auth/[token]`, `portal/setup/[token]` — no auth.

## API Route Conventions

Multi-action routes use `?action=` query param:
```ts
const action = searchParams.get("action") ?? "default"
if (action === "parse")  { ... }
if (action === "commit") { ... }
```

All API routes return `Response.json(...)`. Errors return `{ error: string }` with appropriate status code.

## Data Model — Key Fields

**`Lease`** — `status`: `active | expired | terminated | pending`. `signingStatus`: `draft | sent | tenant_signed | fully_signed`. `paymentDueDay` (1–28, default 1). Has deposit fields: `depositAmount`, `depositPaid`, `depositPaidAt`.

**`RentPayment`** — unique on `(leaseId, periodYear, periodMonth)`. `status`: `pending | partial | paid | overdue`. Use `upsert` when importing.

**`Application`** — `status`: `pending | documents_requested | under_review | screening | approved | denied`. `convertedTenantId` + `convertedLeaseId` set on approval.

**`MaintenanceRequest`** — `status`: `open | in_progress | pending_parts | completed | cancelled`. `priority`: `low | medium | high | emergency`.

**`Notification`** — `userId` is a landlord User ID (not tenant). `type`: `message | payment_due | maintenance_update | lease_expiry`.

**`PortalSession`** — `type`: `magic` (short-lived login link) | `session` (active session, 7-day cookie).

**`Transaction`** — `type`: `income | expense`. `category`: `rent | late_fee | deposit | repair | insurance | tax | utility | management | other`.

## Database Operations

```bash
npx prisma db push      # sync schema to Neon — use this, NOT prisma migrate
npx prisma generate     # regenerate client after schema change
npx prisma studio       # browse data locally
```

All data is in **Neon PostgreSQL** (cloud). Never store data locally.

## Smart Import / Migration Center

`api/import/smart/route.ts` — exports `ExtractedTenant` interface. Three actions:
- `extract` — FormData file → Claude Sonnet 4.6 → `ExtractedTenant[]`
- `check-conflicts` — `{ emails: string[] }` → `{ existing: string[] }`
- `commit` — `{ records: ExtractedTenant[], options: { createLeases, createPayments } }` → creates tenants / properties / units / leases / payments. Deduplicates by email and address. Creates overdue payment record if `balance > 0`.

Front-end at `(app)/migration/page.tsx` batches commit in **chunks of 15** to avoid serverless timeouts.

## Notifications

`src/lib/notifications.ts` — `createNotification` / `createNotifications` → write to `Notification` table.

Currently triggered by:
- New message thread (`api/messages/route.ts`)
- Message reply (`api/messages/[id]/route.ts`)
- Maintenance status change (`api/maintenance/[id]/route.ts`)
- Expiring lease cron (`api/cron/check-expiring-leases/route.ts`)

`NotificationBell` polls every 60 s. `side="right"` for sidebar (opens rightward), `side="bottom"` for mobile top bar (opens downward).

## Email (`src/lib/email.ts`)

Requires `RESEND_API_KEY`. Gracefully no-ops if key is missing (throws with clear message).

| Function | Trigger |
|---|---|
| `sendApplicationInvite` | Landlord invites prospect |
| `sendLeaseForSigning` | Lease sent for tenant signature |
| `sendLeaseSigned` | Tenant signed → landlord countersign prompt |
| `sendPortalInvite` | Tenant granted portal access |

## Do Not
- Store secrets in code — `.env.local` only, never committed
- Run `prisma migrate` — always `prisma db push`
- Add sidebar nav links for one-time flows (migration is reached via CTA cards, not the nav)
- Mock the database in tests — use real Neon DB
- Use `Decimal` values from Prisma directly in arithmetic — convert with `Number(value)` first
