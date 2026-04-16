import Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  // ── READ tools ────────────────────────────────────────────────────────────
  {
    name: "get_properties",
    description: "Get a list of properties in the landlord's portfolio with status and unit counts",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["occupied", "vacant", "under_maintenance"], description: "Filter by status" },
        search: { type: "string", description: "Search by name or address" },
      },
    },
  },
  {
    name: "get_tenants",
    description: "Search and list tenants with their current lease info",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search by name, email, or phone" },
      },
    },
  },
  {
    name: "get_tenant_balance",
    description: "Get rent payment history and current balance for a specific tenant",
    input_schema: {
      type: "object",
      properties: {
        tenantName: { type: "string", description: "Full or partial tenant name" },
      },
      required: ["tenantName"],
    },
  },
  {
    name: "get_overdue_payments",
    description: "Get all overdue rent payments across all properties",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_expiring_leases",
    description: "Get leases expiring within a given number of days",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days ahead to check (default 60)" },
      },
    },
  },
  {
    name: "get_open_maintenance",
    description: "Get open maintenance requests, optionally filtered by priority or status",
    input_schema: {
      type: "object",
      properties: {
        priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
        status: { type: "string", enum: ["open", "in_progress", "pending_parts"] },
      },
    },
  },
  {
    name: "get_financial_summary",
    description: "Get income vs expense summary for a given month",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "number", description: "Year (default current)" },
        month: { type: "number", description: "Month 1-12 (default current)" },
      },
    },
  },
  {
    name: "get_lease_details",
    description: "Get full lease details for a tenant by name or lease ID, including rent amount, dates, deposit, and signing status",
    input_schema: {
      type: "object",
      properties: {
        tenantName: { type: "string", description: "Tenant full or partial name" },
        leaseId: { type: "string", description: "Lease ID (alternative to tenantName)" },
      },
    },
  },
  {
    name: "get_vendors",
    description: "List all vendors (contractors) in the portfolio",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_messages",
    description: "List recent message threads with tenants",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_applications",
    description: "List tenant applications, optionally filtered by status",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "documents_requested", "under_review", "screening", "approved", "denied"] },
      },
    },
  },
  {
    name: "get_application",
    description: "Get full details of a single application including documents, screening, references, and workflow state",
    input_schema: {
      type: "object",
      properties: {
        applicationId: { type: "string", description: "Application ID" },
        applicantName: { type: "string", description: "Applicant's name to search by (alternative to ID)" },
      },
    },
  },

  // ── WRITE tools — tenants ─────────────────────────────────────────────────
  {
    name: "create_tenant",
    description: "Create a new tenant record. Returns the created tenant with their ID.",
    input_schema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string" },
        notes: { type: "string" },
      },
      required: ["firstName", "lastName"],
    },
  },
  {
    name: "update_tenant",
    description: "Update an existing tenant's contact info or notes. Find the tenant first with get_tenants to get their ID.",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string", description: "Tenant ID" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        notes: { type: "string" },
      },
      required: ["tenantId"],
    },
  },

  // ── WRITE tools — properties & units ──────────────────────────────────────
  {
    name: "create_property",
    description: "Create a new property. Returns the created property with its ID.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Property name or identifier" },
        addressLine1: { type: "string" },
        city: { type: "string" },
        state: { type: "string", description: "2-letter state code" },
        zip: { type: "string" },
        propertyType: { type: "string", enum: ["single_family", "multi_unit", "condo", "commercial"], description: "Default: single_family" },
        unitCount: { type: "number", description: "Number of units to create (default 1)" },
      },
      required: ["name", "addressLine1", "city", "state", "zip"],
    },
  },
  {
    name: "add_unit",
    description: "Add a new unit to an existing property. Get the propertyId from get_properties first.",
    input_schema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        unitNumber: { type: "string", description: "Unit identifier, e.g. '1A', '201', 'B'" },
        bedrooms: { type: "number" },
        bathrooms: { type: "number" },
        sqft: { type: "number" },
      },
      required: ["propertyId", "unitNumber"],
    },
  },

  // ── WRITE tools — leases ──────────────────────────────────────────────────
  {
    name: "create_lease",
    description: "Create a new lease linking a tenant to a unit. Requires unitId and tenantId — get these from get_properties and get_tenants first. Returns the created lease ID.",
    input_schema: {
      type: "object",
      properties: {
        unitId: { type: "string", description: "Unit ID to lease" },
        tenantId: { type: "string", description: "Tenant ID (primary tenant)" },
        startDate: { type: "string", description: "Lease start date YYYY-MM-DD" },
        endDate: { type: "string", description: "Lease end date YYYY-MM-DD (omit for month-to-month)" },
        rentAmount: { type: "number", description: "Monthly rent in dollars" },
        depositAmount: { type: "number", description: "Security deposit amount" },
        paymentDueDay: { type: "number", description: "Day of month rent is due (1-28, default 1)" },
      },
      required: ["unitId", "tenantId", "startDate", "rentAmount"],
    },
  },

  // ── WRITE tools — maintenance ─────────────────────────────────────────────
  {
    name: "create_maintenance_request",
    description: "Create a new maintenance request for a property. Get propertyId from get_properties. Returns the created request ID.",
    input_schema: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: "Property ID — get from get_properties" },
        title: { type: "string", description: "Short description of the issue" },
        description: { type: "string", description: "Detailed description" },
        priority: { type: "string", enum: ["low", "medium", "high", "emergency"], description: "Default: medium" },
        category: { type: "string", enum: ["plumbing", "electrical", "hvac", "appliance", "structural", "other"] },
        assignedVendorId: { type: "string", description: "Optional vendor ID — get from get_vendors" },
      },
      required: ["propertyId", "title", "description"],
    },
  },
  {
    name: "update_maintenance_request",
    description: "Update the status, priority, or assigned vendor of a maintenance request. Get the requestId from get_open_maintenance.",
    input_schema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "Maintenance request ID" },
        status: { type: "string", enum: ["open", "in_progress", "pending_parts", "completed", "cancelled"] },
        priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
        assignedVendorId: { type: "string", description: "Vendor ID to assign (get from get_vendors)" },
        notes: { type: "string", description: "Additional notes" },
      },
      required: ["requestId"],
    },
  },

  // ── WRITE tools — rent payments ───────────────────────────────────────────
  {
    name: "record_payment",
    description: "Record a rent payment for a tenant. Returns a pending action that the user must confirm before it is committed.",
    input_schema: {
      type: "object",
      properties: {
        tenantName: { type: "string", description: "Tenant's full name" },
        amount: { type: "number", description: "Payment amount in dollars" },
        method: { type: "string", enum: ["cash", "check", "ach", "zelle", "venmo", "other"] },
        periodYear: { type: "number", description: "Year of the payment period (default current)" },
        periodMonth: { type: "number", description: "Month 1-12 (default current)" },
        notes: { type: "string" },
      },
      required: ["tenantName", "amount"],
    },
  },

  // ── WRITE tools — messages ────────────────────────────────────────────────
  {
    name: "send_message",
    description: "Send a message to a tenant. Creates a new conversation thread or replies to an existing one. Get tenantId from get_tenants.",
    input_schema: {
      type: "object",
      properties: {
        tenantId: { type: "string", description: "Tenant ID — get from get_tenants" },
        subject: { type: "string", description: "Message subject (used when creating a new thread)" },
        body: { type: "string", description: "Message body" },
      },
      required: ["tenantId", "body"],
    },
  },

  // ── WRITE tools — financials ─────────────────────────────────────────────
  {
    name: "create_transaction",
    description: "Record an income or expense transaction in the financials ledger.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense"] },
        category: { type: "string", enum: ["rent", "late_fee", "deposit", "repair", "insurance", "tax", "utility", "management", "other"] },
        amount: { type: "number", description: "Amount in dollars (positive)" },
        date: { type: "string", description: "Date YYYY-MM-DD (default today)" },
        description: { type: "string" },
        propertyId: { type: "string", description: "Optional property ID — get from get_properties" },
      },
      required: ["type", "category", "amount"],
    },
  },

  // ── WRITE tools — vendors ─────────────────────────────────────────────────
  {
    name: "create_vendor",
    description: "Add a new vendor (contractor or service provider) to the portfolio.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Vendor or company name" },
        trade: { type: "string", description: "Specialty, e.g. Plumbing, HVAC, Electrical" },
        phone: { type: "string" },
        email: { type: "string" },
        notes: { type: "string" },
      },
      required: ["name"],
    },
  },

  // ── WRITE tools — applications ────────────────────────────────────────────
  {
    name: "advance_application_status",
    description: "Move an application to a new workflow status (pending → documents_requested → under_review → screening → denied). Use the convert endpoint to approve.",
    input_schema: {
      type: "object",
      properties: {
        applicationId: { type: "string" },
        status: { type: "string", enum: ["pending", "documents_requested", "under_review", "screening", "denied"] },
      },
      required: ["applicationId", "status"],
    },
  },
  {
    name: "set_screening_status",
    description: "Update the background check / screening result for an application",
    input_schema: {
      type: "object",
      properties: {
        applicationId: { type: "string" },
        backgroundCheckStatus: { type: "string", enum: ["not_started", "in_progress", "passed", "failed", "conditional"] },
        backgroundCheckNotes: { type: "string" },
        backgroundCheckDate: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["applicationId", "backgroundCheckStatus"],
    },
  },
  {
    name: "add_application_document",
    description: "Add a document link to an application",
    input_schema: {
      type: "object",
      properties: {
        applicationId: { type: "string" },
        name: { type: "string" },
        url: { type: "string" },
        docType: { type: "string", enum: ["pay_stub", "id", "bank_statement", "other"] },
      },
      required: ["applicationId", "name", "url", "docType"],
    },
  },
  {
    name: "confirm_move_in",
    description: "Confirm move-in for a fully-signed lease, marking the tenant as active",
    input_schema: {
      type: "object",
      properties: {
        leaseId: { type: "string" },
      },
      required: ["leaseId"],
    },
  },
];
