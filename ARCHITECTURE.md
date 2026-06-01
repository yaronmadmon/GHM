# GHM Architecture

> **To view this diagram:** Open this file in VS Code, then press `Ctrl+Shift+V` to open the Markdown Preview.

```mermaid
flowchart TD
    subgraph Browser["🖥️ Browser"]
        User(["Landlord / Staff"])
        Tenant(["Tenant"])
    end

    subgraph Auth["Authentication"]
        NextAuth["NextAuth v5\nCredentials Provider"]
        PortalCookie["Portal Session\nCookie Auth"]
    end

    subgraph Pages["Next.js Pages  (App Router)"]
        Dashboard["/dashboard\nKPIs · Overdue · Activity"]
        Properties["/properties\nList · Detail · Photos"]
        Tenants["/tenants\nList · Detail · Ledger"]
        Leases["/leases\nList · Detail · Sign"]
        Rent["/rent\nPayments · History"]
        Maintenance["/maintenance\nRequests · Comments"]
        Financials["/financials\nTransactions"]
        Migration["/migration\nAI Import Center"]
        Analyzer["/portfolio-analyzer\nAI Financial Analysis"]
        Portal["/portal\nTenant Self-Service"]
        Apply["/apply/token\nPublic Application"]
    end

    subgraph API["API Routes"]
        APIDashboard["/api/dashboard"]
        APIProperties["/api/properties"]
        APITenants["/api/tenants"]
        APILeases["/api/leases"]
        APIRent["/api/rent-payments"]
        APIMaint["/api/maintenance"]
        APITxn["/api/transactions"]
        APIImport["/api/import/smart\nextract · check · commit"]
        APIAnalysis["/api/portfolio-analysis"]
        APILedgerSend["/api/tenants/id/ledger/send"]
        APIPortal["/api/portal/*"]
        APICron["/api/cron/*\nmark-overdue · expiring-leases"]
        APIChat["/api/ai/chat\n24 tools · streaming"]
    end

    subgraph Services["External Services"]
        Prisma[("Prisma ORM")]
        Neon[("Neon\nPostgreSQL")]
        OpenAI["OpenAI\ngpt-4o"]
        Resend["Resend\nEmail"]
        Vercel["Vercel\nHosting + Cron"]
    end

    subgraph DataModel["Data Model"]
        Org["Organization"]
        Prop["Property"]
        Unit["Unit"]
        Lease["Lease"]
        TenantM["Tenant"]
        RentPay["RentPayment"]
        Txn["Transaction"]
        MonthlyCharge["LeaseMonthlyCharge"]
        MaintenanceReq["MaintenanceRequest"]
        AppModel["Application"]
    end

    subgraph BalanceCalc["Balance Pipeline (pure math)"]
        RP["RentPayments\namountDue − amountPaid"]
        TX["Transactions\nincome + / expense −"]
        MC["MonthlyCharges\nactive recurring charges"]
        Bal["Final Balance"]
        RP --> Bal
        TX --> Bal
        MC --> Bal
    end

    %% User flows
    User --> NextAuth --> Pages
    Tenant --> PortalCookie --> Portal
    User --> Apply

    %% Pages → API
    Dashboard --> APIDashboard
    Properties --> APIProperties
    Tenants --> APITenants & APILedgerSend
    Leases --> APILeases
    Rent --> APIRent
    Maintenance --> APIMaint
    Financials --> APITxn
    Migration --> APIImport
    Analyzer --> APIAnalysis
    Portal --> APIPortal

    %% AI Chat widget (on every page)
    Pages --> APIChat

    %% API → Prisma → Neon
    APIDashboard & APIProperties & APITenants & APILeases --> Prisma
    APIRent & APIMaint & APITxn & APIImport & APIAnalysis --> Prisma
    APIPortal & APICron & APIChat --> Prisma
    Prisma --> Neon

    %% AI routes
    APIImport --> OpenAI
    APIAnalysis --> OpenAI
    APIChat --> OpenAI

    %% Email routes
    APILedgerSend --> Resend
    APILeases --> Resend
    APIPortal --> Resend
    APIMaint --> Resend

    %% Cron runs on Vercel
    Vercel --> APICron

    %% Data model
    Neon -.-> Org --> Prop --> Unit --> Lease
    Lease --> TenantM & RentPay & Txn & MonthlyCharge
    Lease --> MaintenanceReq
    Prop --> AppModel

    %% Balance calc
    RentPay -.-> RP
    Txn -.-> TX
    MonthlyCharge -.-> MC
```

---

## Key Rules

| Rule | Detail |
|------|--------|
| **Balance = pure math** | `calculateLeaseBalance()` — no AI strings involved |
| **AI scope** | Import only: reads PDFs → populates records → done |
| **Auth split** | Landlord = NextAuth session · Tenant = cookie `portal_session` |
| **Decimals** | Always `Number(value)` before arithmetic — never raw Prisma Decimal |
| **Email from** | `onboarding@resend.dev` until custom domain is verified |
| **DB sync** | Always `npx prisma db push` — never `prisma migrate` |
