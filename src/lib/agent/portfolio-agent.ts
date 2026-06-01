import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { differenceInDays, addDays } from "date-fns";

let _openai: OpenAI | null = null;
function getOpenAI() {
  _openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

let _resend: Resend | null = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  _resend ??= new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "GHM <noreply@resend.dev>";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RiskTier = "AUTO_RUN" | "AUTO_DRAFT" | "STRICT_BLOCK";
export type Workflow =
  | "daily_briefing"
  | "collections"
  | "lease_renewal"
  | "document_bookkeeping"
  | "maintenance_triage";

export interface PlannedAction {
  actionId: string;
  riskTier: RiskTier;
  workflow: Workflow;
  title: string;
  description: string;
  executionPayload: Record<string, unknown>;
}

export interface AgentOutput {
  runSummary: string;
  observationSummary: string;
  overallConfidence: number;
  plannedActions: PlannedAction[];
  verificationCriteria: string;
}

// ─── Portfolio State Gathering ───────────────────────────────────────────────

export async function gatherPortfolioState(organizationId: string) {
  const now = new Date();
  const in60Days = addDays(now, 60);

  const [properties, maintenanceRequests, overduePayments] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, archivedAt: null },
      include: {
        units: {
          include: {
            leases: {
              where: { status: "active" },
              include: {
                tenants: { include: { tenant: true } },
                rentPayments: {
                  orderBy: { dueDate: "desc" },
                  take: 3,
                },
              },
            },
          },
        },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        organizationId,
        status: { in: ["open", "in_progress"] },
      },
      include: {
        property: { select: { name: true } },
        unit: { select: { unitNumber: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.rentPayment.findMany({
      where: {
        organizationId,
        status: "overdue",
      },
      include: {
        lease: {
          include: {
            tenants: { include: { tenant: true } },
            unit: { include: { property: { select: { name: true } } } },
          },
        },
      },
      take: 20,
    }),
  ]);

  const allUnits = properties.flatMap((p) => p.units);
  const allActiveLeases = allUnits.flatMap((u) => u.leases);
  const leasesExpiringSoon = allActiveLeases.filter(
    (l) => l.endDate && l.endDate >= now && l.endDate <= in60Days,
  );

  const totalUnits = allUnits.length;
  const occupiedUnits = allUnits.filter((u) => u.status === "occupied").length;

  const portfolioSnapshot = {
    snapshot_date: now.toISOString().split("T")[0],
    metrics: {
      totalProperties: properties.length,
      totalUnits,
      occupiedUnits,
      vacantUnits: totalUnits - occupiedUnits,
      occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      totalOverduePayments: overduePayments.length,
      leasesExpiring30Days: leasesExpiringSoon.filter(
        (l) => l.endDate && l.endDate <= addDays(now, 30),
      ).length,
      leasesExpiring60Days: leasesExpiringSoon.length,
      openMaintenanceRequests: maintenanceRequests.filter((m) => m.status === "open").length,
      inProgressMaintenanceRequests: maintenanceRequests.filter((m) => m.status === "in_progress")
        .length,
    },
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: `${p.addressLine1}, ${p.city}, ${p.state}`,
      status: p.status,
      units: p.units.map((u) => {
        const lease = u.leases[0];
        const primaryTenant =
          lease?.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease?.tenants[0]?.tenant;
        const lastPayment = lease?.rentPayments[0];
        return {
          id: u.id,
          unitNumber: u.unitNumber,
          status: u.status,
          activeLease: lease
            ? {
                id: lease.id,
                rentAmount: Number(lease.rentAmount),
                startDate: lease.startDate?.toISOString().split("T")[0] ?? null,
                endDate: lease.endDate?.toISOString().split("T")[0] ?? null,
                daysUntilExpiry: lease.endDate ? differenceInDays(lease.endDate, now) : null,
                tenant: primaryTenant
                  ? {
                      id: primaryTenant.id,
                      name: `${primaryTenant.firstName} ${primaryTenant.lastName}`,
                      email: primaryTenant.email,
                      phone: primaryTenant.phone,
                    }
                  : null,
                lastPaymentStatus: lastPayment?.status ?? null,
                lastPaymentDueDate: lastPayment?.dueDate?.toISOString().split("T")[0] ?? null,
              }
            : null,
        };
      }),
    })),
    overduePayments: overduePayments.map((p) => {
      const tenant =
        p.lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? p.lease.tenants[0]?.tenant;
      return {
        id: p.id,
        amount: Number(p.amountDue),
        dueDate: p.dueDate.toISOString().split("T")[0],
        daysOverdue: differenceInDays(now, p.dueDate),
        propertyName: p.lease.unit.property.name,
        unitNumber: p.lease.unit.unitNumber,
        leaseId: p.lease.id,
        tenant: tenant
          ? {
              id: tenant.id,
              name: `${tenant.firstName} ${tenant.lastName}`,
              email: tenant.email,
            }
          : null,
      };
    }),
    leasesExpiringSoon: leasesExpiringSoon.map((l) => {
      const unit = allUnits.find((u) => u.id === l.unitId);
      const property = properties.find((p) => p.units.some((u) => u.id === l.unitId));
      const primaryTenant =
        l.tenants.find((lt) => lt.isPrimary)?.tenant ?? l.tenants[0]?.tenant;
      return {
        id: l.id,
        rentAmount: Number(l.rentAmount),
        endDate: l.endDate?.toISOString().split("T")[0] ?? null,
        daysUntilExpiry: l.endDate ? differenceInDays(l.endDate, now) : null,
        propertyName: property?.name ?? "Unknown",
        unitNumber: unit?.unitNumber ?? "Unknown",
        tenant: primaryTenant
          ? {
              id: primaryTenant.id,
              name: `${primaryTenant.firstName} ${primaryTenant.lastName}`,
              email: primaryTenant.email,
            }
          : null,
      };
    }),
    maintenanceRequests: maintenanceRequests.map((m) => ({
      id: m.id,
      title: m.title,
      priority: m.priority,
      status: m.status,
      daysOpen: differenceInDays(now, m.createdAt),
      propertyName: m.property?.name ?? "Unknown",
      unitNumber: m.unit?.unitNumber ?? null,
      category: m.category,
    })),
  };

  return portfolioSnapshot;
}

// ─── Agent Run ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a background portfolio operator for a property management platform.

You receive a JSON snapshot of the landlord's portfolio. Analyze it and produce a structured JSON response.

RISK TIERS — apply these exactly:
- AUTO_RUN: Read-only assessments, daily briefings, internal flags — execute immediately with no landlord input required
- AUTO_DRAFT: Any tenant-facing communication (emails, letters), fee proposals, renewal offers — generate the full draft but queue it for landlord review; NEVER push live without a landlord click
- STRICT_BLOCK: Eviction language, court filings, legal notices, security deposit disputes, deleting any records — surface raw data ONLY, zero drafting, zero autonomous action

WORKFLOWS to check on every run:
1. daily_briefing (AUTO_RUN): Summarize portfolio health — occupancy, overdue rent, expiring leases, open maintenance
2. collections (AUTO_DRAFT): For each overdue payment >3 days, draft a polite payment reminder email to the tenant; include exact amount and lease link
3. lease_renewal (AUTO_DRAFT): For leases expiring within 30 days, draft a renewal offer email with current rent amount
4. maintenance_triage (AUTO_RUN): Flag any open request older than 7 days as high-urgency; flag unassigned urgent requests
5. document_bookkeeping (AUTO_RUN): Summarize any patterns in the data that may indicate missing documents or tracking gaps

Respond with this exact JSON schema:
{
  "runSummary": "2-3 sentences. Overall portfolio assessment.",
  "observationSummary": "Detailed bulleted observations across all workflows.",
  "overallConfidence": 0.0,
  "plannedActions": [
    {
      "actionId": "unique_snake_case_id",
      "riskTier": "AUTO_RUN | AUTO_DRAFT | STRICT_BLOCK",
      "workflow": "daily_briefing | collections | lease_renewal | document_bookkeeping | maintenance_triage",
      "title": "Short action title",
      "description": "What this action does and why",
      "executionPayload": {
        "type": "briefing | send_email | create_notification | flag_item | surface_data",
        // For briefing: { "content": "markdown string" }
        // For send_email: { "to": "email", "toName": "name", "subject": "...", "html": "..." }
        // For create_notification: { "title": "...", "body": "...", "relatedUrl": "..." }
        // For flag_item: { "itemType": "maintenance|lease|tenant", "itemId": "...", "reason": "..." }
        // For surface_data: { "data": "description of situation" }
      }
    }
  ],
  "verificationCriteria": "How to verify the planned actions were effective."
}

Rules:
- Always include exactly one daily_briefing action (AUTO_RUN, type: briefing)
- Only draft emails for collections/renewals if there is actual data (overdue payments / expiring leases)
- Keep email html clean and professional; address tenants by first name
- Never hallucinate tenant data — only use what is in the snapshot
- If portfolio is empty or has no active issues, say so in the briefing and return only that one action`;

export async function runPortfolioAgent(
  organizationId: string,
  triggerEvent: string,
): Promise<string> {
  const run = await prisma.agentRun.create({
    data: { organizationId, triggerEvent, status: "running" },
  });

  try {
    const portfolioState = await gatherPortfolioState(organizationId);
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            organization: org?.name ?? "Unknown",
            portfolio: portfolioState,
          }),
        },
      ],
      temperature: 0.2,
    });

    const rawText = completion.choices[0]?.message?.content ?? "{}";
    const output = JSON.parse(rawText) as AgentOutput;

    // Route and execute each planned action
    const landlordUsers = await prisma.user.findMany({
      where: { organizationId, role: { in: ["owner", "member"] } },
      select: { id: true },
    });

    let autoExecuted = 0;
    let pendingApproval = 0;

    const taskCreations = output.plannedActions.map(async (action) => {
      if (action.riskTier === "AUTO_RUN") {
        const result = await executeAutoRunAction(action, organizationId, landlordUsers);
        await prisma.agentTask.create({
          data: {
            organizationId,
            runId: run.id,
            actionId: action.actionId,
            riskTier: action.riskTier,
            workflow: action.workflow,
            title: action.title,
            description: action.description,
            status: "auto_executed",
            executionPayload: action.executionPayload as object,
            result: result as object,
            executedAt: new Date(),
          },
        });
        autoExecuted++;
      } else if (action.riskTier === "AUTO_DRAFT") {
        await prisma.agentTask.create({
          data: {
            organizationId,
            runId: run.id,
            actionId: action.actionId,
            riskTier: action.riskTier,
            workflow: action.workflow,
            title: action.title,
            description: action.description,
            status: "pending",
            executionPayload: action.executionPayload as object,
          },
        });
        pendingApproval++;
      } else {
        // STRICT_BLOCK
        await prisma.agentTask.create({
          data: {
            organizationId,
            runId: run.id,
            actionId: action.actionId,
            riskTier: action.riskTier,
            workflow: action.workflow,
            title: action.title,
            description: action.description,
            status: "blocked",
            executionPayload: action.executionPayload as object,
          },
        });
      }
    });

    await Promise.all(taskCreations);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        confidenceScore: output.overallConfidence,
        observationSummary: output.observationSummary,
        verificationCriteria: output.verificationCriteria,
        tasksGenerated: output.plannedActions.length,
        autoExecuted,
        pendingApproval,
        rawOutput: {
          runSummary: output.runSummary,
          observationSummary: output.observationSummary,
          verificationCriteria: output.verificationCriteria,
        } as object,
        completedAt: new Date(),
      },
    });

    return run.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: msg, completedAt: new Date() },
    });
    throw err;
  }
}

// ─── AUTO_RUN Execution ──────────────────────────────────────────────────────

async function executeAutoRunAction(
  action: PlannedAction,
  organizationId: string,
  landlordUsers: { id: string }[],
): Promise<Record<string, unknown>> {
  const payload = action.executionPayload;
  const type = payload.type as string;

  if (type === "briefing") {
    return { executed: true, type: "briefing" };
  }

  if (type === "create_notification") {
    const notifData = landlordUsers.map((u) => ({
      userId: u.id,
      type: "message" as const,
      title: (payload.title as string) ?? action.title,
      body: (payload.body as string) ?? action.description ?? "",
      relatedUrl: (payload.relatedUrl as string) ?? "/agent",
    }));
    await prisma.notification.createMany({ data: notifData });
    return { executed: true, type: "create_notification", count: notifData.length };
  }

  if (type === "flag_item") {
    return {
      executed: true,
      type: "flag_item",
      itemType: payload.itemType,
      itemId: payload.itemId,
      reason: payload.reason,
    };
  }

  return { executed: true, type };
}

// ─── Approve & Execute a Pending Task ───────────────────────────────────────

export async function approveAndExecuteTask(
  taskId: string,
  organizationId: string,
  approvedById: string,
): Promise<{ success: boolean; error?: string }> {
  const task = await prisma.agentTask.findFirst({
    where: { id: taskId, organizationId, status: "pending" },
  });
  if (!task) return { success: false, error: "Task not found or not pending" };

  await prisma.agentTask.update({
    where: { id: taskId },
    data: { status: "executed", approvedById, approvedAt: new Date(), executedAt: new Date() },
  });

  try {
    const payload = task.executionPayload as Record<string, unknown>;
    const type = payload?.type as string;

    if (type === "send_email") {
      const resend = getResend();
      if (!resend) throw new Error("Email not configured");
      const { error } = await resend.emails.send({
        from: FROM,
        to: payload.to as string,
        subject: payload.subject as string,
        html: payload.html as string,
      });
      if (error) throw new Error(`Resend error: ${error.message}`);
      await prisma.agentTask.update({
        where: { id: taskId },
        data: { result: { sent: true, to: payload.to } as object },
      });
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.agentTask.update({
      where: { id: taskId },
      data: { status: "failed", result: { error: msg } as object },
    });
    return { success: false, error: msg };
  }
}
