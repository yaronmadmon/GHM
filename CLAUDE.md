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
| AI | OpenAI SDK — gpt-4o for chat widget (streaming, 24 tools) and smart import (vision + text) |
| Toasts | Sonner — `import { toast } from "sonner"` |
| File upload | UploadThing |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Dark mode | next-themes — class-based, default dark, persisted in localStorage |

## Environment Variables (`.env.local`)
```
DATABASE_URL=           # Neon PostgreSQL connection string
NEXTAUTH_SECRET=
NEXTAUTH_URL=           # e.g. http://localhost:3000
OPENAI_API_KEY=         # Used for AI chat widget and smart import extraction
RESEND_API_KEY=
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
      vendors/                # Vendor/contractor list — full CRUD
      messages/               # Landlord ↔ tenant threaded messaging
      applications/           # Rental applications; [id]/ workflow
      financials/             # Income/expense transactions
        new-transaction/      # Transaction creation form
      import-export/          # Export (Excel/CSV) + Smart Import tab (links to /migration)
      migration/              # AI migration center — card review flow (upload → review → done)
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
      messages/               # Create thread; [id]/ reply (landlord-side)
      applications/           # CRUD + invites + [id]/documents/ + [id]/convert/
      notifications/          # GET list + PATCH mark-all-read; [id]/ PATCH mark-read
      transactions/           # Financial transaction CRUD
      vendors/                # Vendor CRUD; [id]/ PATCH + DELETE
      import/                 # Manual CSV column-mapping import (parse + commit actions)
      import/smart/           # AI import: extract | check-conflicts | commit actions
      export/                 # Excel + multi-CSV export
      ai/chat/                # AI chat widget (gpt-4o, streaming, 24 tools)
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
    ai/handlers.ts            # AI chat tool implementations (24 tools, all Prisma)
    ai/tools.ts               # AI chat tool definitions (OpenAI function-calling format)
  components/
    ThemeProvider.tsx         # next-themes wrapper — defaultTheme="dark", attribute="class"
    ThemeToggle.tsx           # Sun/Moon toggle button — variant="sidebar" | "menu"
    layout/
      AppShell.tsx            # Sidebar + main content wrapper, responsive
      Sidebar.tsx             # Nav links, NotificationBell, ThemeToggle, sign-out
      MobileTopBar.tsx        # Mobile header — logo, NotificationBell, hamburger menu
                              # Drawer includes ThemeToggle + sign-out
      NotificationBell.tsx    # Bell icon + dropdown; side="right" (sidebar) | "bottom" (mobile)
      BottomNav.tsx           # Mobile bottom tab bar (5 key tabs)
    ai/ChatWidget.tsx         # Floating AI assistant — gpt-4o, 24 tools, voice in/out
                              # Web Speech API for STT + TTS, no extra dependencies
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
- **Model**: gpt-4o via `/api/ai/chat`
- **Tools**: 24 tools defined in `src/lib/ai/tools.ts` (OpenAI function-calling format)
- **Voice input**: Web Speech API (`SpeechRecognition`) — auto-sends on recognition end
- **Voice output**: Web Speech API (`SpeechSynthesis`) — speaks assistant responses
- **Tool loop**: `finish_reason === "tool_calls"` → call handlers → send `role: "tool"` results → repeat

`src/lib/ai/handlers.ts` — implements all 24 tools with direct Prisma calls. Signature: `handleTool(name, input, organizationId, userId)`.

## Smart Import / Migration Center

`api/import/smart/route.ts` — exports `ExtractedTenant` interface. Three actions:
- `extract` — FormData file → gpt-4o (vision for images, text for PDF/CSV/XLSX) → `ExtractedTenant[]`
  - Images (PNG, JPG, WEBP, etc.): sent as base64 to GPT-4o vision API — reads screenshots and photos
  - PDFs: text extracted with `pdf-parse`, then sent as text
  - CSV/XLSX: parsed to CSV text, then sent as text
  - Pasted text: wrapped as a File("pasted.csv") on the frontend, same text path
- `check-conflicts` — `{ emails: string[] }` → `{ existing: string[] }`
- `commit` — `{ records, options: { createLeases, createPayments } }` → creates tenants / properties / units / leases / payments
  - Tenant dedup: matches by email OR phone OR full name (case-insensitive)
  - Property dedup: matches by name or street address
  - Unit dedup: matches by unitNumber within property
  - Payment dedup: upserts on `(leaseId, periodYear, periodMonth)` — safe to re-import

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

`NotificationBell` polls every 60 s. `side="right"` for sidebar (opens rightward), `side="bottom"` for mobile top bar (opens downward).

## Email (`src/lib/email.ts`)

Requires `RESEND_API_KEY`. Gracefully no-ops if key is missing (throws with clear message).

| Function | Trigger |
|---|---|
| `sendApplicationInvite` | Landlord invites prospect |
| `sendLeaseForSigning` | Lease sent for tenant signature |
| `sendLeaseSigned` | Tenant signed → landlord countersign prompt |
| `sendPortalInvite` | Tenant granted portal access |

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

## Do Not
- Store secrets in code — `.env.local` only, never committed
- Run `prisma migrate` — always `prisma db push`
- Add sidebar nav links for one-time flows (migration is reached via CTA cards, not the nav)
- Mock the database in tests — use real Neon DB
- Use `Decimal` values from Prisma directly in arithmetic — convert with `Number(value)` first
- Use Anthropic SDK — the entire AI layer uses OpenAI (gpt-4o)
