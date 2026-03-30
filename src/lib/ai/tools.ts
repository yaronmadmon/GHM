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
];
