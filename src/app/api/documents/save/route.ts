import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import type { LegalSubtype } from "@/lib/document-parser";

const DOC_TYPE_TO_TX_CATEGORY: Record<string, string> = {
  utility: "utility",
  maintenance: "repair",
  tax: "tax",
  insurance: "insurance",
  legal: "other",
  notice: "other",
  other: "other",
};

const EXPENSE_FIELD_TO_COLUMN: Record<string, string> = {
  property_tax: "propertyTaxMonthly",
  water_sewer: "waterSewerMonthly",
  electricity: "electricityMonthly",
  gas: "gasMonthly",
  insurance: "insuranceMonthly",
  mortgage: "mortgageMonthly",
  hoa: "hoaMonthly",
  other_expense: "otherMonthly",
};

const PERIOD_DIVISOR: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
  unknown: 1,
};

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Returns { title, description, priority } for the auto-created task
function buildLegalTask(opts: {
  subtype: LegalSubtype;
  vendor: string;
  propLabel: string;
  amount: number | null;
  pastDueAmount: number | null;
  dueDate: string | null;
  extractionNotes: string;
}): { title: string; description: string; priority: "urgent" | "high" } {
  const { subtype, vendor, propLabel, amount, pastDueAmount, dueDate, extractionNotes } = opts;
  const deadlineStr = dueDate ? ` — deadline ${fmtDate(dueDate)}` : "";
  const amtStr = amount != null ? ` (${fmt(amount)})` : "";
  const pastStr = pastDueAmount != null ? ` Past-due: ${fmt(pastDueAmount)}.` : "";
  const notes = extractionNotes ? ` ${extractionNotes}` : "";

  switch (subtype) {
    case "court_summons":
      return {
        title: `⚠️ Court summons: ${vendor}${propLabel}${deadlineStr}`,
        description: `A court summons was received from ${vendor}${propLabel}. You must respond or appear by the deadline.${amtStr ? ` Amount claimed: ${amtStr}.` : ""}${notes} Contact your attorney immediately.`,
        priority: "urgent",
      };
    case "eviction_filing":
      return {
        title: `⚠️ Eviction filing: ${vendor}${propLabel}${deadlineStr}`,
        description: `An eviction complaint or unlawful detainer has been filed${propLabel}. Court date or response required${deadlineStr}.${notes} Consult your attorney.`,
        priority: "urgent",
      };
    case "lawsuit":
      return {
        title: `⚠️ Lawsuit: ${vendor}${propLabel}${deadlineStr}`,
        description: `A lawsuit or civil complaint has been filed against you by ${vendor}${propLabel}.${amtStr ? ` Amount claimed: ${amtStr}.` : ""}${notes} Contact your attorney immediately.`,
        priority: "urgent",
      };
    case "lien":
      return {
        title: `⚠️ Lien filed: ${vendor}${propLabel}${amtStr}`,
        description: `A lien has been filed on ${propLabel || "your property"} by ${vendor}.${amtStr ? ` Amount: ${amtStr}.` : ""}${notes} Resolve to protect the title.`,
        priority: "urgent",
      };
    case "code_violation":
      return {
        title: `Code violation: ${vendor}${propLabel}${deadlineStr}`,
        description: `A code violation notice was issued by ${vendor}${propLabel}.${deadlineStr ? ` Remedy required by ${fmtDate(dueDate!)}.` : ""}${notes}`,
        priority: "high",
      };
    case "demand_letter":
      return {
        title: `Demand letter: ${vendor}${propLabel}${amtStr}${deadlineStr}`,
        description: `A formal demand letter was received from ${vendor}${propLabel}.${amtStr ? ` Amount demanded: ${amtStr}.` : ""}${deadlineStr ? ` Respond by ${fmtDate(dueDate!)}.` : ""}${notes}`,
        priority: "high",
      };
    case "shut_off_warning":
      return {
        title: `Shut-off warning: ${vendor}${propLabel}${deadlineStr}`,
        description: `${vendor} has issued a service termination warning${propLabel}.${pastStr}${deadlineStr ? ` Pay before ${fmtDate(dueDate!)} to avoid shut-off.` : " Pay immediately to avoid service interruption."}${notes}`,
        priority: "urgent",
      };
    case "violation_notice":
      return {
        title: `Violation notice: ${vendor}${propLabel}${deadlineStr}`,
        description: `A violation notice was received from ${vendor}${propLabel}.${deadlineStr ? ` Resolve by ${fmtDate(dueDate!)}.` : ""}${notes}`,
        priority: "high",
      };
    case "past_due_notice":
    default:
      return {
        title: `Past-due notice: ${vendor}${propLabel}${pastDueAmount != null ? ` — ${fmt(pastDueAmount)}` : ""}`,
        description: `${vendor} has issued a past-due notice${propLabel}.${pastStr}${deadlineStr ? ` Pay by ${fmtDate(dueDate!)}.` : ""}${notes}`,
        priority: "high",
      };
  }
}

// Returns true for subtypes that warrant an immediate notification (bell icon)
function isUrgentSubtype(subtype: LegalSubtype): boolean {
  return ["court_summons", "eviction_filing", "lawsuit", "lien", "shut_off_warning"].includes(subtype ?? "");
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();

    const {
      fileUrl,
      fileKey,
      fileName,
      propertyId,
      documentType,
      vendor,
      amount,
      pastDueAmount,
      isPastDueNotice,
      legalSubtype,
      extractionNotes,
      issueDate,
      dueDate,
      confidenceScore,
      notes,
      expenseField,
      billingPeriod,
    } = body as {
      fileUrl: string;
      fileKey?: string | null;
      fileName: string;
      propertyId?: string | null;
      documentType: string;
      vendor?: string | null;
      amount?: number | null;
      pastDueAmount?: number | null;
      isPastDueNotice?: boolean;
      legalSubtype?: LegalSubtype;
      extractionNotes?: string;
      issueDate?: string | null;
      dueDate?: string | null;
      confidenceScore?: number | null;
      notes?: string | null;
      expenseField?: string | null;
      billingPeriod?: string | null;
    };

    if (!fileUrl || !fileName) {
      return Response.json({ error: "fileUrl and fileName are required" }, { status: 400 });
    }

    // Resolve property name for task/notification copy
    let propertyName: string | null = null;
    if (propertyId) {
      const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { name: true } });
      propertyName = prop?.name ?? null;
    }

    const doc = await prisma.propertyDocument.create({
      data: {
        organizationId,
        propertyId: propertyId || null,
        documentType: documentType || "other",
        vendor: vendor || null,
        amount: amount != null ? amount : null,
        issueDate: issueDate ? new Date(issueDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        fileUrl,
        fileKey: fileKey || null,
        fileName,
        confidenceScore: confidenceScore ?? null,
        aiEstimated: true,
        notes: notes || null,
      },
      include: { property: { select: { id: true, name: true } } },
    });

    const isNoticeOrLegal =
      documentType === "notice" ||
      documentType === "legal" ||
      isPastDueNotice ||
      legalSubtype != null;

    // Log expense transaction for regular (non-notice) bills
    if (!isNoticeOrLegal && amount != null && amount > 0 && propertyId) {
      const txCategory = DOC_TYPE_TO_TX_CATEGORY[documentType] ?? "other";
      await prisma.transaction.create({
        data: {
          organizationId,
          propertyId,
          type: "expense",
          category: txCategory,
          amount,
          date: issueDate ? new Date(issueDate) : new Date(),
          description: [vendor, fileName].filter(Boolean).join(" — ") || undefined,
          createdById: userId,
        },
      });
    }

    // Update PropertyExpenses monthly estimate
    const column = expenseField ? EXPENSE_FIELD_TO_COLUMN[expenseField] : null;
    if (!isNoticeOrLegal && column && propertyId && amount != null && amount > 0) {
      const divisor = PERIOD_DIVISOR[billingPeriod ?? "unknown"] ?? 1;
      const monthlyAmount = Math.round((amount / divisor) * 100) / 100;
      await prisma.propertyExpenses.upsert({
        where: { propertyId },
        update: { [column]: monthlyAmount, aiEstimatedAt: new Date() },
        create: { propertyId, [column]: monthlyAmount, aiEstimatedAt: new Date() },
      });
    }

    // Create Task + optional Notification for notices and legal documents
    let taskCreated = false;
    const vendorLabel = vendor ?? fileName;
    const propLabel = propertyName ? ` — ${propertyName}` : "";

    if (isNoticeOrLegal) {
      const dueDateForTask = dueDate ? new Date(dueDate) : null;

      let taskData: { title: string; description: string; priority: "urgent" | "high" };

      if (legalSubtype && legalSubtype !== "other_notice") {
        taskData = buildLegalTask({
          subtype: legalSubtype,
          vendor: vendorLabel,
          propLabel,
          amount: amount ?? null,
          pastDueAmount: pastDueAmount ?? null,
          dueDate: dueDate ?? null,
          extractionNotes: extractionNotes ?? "",
        });
      } else {
        // Generic notice / past-due
        const deadlineStr = dueDate ? ` by ${fmtDate(dueDate)}` : "";
        const pastStr = pastDueAmount != null ? ` Past-due: ${fmt(pastDueAmount)}.` : "";
        taskData = {
          title: pastDueAmount != null
            ? `Past-due balance: ${vendorLabel}${propLabel} — ${fmt(pastDueAmount)}`
            : `Notice received: ${vendorLabel}${propLabel}`,
          description:
            `${vendorLabel} notice received${propLabel}.${pastStr}` +
            (amount != null ? ` Amount on notice: ${fmt(amount)}.` : "") +
            (dueDate ? ` Pay or respond${deadlineStr}.` : " Review and take action.") +
            (extractionNotes ? ` ${extractionNotes}` : ""),
          priority: "high",
        };
      }

      await prisma.task.create({
        data: {
          organizationId,
          title: taskData.title,
          description: taskData.description,
          propertyId: propertyId || null,
          dueDate: dueDateForTask,
          priority: taskData.priority,
          status: "open",
          createdById: userId,
          createdByAI: true,
        },
      });
      taskCreated = true;

      // Fire notification for urgent legal documents (court, eviction, lawsuit, lien, shut-off)
      if (isUrgentSubtype(legalSubtype ?? null)) {
        await createNotification({
          userId,
          type: "document_alert",
          title: taskData.title.replace(/^⚠️ /, ""),
          body: taskData.description.slice(0, 200),
          relatedUrl: "/tasks",
        });
      }
    }

    return Response.json(
      {
        ...doc,
        amount: doc.amount !== null ? Number(doc.amount) : null,
        issueDate: doc.issueDate?.toISOString() ?? null,
        dueDate: doc.dueDate?.toISOString() ?? null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        taskCreated,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Document save error:", err);
    return Response.json({ error: "Failed to save document" }, { status: 500 });
  }
}
