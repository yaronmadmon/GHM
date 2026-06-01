import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

const DOC_TYPE_TO_TX_CATEGORY: Record<string, string> = {
  utility: "utility",
  maintenance: "repair",
  tax: "tax",
  insurance: "insurance",
  legal: "other",
  notice: "other",
  other: "other",
};

// Maps AI expense_field → PropertyExpenses column name
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

function formatCurrency(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    // Resolve property name for task titles
    let propertyName: string | null = null;
    if (propertyId) {
      const prop = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { name: true },
      });
      propertyName = prop?.name ?? null;
    }

    // Create the document record
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

    // Log a Transaction expense for regular (non-notice) bills with an amount
    const isNotice = documentType === "notice" || isPastDueNotice;
    if (!isNotice && amount != null && amount > 0 && propertyId) {
      const txCategory = DOC_TYPE_TO_TX_CATEGORY[documentType] ?? "other";
      const txDate = issueDate ? new Date(issueDate) : new Date();
      const txDescription = [vendor, fileName].filter(Boolean).join(" — ");

      await prisma.transaction.create({
        data: {
          organizationId,
          propertyId,
          type: "expense",
          category: txCategory,
          amount,
          date: txDate,
          description: txDescription || undefined,
          createdById: userId,
        },
      });
    }

    // Update PropertyExpenses monthly estimate (only for regular recurring bills)
    const column = expenseField ? EXPENSE_FIELD_TO_COLUMN[expenseField] : null;
    if (!isNotice && column && propertyId && amount != null && amount > 0) {
      const divisor = PERIOD_DIVISOR[billingPeriod ?? "unknown"] ?? 1;
      const monthlyAmount = Math.round((amount / divisor) * 100) / 100;

      await prisma.propertyExpenses.upsert({
        where: { propertyId },
        update: { [column]: monthlyAmount, aiEstimatedAt: new Date() },
        create: { propertyId, [column]: monthlyAmount, aiEstimatedAt: new Date() },
      });
    }

    // Create a Task for notices or bills with a past-due balance
    const shouldCreateTask = isNotice || (pastDueAmount != null && pastDueAmount > 0);
    if (shouldCreateTask) {
      const vendorLabel = vendor ?? fileName;
      const propLabel = propertyName ? ` — ${propertyName}` : "";
      const dueDateForTask = dueDate ? new Date(dueDate) : null;

      let title: string;
      let description: string;

      if (isNotice) {
        const amountLabel = amount != null ? ` (${formatCurrency(amount)})` : "";
        title = `Notice received: ${vendorLabel}${propLabel}${amountLabel}`;
        description =
          `A notice was received from ${vendorLabel}${propLabel}. ` +
          (amount != null ? `Amount on notice: ${formatCurrency(amount)}. ` : "") +
          (pastDueAmount != null ? `Past-due balance: ${formatCurrency(pastDueAmount)}. ` : "") +
          (dueDate ? `Due by: ${new Date(dueDate).toLocaleDateString()}.` : "Review and take action.");
      } else {
        title = `Past-due balance: ${vendorLabel}${propLabel} — ${formatCurrency(pastDueAmount!)}`;
        description =
          `${vendorLabel} bill${propLabel} shows a past-due balance of ${formatCurrency(pastDueAmount!)}. ` +
          (amount != null ? `Current period charges: ${formatCurrency(amount)}. ` : "") +
          "Resolve the outstanding balance to avoid service interruption.";
      }

      await prisma.task.create({
        data: {
          organizationId,
          title,
          description,
          propertyId: propertyId || null,
          dueDate: dueDateForTask,
          priority: isNotice ? "urgent" : "high",
          status: "open",
          createdById: userId,
          createdByAI: true,
        },
      });
    }

    return Response.json(
      {
        ...doc,
        amount: doc.amount !== null ? Number(doc.amount) : null,
        issueDate: doc.issueDate?.toISOString() ?? null,
        dueDate: doc.dueDate?.toISOString() ?? null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        taskCreated: shouldCreateTask,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Document save error:", err);
    return Response.json({ error: "Failed to save document" }, { status: 500 });
  }
}
