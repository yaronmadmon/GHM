import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { formatCurrency } from "@/lib/utils";

type ToolInput = Record<string, unknown>;

export async function handleTool(
  name: string,
  input: ToolInput,
  organizationId: string,
  userId: string,
): Promise<string> {
  switch (name) {

    // ── READ: properties ────────────────────────────────────────────────────
    case "get_properties": {
      const props = await prisma.property.findMany({
        where: {
          organizationId,
          archivedAt: null,
          ...(input.status ? { status: input.status as string } : {}),
          ...(input.search ? { OR: [{ name: { contains: input.search as string, mode: "insensitive" } }, { addressLine1: { contains: input.search as string, mode: "insensitive" } }] } : {}),
        },
        include: { units: { select: { id: true, unitNumber: true, status: true } }, _count: { select: { units: true } } },
      });
      if (!props.length) return "No properties found.";
      return props.map((p) =>
        `• [${p.id}] ${p.name} (${p.addressLine1}, ${p.city}) — Status: ${p.status}, Units: ${p._count.units}\n  Units: ${p.units.map((u) => `[${u.id}] ${u.unitNumber} (${u.status})`).join(", ") || "none"}`
      ).join("\n");
    }

    // ── READ: tenants ────────────────────────────────────────────────────────
    case "get_tenants": {
      const tenants = await prisma.tenant.findMany({
        where: {
          organizationId,
          ...(input.search ? {
            OR: [
              { firstName: { contains: input.search as string, mode: "insensitive" } },
              { lastName: { contains: input.search as string, mode: "insensitive" } },
              { email: { contains: input.search as string, mode: "insensitive" } },
            ],
          } : {}),
        },
        include: {
          leaseLinks: {
            where: { lease: { status: "active" } },
            include: { lease: { include: { unit: { include: { property: true } } } } },
          },
        },
        take: 20,
      });
      if (!tenants.length) return "No tenants found.";
      return tenants.map((t) => {
        const lease = t.leaseLinks[0]?.lease;
        const location = lease ? `${lease.unit.property.name} unit ${lease.unit.unitNumber}` : "No active lease";
        return `• [${t.id}] ${t.firstName} ${t.lastName} (${t.email ?? "no email"}) — ${location}`;
      }).join("\n");
    }

    // ── READ: tenant balance ─────────────────────────────────────────────────
    case "get_tenant_balance": {
      const name = input.tenantName as string;
      const [firstName, ...lastParts] = name.split(" ");
      const lastName = lastParts.join(" ");
      const tenant = await prisma.tenant.findFirst({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: name, mode: "insensitive" } },
            { lastName: { contains: name, mode: "insensitive" } },
            { AND: [{ firstName: { contains: firstName, mode: "insensitive" } }, { lastName: { contains: lastName, mode: "insensitive" } }] },
          ],
        },
        include: {
          leaseLinks: {
            include: { lease: { include: { rentPayments: { orderBy: { dueDate: "desc" }, take: 6 } } } },
          },
        },
      });
      if (!tenant) return `No tenant found matching "${name}".`;
      const lease = tenant.leaseLinks[0]?.lease;
      if (!lease) return `${tenant.firstName} ${tenant.lastName} has no active lease.`;
      const payments = lease.rentPayments;
      const overdue = payments.filter((p) => p.status === "overdue");
      const totalOverdue = overdue.reduce((s, p) => s + (Number(p.amountDue) - Number(p.amountPaid)), 0);
      return [
        `**${tenant.firstName} ${tenant.lastName}**`,
        `Monthly rent: ${formatCurrency(Number(lease.rentAmount))}`,
        `Total overdue balance: ${formatCurrency(totalOverdue)}`,
        `Recent payments:`,
        ...payments.map((p) => `  ${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}: ${p.status} (paid ${formatCurrency(Number(p.amountPaid))} of ${formatCurrency(Number(p.amountDue))})`),
      ].join("\n");
    }

    // ── READ: overdue payments ───────────────────────────────────────────────
    case "get_overdue_payments": {
      const payments = await prisma.rentPayment.findMany({
        where: { organizationId, status: "overdue" },
        include: { lease: { include: { tenants: { include: { tenant: true } }, unit: { include: { property: true } } } } },
        orderBy: { amountDue: "desc" },
      });
      if (!payments.length) return "No overdue payments. All tenants are current!";
      return payments.map((p) => {
        const tenant = p.lease.tenants[0]?.tenant;
        const owed = Number(p.amountDue) - Number(p.amountPaid);
        return `• ${tenant?.firstName} ${tenant?.lastName} — ${p.lease.unit.property.name} unit ${p.lease.unit.unitNumber} — Owes ${formatCurrency(owed)} (${p.periodYear}-${String(p.periodMonth).padStart(2, "0")})`;
      }).join("\n");
    }

    // ── READ: expiring leases ────────────────────────────────────────────────
    case "get_expiring_leases": {
      const days = (input.days as number) ?? 60;
      const leases = await prisma.lease.findMany({
        where: { organizationId, status: "active", endDate: { gte: new Date(), lte: addDays(new Date(), days) } },
        include: { tenants: { include: { tenant: true } }, unit: { include: { property: true } } },
        orderBy: { endDate: "asc" },
      });
      if (!leases.length) return `No leases expiring in the next ${days} days.`;
      return leases.map((l) => {
        const tenant = l.tenants[0]?.tenant;
        const daysLeft = Math.ceil((new Date(l.endDate!).getTime() - Date.now()) / 86400000);
        return `• [${l.id}] ${tenant?.firstName} ${tenant?.lastName} — ${l.unit.property.name} unit ${l.unit.unitNumber} — Expires in ${daysLeft} days`;
      }).join("\n");
    }

    // ── READ: maintenance ────────────────────────────────────────────────────
    case "get_open_maintenance": {
      const requests = await prisma.maintenanceRequest.findMany({
        where: {
          organizationId,
          status: { in: (input.status ? [input.status as string] : ["open", "in_progress", "pending_parts"]) },
          ...(input.priority ? { priority: input.priority as string } : {}),
        },
        include: { property: true, unit: true, assignedVendor: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 20,
      });
      if (!requests.length) return "No open maintenance requests.";
      return requests.map((r) =>
        `• [${r.id}] [${r.priority.toUpperCase()}] ${r.title} — ${r.property.name}${r.unit ? ` unit ${r.unit.unitNumber}` : ""} (${r.status})${r.assignedVendor ? ` — Vendor: ${r.assignedVendor.name}` : ""}`
      ).join("\n");
    }

    // ── READ: financial summary ───────────────────────────────────────────────
    case "get_financial_summary": {
      const now = new Date();
      const year = (input.year as number) ?? now.getFullYear();
      const month = (input.month as number) ?? now.getMonth() + 1;
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const transactions = await prisma.transaction.groupBy({
        by: ["type"],
        where: { organizationId, date: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      const income = transactions.find((t) => t.type === "income")?._sum.amount ?? 0;
      const expenses = transactions.find((t) => t.type === "expense")?._sum.amount ?? 0;
      const net = Number(income) - Number(expenses);
      return `**${year}-${String(month).padStart(2, "0")} Financial Summary**\nIncome: ${formatCurrency(Number(income))}\nExpenses: ${formatCurrency(Number(expenses))}\nNet: ${formatCurrency(net)}`;
    }

    // ── READ: lease details ───────────────────────────────────────────────────
    case "get_lease_details": {
      const leaseInclude = { tenants: { include: { tenant: true } }, unit: { include: { property: true } }, documents: true } as const;
      type LeaseWithDetails = Awaited<ReturnType<typeof prisma.lease.findFirst<{ include: typeof leaseInclude }>>>;
      let lease: LeaseWithDetails = null;

      if (input.leaseId) {
        lease = await prisma.lease.findFirst({ where: { id: input.leaseId as string, organizationId }, include: leaseInclude });
      } else if (input.tenantName) {
        const name = input.tenantName as string;
        const tenant = await prisma.tenant.findFirst({
          where: { organizationId, OR: [{ firstName: { contains: name, mode: "insensitive" } }, { lastName: { contains: name, mode: "insensitive" } }] },
          include: { leaseLinks: { include: { lease: { include: leaseInclude } } } },
        });
        lease = tenant?.leaseLinks[0]?.lease ?? null;
      }

      if (!lease) return "Lease not found.";
      return [
        `**Lease [${lease.id}]**`,
        `Property: ${lease.unit.property.name} — Unit ${lease.unit.unitNumber}`,
        `Tenants: ${lease.tenants.map((lt) => `${lt.tenant.firstName} ${lt.tenant.lastName}`).join(", ")}`,
        `Rent: ${formatCurrency(Number(lease.rentAmount))}/month  Deposit: ${formatCurrency(Number(lease.depositAmount ?? 0))}`,
        `Dates: ${new Date(lease.startDate).toDateString()} → ${lease.endDate ? new Date(lease.endDate).toDateString() : "month-to-month"}`,
        `Status: ${lease.status}  Signing: ${lease.signingStatus}`,
        `Documents: ${lease.documents.length}`,
      ].join("\n");
    }

    // ── READ: vendors ─────────────────────────────────────────────────────────
    case "get_vendors": {
      const vendors = await prisma.vendor.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
      if (!vendors.length) return "No vendors on file. Use create_vendor to add one.";
      return vendors.map((v) =>
        `• [${v.id}] ${v.name}${v.trade ? ` (${v.trade})` : ""}${v.phone ? ` — ${v.phone}` : ""}${v.email ? ` — ${v.email}` : ""}`
      ).join("\n");
    }

    // ── READ: messages ────────────────────────────────────────────────────────
    case "get_messages": {
      const threads = await prisma.messageThread.findMany({
        where: { organizationId },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { lastMessageAt: "desc" },
        take: 10,
      });
      if (!threads.length) return "No message threads found.";
      return threads.map((t) => {
        const last = t.messages[0];
        return `• [${t.id}] "${t.subject}" — last message: ${last?.body?.slice(0, 60) ?? "none"} (${last?.senderRole ?? "?"})`;
      }).join("\n");
    }

    // ── READ: applications ────────────────────────────────────────────────────
    case "list_applications": {
      const apps = await prisma.application.findMany({
        where: { organizationId, ...(input.status ? { status: input.status as string } : {}) },
        include: { property: { select: { name: true } }, unit: { select: { unitNumber: true } }, _count: { select: { documents: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      if (!apps.length) return "No applications found.";
      return apps.map((a) => {
        const loc = a.property?.name ? `${a.property.name}${a.unit ? ` unit ${a.unit.unitNumber}` : ""}` : "unknown property";
        return `• [${a.id}] ${a.firstName} ${a.lastName} — ${loc} — Status: ${a.status} — Docs: ${a._count.documents}`;
      }).join("\n");
    }

    case "get_application": {
      const includeOpts = { property: { select: { name: true } }, unit: { select: { unitNumber: true } }, documents: true, references: true } as const;
      const app = input.applicationId
        ? await prisma.application.findFirst({ where: { id: input.applicationId as string, organizationId }, include: includeOpts })
        : input.applicantName
          ? await (async () => {
              const name = input.applicantName as string;
              const [firstName, ...lastParts] = name.split(" ");
              return prisma.application.findFirst({
                where: { organizationId, OR: [{ firstName: { contains: firstName, mode: "insensitive" } }, { lastName: { contains: lastParts.join(" "), mode: "insensitive" } }] },
                include: includeOpts, orderBy: { createdAt: "desc" },
              });
            })()
          : null;
      if (!app) return "Application not found.";
      return [
        `**Application: ${app.firstName} ${app.lastName}** (ID: ${app.id})`,
        `Status: ${app.status}`,
        `Property: ${app.property?.name ?? "N/A"}${app.unit ? ` unit ${app.unit.unitNumber}` : ""}`,
        `Email: ${app.email ?? "missing"} | Phone: ${app.phone ?? "missing"}`,
        `Employer: ${app.employerName ?? "N/A"} | Income: ${app.monthlyIncome ? formatCurrency(Number(app.monthlyIncome)) + "/mo" : "N/A"}`,
        `Screening: ${app.backgroundCheckStatus ?? "not_started"}`,
        `Documents: ${app.documents.length} | References: ${app.references.length}`,
        `Submitted: ${app.createdAt.toDateString()}`,
      ].join("\n");
    }

    // ── WRITE: create tenant ──────────────────────────────────────────────────
    case "create_tenant": {
      const tenant = await prisma.tenant.create({
        data: {
          organizationId,
          firstName: input.firstName as string,
          lastName: input.lastName as string,
          email: (input.email as string) || undefined,
          phone: (input.phone as string) || undefined,
          notes: (input.notes as string) || undefined,
        },
      });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "tenant", entityId: tenant.id, eventType: "created", metadata: { name: `${tenant.firstName} ${tenant.lastName}`, actor: "ai_assistant" } },
      });
      return `Tenant created: **${tenant.firstName} ${tenant.lastName}** (ID: ${tenant.id})`;
    }

    // ── WRITE: update tenant ──────────────────────────────────────────────────
    case "update_tenant": {
      const tenantId = input.tenantId as string;
      const existing = await prisma.tenant.findFirst({ where: { id: tenantId, organizationId } });
      if (!existing) return `Tenant not found: ${tenantId}`;
      const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(input.firstName ? { firstName: input.firstName as string } : {}),
          ...(input.lastName ? { lastName: input.lastName as string } : {}),
          ...(input.email !== undefined ? { email: (input.email as string) || null } : {}),
          ...(input.phone !== undefined ? { phone: (input.phone as string) || null } : {}),
          ...(input.notes !== undefined ? { notes: (input.notes as string) || null } : {}),
        },
      });
      return `Tenant updated: **${updated.firstName} ${updated.lastName}**`;
    }

    // ── WRITE: create property ────────────────────────────────────────────────
    case "create_property": {
      const unitCount = Math.max(1, (input.unitCount as number) ?? 1);
      const property = await prisma.property.create({
        data: {
          organizationId,
          name: input.name as string,
          addressLine1: input.addressLine1 as string,
          city: input.city as string,
          state: input.state as string,
          zip: input.zip as string,
          propertyType: (input.propertyType as string) ?? "single_family",
          unitCount,
          status: "vacant",
        },
      });
      // Create initial units
      const unitNumbers = unitCount === 1 ? ["1"] : Array.from({ length: unitCount }, (_, i) => String(i + 1));
      await prisma.unit.createMany({
        data: unitNumbers.map((n) => ({ propertyId: property.id, unitNumber: n, status: "vacant" })),
      });
      const units = await prisma.unit.findMany({ where: { propertyId: property.id } });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "property", entityId: property.id, eventType: "created", metadata: { name: property.name, actor: "ai_assistant" } },
      });
      return `Property created: **${property.name}** (ID: ${property.id})\nUnits created: ${units.map((u) => `[${u.id}] Unit ${u.unitNumber}`).join(", ")}`;
    }

    // ── WRITE: add unit ───────────────────────────────────────────────────────
    case "add_unit": {
      const property = await prisma.property.findFirst({ where: { id: input.propertyId as string, organizationId } });
      if (!property) return `Property not found: ${input.propertyId}`;
      const unit = await prisma.unit.create({
        data: {
          propertyId: input.propertyId as string,
          unitNumber: input.unitNumber as string,
          bedrooms: (input.bedrooms as number) ?? undefined,
          bathrooms: (input.bathrooms as number) ?? undefined,
          sqft: (input.sqft as number) ?? undefined,
          status: "vacant",
        },
      });
      return `Unit added to ${property.name}: **Unit ${unit.unitNumber}** (ID: ${unit.id})`;
    }

    // ── WRITE: create lease ───────────────────────────────────────────────────
    case "create_lease": {
      const unit = await prisma.unit.findFirst({ where: { id: input.unitId as string, property: { organizationId } } });
      if (!unit) return `Unit not found: ${input.unitId}`;
      const tenant = await prisma.tenant.findFirst({ where: { id: input.tenantId as string, organizationId } });
      if (!tenant) return `Tenant not found: ${input.tenantId}`;

      const lease = await prisma.lease.create({
        data: {
          organizationId,
          unitId: input.unitId as string,
          startDate: new Date(input.startDate as string),
          endDate: input.endDate ? new Date(input.endDate as string) : undefined,
          rentAmount: input.rentAmount as number,
          depositAmount: (input.depositAmount as number) ?? undefined,
          paymentDueDay: (input.paymentDueDay as number) ?? 1,
          status: "active",
          tenants: { create: [{ tenantId: input.tenantId as string, isPrimary: true }] },
        },
        include: { unit: { include: { property: true } } },
      });
      await prisma.unit.update({ where: { id: input.unitId as string }, data: { status: "occupied" } });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "lease", entityId: lease.id, eventType: "created", metadata: { tenant: `${tenant.firstName} ${tenant.lastName}`, unit: unit.unitNumber, actor: "ai_assistant" } },
      });
      return `Lease created for **${tenant.firstName} ${tenant.lastName}** at ${lease.unit.property.name} Unit ${unit.unitNumber} (Lease ID: ${lease.id})\nRent: ${formatCurrency(Number(lease.rentAmount))}/month starting ${new Date(lease.startDate).toDateString()}`;
    }

    // ── WRITE: create maintenance ─────────────────────────────────────────────
    case "create_maintenance_request": {
      const property = await prisma.property.findFirst({ where: { id: input.propertyId as string, organizationId } });
      if (!property) return `Property not found: ${input.propertyId}`;
      const request = await prisma.maintenanceRequest.create({
        data: {
          organizationId,
          propertyId: input.propertyId as string,
          title: input.title as string,
          description: input.description as string,
          priority: (input.priority as string) ?? "medium",
          category: (input.category as string) || undefined,
          assignedVendorId: (input.assignedVendorId as string) || undefined,
          status: "open",
        },
      });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "maintenance", entityId: request.id, eventType: "created", metadata: { title: request.title, property: property.name, actor: "ai_assistant" } },
      });
      return `Maintenance request created: **${request.title}** at ${property.name} (ID: ${request.id})\nPriority: ${request.priority} | Status: open`;
    }

    // ── WRITE: update maintenance ─────────────────────────────────────────────
    case "update_maintenance_request": {
      const requestId = input.requestId as string;
      const existing = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, organizationId }, include: { property: true } });
      if (!existing) return `Maintenance request not found: ${requestId}`;
      const updated = await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          ...(input.status ? { status: input.status as string, ...(input.status === "completed" ? { resolvedAt: new Date() } : {}) } : {}),
          ...(input.priority ? { priority: input.priority as string } : {}),
          ...(input.assignedVendorId !== undefined ? { assignedVendorId: (input.assignedVendorId as string) || null } : {}),
        },
      });
      return `Maintenance request updated: **${existing.title}** at ${existing.property.name}\nStatus: ${updated.status} | Priority: ${updated.priority}`;
    }

    // ── WRITE: record payment (confirmation required) ─────────────────────────
    case "record_payment": {
      return JSON.stringify({
        __pendingAction: true,
        type: "record_payment",
        payload: input,
        message: `Ready to record payment of ${formatCurrency(input.amount as number)} from ${input.tenantName}. Please confirm.`,
      });
    }

    // ── WRITE: send message ───────────────────────────────────────────────────
    case "send_message": {
      const tenant = await prisma.tenant.findFirst({ where: { id: input.tenantId as string, organizationId } });
      if (!tenant) return `Tenant not found: ${input.tenantId}`;

      const tenantUserId = tenant.portalUserId ?? tenant.id;
      const subject = (input.subject as string) || `Message from your landlord`;
      const body = input.body as string;

      // Find existing thread with this tenant
      const existingThread = await prisma.messageThread.findFirst({
        where: { organizationId, landlordUserId: userId, tenantUserId },
      });

      if (existingThread) {
        await prisma.$transaction([
          prisma.message.create({
            data: { organizationId, threadId: existingThread.id, senderId: userId, senderRole: "landlord", recipientId: tenantUserId, body },
          }),
          prisma.messageThread.update({ where: { id: existingThread.id }, data: { lastMessageAt: new Date() } }),
        ]);
        return `Message sent to **${tenant.firstName} ${tenant.lastName}** in existing thread "${existingThread.subject}"`;
      } else {
        const thread = await prisma.$transaction(async (tx) => {
          const t = await tx.messageThread.create({
            data: { organizationId, subject, landlordUserId: userId, tenantUserId, lastMessageAt: new Date() },
          });
          await tx.message.create({
            data: { organizationId, threadId: t.id, senderId: userId, senderRole: "landlord", recipientId: tenantUserId, body },
          });
          return t;
        });
        return `New message thread created with **${tenant.firstName} ${tenant.lastName}**: "${subject}"`;
      }
    }

    // ── WRITE: create transaction ─────────────────────────────────────────────
    case "create_transaction": {
      const date = input.date ? new Date(input.date as string) : new Date();
      const transaction = await prisma.transaction.create({
        data: {
          organizationId,
          type: input.type as string,
          category: input.category as string,
          amount: input.amount as number,
          date,
          description: (input.description as string) || undefined,
          propertyId: (input.propertyId as string) || undefined,
          createdById: userId,
        },
      });
      return `Transaction recorded: ${input.type === "income" ? "+" : "-"}${formatCurrency(Number(transaction.amount))} (${transaction.category}) on ${date.toDateString()}`;
    }

    // ── WRITE: create vendor ──────────────────────────────────────────────────
    case "create_vendor": {
      const vendor = await prisma.vendor.create({
        data: {
          organizationId,
          name: input.name as string,
          trade: (input.trade as string) || undefined,
          phone: (input.phone as string) || undefined,
          email: (input.email as string) || undefined,
          notes: (input.notes as string) || undefined,
        },
      });
      return `Vendor added: **${vendor.name}**${vendor.trade ? ` (${vendor.trade})` : ""} (ID: ${vendor.id})`;
    }

    // ── WRITE: application workflow ───────────────────────────────────────────
    case "advance_application_status": {
      const appId = input.applicationId as string;
      const newStatus = input.status as string;
      const app = await prisma.application.findFirst({ where: { id: appId, organizationId } });
      if (!app) return "Application not found.";
      await prisma.application.update({ where: { id: appId }, data: { status: newStatus } });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "application", entityId: appId, eventType: "status_changed", metadata: { from: app.status, to: newStatus, actor: "ai_assistant" } },
      });
      return `Application status updated from "${app.status}" to "${newStatus}".`;
    }

    case "set_screening_status": {
      const appId = input.applicationId as string;
      const app = await prisma.application.findFirst({ where: { id: appId, organizationId } });
      if (!app) return "Application not found.";
      await prisma.application.update({
        where: { id: appId },
        data: {
          backgroundCheckStatus: input.backgroundCheckStatus as string,
          backgroundCheckNotes: (input.backgroundCheckNotes as string) ?? undefined,
          backgroundCheckDate: input.backgroundCheckDate ? new Date(input.backgroundCheckDate as string) : undefined,
        },
      });
      return `Screening status set to "${input.backgroundCheckStatus}" for ${app.firstName} ${app.lastName}.`;
    }

    case "add_application_document": {
      const appId = input.applicationId as string;
      const app = await prisma.application.findFirst({ where: { id: appId, organizationId } });
      if (!app) return "Application not found.";
      await prisma.applicationDocument.create({
        data: { applicationId: appId, name: input.name as string, url: input.url as string, docType: input.docType as string },
      });
      return `Document "${input.name}" (${input.docType}) added to ${app.firstName} ${app.lastName}'s application.`;
    }

    case "confirm_move_in": {
      const leaseId = input.leaseId as string;
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, organizationId },
        include: { tenants: { include: { tenant: true } } },
      });
      if (!lease) return "Lease not found.";
      if (lease.signingStatus !== "fully_signed") return `Cannot confirm move-in: lease signing status is "${lease.signingStatus}" (must be fully_signed).`;
      if (lease.moveInCompleted) return "Move-in already confirmed for this lease.";
      await prisma.lease.update({ where: { id: leaseId }, data: { moveInCompleted: true, moveInCompletedAt: new Date() } });
      const tenant = lease.tenants[0]?.tenant;
      return `Move-in confirmed for ${tenant ? `**${tenant.firstName} ${tenant.lastName}**` : "lease"}.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
