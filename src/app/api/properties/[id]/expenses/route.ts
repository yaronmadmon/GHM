import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    // Verify property belongs to this org
    const property = await prisma.property.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!property) return Response.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const fields = [
      "propertyTaxMonthly", "waterSewerMonthly", "electricityMonthly",
      "gasMonthly", "insuranceMonthly", "mortgageMonthly", "hoaMonthly", "otherMonthly",
    ] as const;

    const data: Record<string, number | null | Date> = { lastEditedAt: new Date() };
    for (const f of fields) {
      if (f in body) {
        data[f] = body[f] === "" || body[f] === null ? null : Number(body[f]);
      }
    }

    const record = await prisma.propertyExpenses.upsert({
      where: { propertyId: id },
      create: { propertyId: id, ...data },
      update: data,
    });

    return Response.json({
      ...record,
      propertyTaxMonthly: record.propertyTaxMonthly !== null ? Number(record.propertyTaxMonthly) : null,
      waterSewerMonthly: record.waterSewerMonthly !== null ? Number(record.waterSewerMonthly) : null,
      electricityMonthly: record.electricityMonthly !== null ? Number(record.electricityMonthly) : null,
      gasMonthly: record.gasMonthly !== null ? Number(record.gasMonthly) : null,
      insuranceMonthly: record.insuranceMonthly !== null ? Number(record.insuranceMonthly) : null,
      mortgageMonthly: record.mortgageMonthly !== null ? Number(record.mortgageMonthly) : null,
      hoaMonthly: record.hoaMonthly !== null ? Number(record.hoaMonthly) : null,
      otherMonthly: record.otherMonthly !== null ? Number(record.otherMonthly) : null,
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
