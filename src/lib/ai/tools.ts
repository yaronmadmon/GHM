import Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
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
    description: "Get open maintenance requests, optionally filtered by priority",
    input_schema: {
      type: "object",
      properties: {
        priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
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
    name: "record_payment",
    description: "Record a rent payment for a tenant. Returns a pending action that the user must confirm before it is committed.",
    input_schema: {
      type: "object",
      properties: {
        tenantName: { type: "string", description: "Tenant's full name" },
        amount: { type: "number", description: "Payment amount in dollars" },
        method: { type: "string", enum: ["cash", "check", "ach", "zelle", "venmo", "other"], description: "Payment method" },
        periodYear: { type: "number", description: "Year of the payment period (default current)" },
        periodMonth: { type: "number", description: "Month 1-12 of the payment period (default current)" },
        notes: { type: "string", description: "Optional notes" },
      },
      required: ["tenantName", "amount"],
    },
  },
  {
    name: "list_applications",
    description: "List tenant applications, optionally filtered by status",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "documents_requested", "under_review", "screening", "approved", "denied"], description: "Filter by workflow status" },
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
  {
    name: "advance_application_status",
    description: "Move an application to a new workflow status (pending → documents_requested → under_review → screening → denied). Use the convert endpoint to approve.",
    input_schema: {
      type: "object",
      properties: {
        applicationId: { type: "string", description: "Application ID" },
        status: { type: "string", enum: ["pending", "documents_requested", "under_review", "screening", "denied"], description: "New status to set" },
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
        applicationId: { type: "string", description: "Application ID" },
        backgroundCheckStatus: { type: "string", enum: ["not_started", "in_progress", "passed", "failed", "conditional"], description: "Screening result" },
        backgroundCheckNotes: { type: "string", description: "Optional notes about the screening" },
        backgroundCheckDate: { type: "string", description: "Date of background check (YYYY-MM-DD)" },
      },
      required: ["applicationId", "backgroundCheckStatus"],
    },
  },
  {
    name: "add_application_document",
    description: "Add a document (pay stub, ID, bank statement, etc.) to an application",
    input_schema: {
      type: "object",
      properties: {
        applicationId: { type: "string", description: "Application ID" },
        name: { type: "string", description: "Document name (e.g. 'Oct 2024 Pay Stub')" },
        url: { type: "string", description: "Document URL (Google Drive, Dropbox, etc.)" },
        docType: { type: "string", enum: ["pay_stub", "id", "bank_statement", "other"], description: "Document type" },
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
        leaseId: { type: "string", description: "Lease ID" },
      },
      required: ["leaseId"],
    },
  },
];
