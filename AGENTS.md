<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GHM Agent Notes

## Verify Before Shipping

- Run `npx tsc --noEmit` after code changes.
- Run `npx next build` before committing or pushing.
- Use `npx prisma db push` for schema sync. Do not run Prisma migrations in this repo.
- The app uses Next.js 16.2.1 App Router. Route/page `params` are promises: always `const { id } = await params`.

## Codebase Rules

- Do not initialize `new Resend(...)` at module scope. Email clients must be created lazily inside helper/handler execution.
- Convert Prisma `Decimal` values with `Number(...)` before arithmetic or passing to Client Components.
- React hooks must be top-level and unconditional.
- The AI stack is OpenAI. Do not add Anthropic code.
- Preserve user work in dirty files. Do not revert unrelated changes.

## Smart Import

- Smart import lives in `src/app/api/import/smart/route.ts` and the review UI is `src/app/(app)/migration/page.tsx`.
- Tenant ledger imports must match existing properties by normalized property name/address before creating new properties.
- If an uploaded ledger is already represented by existing imported ledger transactions, return an unchanged/no-update result. Do not rewrite duplicate ledger rows.
- If a recognized existing ledger has changed, replace the old imported ledger rows with the new authoritative rows.
- If a ledger is genuinely new and no property matches, create the property, unit, lease, and ledger rows.
- Never use a running balance as a payment amount. Running balance is only source context for outstanding balance.

## Dashboard Balance

- Outstanding tenant balances must use `calculateLeaseOutstandingBalance` from `src/lib/rent-ledger.ts` so the dashboard, tenant card, dashboard API, and portfolio analyzer all agree.
- Balance is always pure math: `sum(amountDue - amountPaid)` across RentPayments + `sum(income) - sum(expense)` across Transactions. Do NOT read embedded `(balance: $X)` strings from AI-imported transaction descriptions — those strings are frozen at import time and become wrong after any data correction. `calculateLeaseOutstandingBalance` intentionally delegates to `calculateLeaseBalance` (pure math) and does not use `getLatestImportedRunningBalance`.

## Applications And Lease Workflow

- Applications use these statuses: `pending`, `documents_requested`, `under_review`, `screening`, `approved`, `denied`.
- The applications board must show every status so applications do not disappear after being advanced.
- Applicant-uploaded Government ID documents use `government_id`, not `id`.
- Landlord document review should preview stored image/PDF uploads when possible.
- Approval/conversion must go through `src/app/api/applications/[id]/convert/route.ts`; do not PATCH directly to `approved`.
- Conversion creates the tenant and lease, links the application via `convertedTenantId` and `convertedLeaseId`, and then the lease can be sent through `src/app/api/leases/[id]/send-for-signing/route.ts`.
- If lease email delivery fails, the send-for-signing route must not leave the lease falsely marked as `sent`.
- The public signing payload in `src/app/api/lease-sign/[token]/route.ts` must include application-derived lease information such as residents, occupants, rent, deposit, dates, property address, and default lease sections.
