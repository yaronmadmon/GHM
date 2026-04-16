import OpenAI from "openai";

export const tools: OpenAI.Chat.ChatCompletionTool[] = [
  // ── READ tools ────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_properties",
      description: "Get a list of properties in the landlord's portfolio with status and unit counts",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["occupied", "vacant", "under_maintenance"], description: "Filter by status" },
          search: { type: "string", description: "Search by name or address" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tenants",
      description: "Search and list tenants with their current lease info",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search by name, email, or phone" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tenant_balance",
      description: "Get rent payment history and current balance for a specific tenant",
      parameters: {
        type: "object",
        properties: {
          tenantName: { type: "string", description: "Full or partial tenant name" },
        },
        required: ["tenantName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_overdue_payments",
      description: "Get all overdue rent payments across all properties",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expiring_leases",
      description: "Get leases expiring within a given number of days",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Days ahead to check (default 60)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_open_maintenance",
      description: "Get open maintenance requests, optionally filtered by priority or status",
      parameters: {
        type: "object",
        properties: {
          priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
          status: { type: "string", enum: ["open", "in_progress", "pending_parts"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description: "Get income vs expense summary for a given month",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Year (default current)" },
          month: { type: "number", description: "Month 1-12 (default current)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lease_details",
      description: "Get full lease details for a tenant by name or lease ID",
      parameters: {
        type: "object",
        properties: {
          tenantName: { type: "string", description: "Tenant full or partial name" },
          leaseId: { type: "string", description: "Lease ID (alternative to tenantName)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_vendors",
      description: "List all vendors (contractors) in the portfolio",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_messages",
      description: "List recent message threads with tenants",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_applications",
      description: "List tenant applications, optionally filtered by status",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "documents_requested", "under_review", "screening", "approved", "denied"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_application",
      description: "Get full details of a single application",
      parameters: {
        type: "object",
        properties: {
          applicationId: { type: "string" },
          applicantName: { type: "string", description: "Search by name (alternative to ID)" },
        },
      },
    },
  },

  // ── WRITE tools — tenants ─────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_tenant",
      description: "Create a new tenant record",
      parameters: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          notes: { type: "string" },
        },
        required: ["firstName", "lastName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tenant",
      description: "Update an existing tenant's info. Get tenantId from get_tenants first.",
      parameters: {
        type: "object",
        properties: {
          tenantId: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          notes: { type: "string" },
        },
        required: ["tenantId"],
      },
    },
  },

  // ── WRITE tools — properties & units ──────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_property",
      description: "Create a new property with units",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          addressLine1: { type: "string" },
          city: { type: "string" },
          state: { type: "string", description: "2-letter state code" },
          zip: { type: "string" },
          propertyType: { type: "string", enum: ["single_family", "multi_unit", "condo", "commercial"] },
          unitCount: { type: "number", description: "Number of units to create (default 1)" },
        },
        required: ["name", "addressLine1", "city", "state", "zip"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_unit",
      description: "Add a unit to an existing property. Get propertyId from get_properties first.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string" },
          unitNumber: { type: "string" },
          bedrooms: { type: "number" },
          bathrooms: { type: "number" },
          sqft: { type: "number" },
        },
        required: ["propertyId", "unitNumber"],
      },
    },
  },

  // ── WRITE tools — leases ──────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_lease",
      description: "Create a lease linking a tenant to a unit. Get unitId and tenantId from get_properties / get_tenants first.",
      parameters: {
        type: "object",
        properties: {
          unitId: { type: "string" },
          tenantId: { type: "string" },
          startDate: { type: "string", description: "YYYY-MM-DD" },
          endDate: { type: "string", description: "YYYY-MM-DD, omit for month-to-month" },
          rentAmount: { type: "number" },
          depositAmount: { type: "number" },
          paymentDueDay: { type: "number", description: "1-28, default 1" },
        },
        required: ["unitId", "tenantId", "startDate", "rentAmount"],
      },
    },
  },

  // ── WRITE tools — maintenance ─────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_maintenance_request",
      description: "Create a maintenance request. Get propertyId from get_properties first.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
          category: { type: "string", enum: ["plumbing", "electrical", "hvac", "appliance", "structural", "other"] },
          assignedVendorId: { type: "string" },
        },
        required: ["propertyId", "title", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_maintenance_request",
      description: "Update status, priority, or vendor of a maintenance request. Get requestId from get_open_maintenance first.",
      parameters: {
        type: "object",
        properties: {
          requestId: { type: "string" },
          status: { type: "string", enum: ["open", "in_progress", "pending_parts", "completed", "cancelled"] },
          priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
          assignedVendorId: { type: "string" },
        },
        required: ["requestId"],
      },
    },
  },

  // ── WRITE tools — payments ────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "record_payment",
      description: "Record a rent payment. Requires user confirmation before committing.",
      parameters: {
        type: "object",
        properties: {
          tenantName: { type: "string" },
          amount: { type: "number" },
          method: { type: "string", enum: ["cash", "check", "ach", "zelle", "venmo", "other"] },
          periodYear: { type: "number" },
          periodMonth: { type: "number", description: "1-12" },
          notes: { type: "string" },
        },
        required: ["tenantName", "amount"],
      },
    },
  },

  // ── WRITE tools — messages ────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Send a message to a tenant. Get tenantId from get_tenants first.",
      parameters: {
        type: "object",
        properties: {
          tenantId: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["tenantId", "body"],
      },
    },
  },

  // ── WRITE tools — financials ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_transaction",
      description: "Record an income or expense transaction",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense"] },
          category: { type: "string", enum: ["rent", "late_fee", "deposit", "repair", "insurance", "tax", "utility", "management", "other"] },
          amount: { type: "number" },
          date: { type: "string", description: "YYYY-MM-DD, default today" },
          description: { type: "string" },
          propertyId: { type: "string" },
        },
        required: ["type", "category", "amount"],
      },
    },
  },

  // ── WRITE tools — vendors ─────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_vendor",
      description: "Add a new vendor/contractor",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          trade: { type: "string", description: "e.g. Plumbing, HVAC, Electrical" },
          phone: { type: "string" },
          email: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
      },
    },
  },

  // ── WRITE tools — applications ────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "advance_application_status",
      description: "Move an application through the workflow",
      parameters: {
        type: "object",
        properties: {
          applicationId: { type: "string" },
          status: { type: "string", enum: ["pending", "documents_requested", "under_review", "screening", "denied"] },
        },
        required: ["applicationId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_screening_status",
      description: "Update background check result for an application",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "add_application_document",
      description: "Add a document link to an application",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "confirm_move_in",
      description: "Confirm move-in for a fully-signed lease",
      parameters: {
        type: "object",
        properties: {
          leaseId: { type: "string" },
        },
        required: ["leaseId"],
      },
    },
  },
];
