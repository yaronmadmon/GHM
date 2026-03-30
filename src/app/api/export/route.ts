import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "excel";
    const entitiesParam = searchParams.get("entities") ?? "properties,tenants,leases,payments,transactions";
    const entities = entitiesParam.split(",");

    const wb = XLSX.utils.book_new();
    const csvFiles: Record<string, string> = {};

    if (entities.includes("properties")) {
      const rows = await prisma.property.findMany({
        where: { organizationId, archivedAt: null },
        include: { units: { select: { id: true } } },
      });
      const data = rows.map((r) => ({
        Name: r.name,
        Address: r.addressLine1,
        City: r.city,
        State: r.state,
        ZIP: r.zip,
        Type: r.propertyType,
        Status: r.status,
        Units: r.units?.length ?? 0,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      if (format === "excel") XLSX.utils.book_append_sheet(wb, ws, "Properties");
      else csvFiles["properties.csv"] = XLSX.utils.sheet_to_csv(ws);
    }

    if (entities.includes("tenants")) {
      const rows = await prisma.tenant.findMany({
        where: { organizationId },
        select: { firstName: true, lastName: true, email: true, phone: true, dateOfBirth: true, notes: true },
      });
      const data = rows.map((r) => ({
        "First Name": r.firstName,
        "Last Name": r.lastName,
        Email: r.email ?? "",
        Phone: r.phone ?? "",
        "Date of Birth": r.dateOfBirth ? r.dateOfBirth.toISOString().split("T")[0] : "",
        Notes: r.notes ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      if (format === "excel") XLSX.utils.book_append_sheet(wb, ws, "Tenants");
      else csvFiles["tenants.csv"] = XLSX.utils.sheet_to_csv(ws);
    }

    if (entities.includes("leases")) {
      const rows = await prisma.lease.findMany({
        where: { organizationId },
        include: { unit: { include: { property: true } } },
      });
      const data = rows.map((r) => ({
        Property: r.unit.property.name,
        Unit: r.unit.unitNumber,
        "Start Date": r.startDate.toISOString().split("T")[0],
        "End Date": r.endDate ? r.endDate.toISOString().split("T")[0] : "",
        "Rent Amount": Number(r.rentAmount),
        "Deposit Amount": Number(r.depositAmount),
        Status: r.status,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      if (format === "excel") XLSX.utils.book_append_sheet(wb, ws, "Leases");
      else csvFiles["leases.csv"] = XLSX.utils.sheet_to_csv(ws);
    }

    if (entities.includes("payments")) {
      const rows = await prisma.rentPayment.findMany({
        where: { organizationId },
        include: { lease: { include: { unit: { include: { property: true } } } } },
        orderBy: { dueDate: "desc" },
      });
      const data = rows.map((r) => ({
        Property: r.lease.unit.property.name,
        Unit: r.lease.unit.unitNumber,
        Year: r.periodYear,
        Month: r.periodMonth,
        "Amount Due": Number(r.amountDue),
        "Amount Paid": Number(r.amountPaid),
        Status: r.status,
        "Payment Method": r.paymentMethod ?? "",
        "Due Date": r.dueDate.toISOString().split("T")[0],
        "Paid Date": r.paidAt ? r.paidAt.toISOString().split("T")[0] : "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      if (format === "excel") XLSX.utils.book_append_sheet(wb, ws, "Payments");
      else csvFiles["payments.csv"] = XLSX.utils.sheet_to_csv(ws);
    }

    if (entities.includes("transactions")) {
      const rows = await prisma.transaction.findMany({
        where: { organizationId },
        include: { property: true },
        orderBy: { date: "desc" },
      });
      const data = rows.map((r) => ({
        Date: r.date.toISOString().split("T")[0],
        Type: r.type,
        Category: r.category,
        Amount: Number(r.amount),
        Description: r.description ?? "",
        Property: r.property?.name ?? "",
        "Payment Method": r.paymentMethod ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      if (format === "excel") XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      else csvFiles["transactions.csv"] = XLSX.utils.sheet_to_csv(ws);
    }

    if (format === "excel") {
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new Response(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="ghm-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
        },
      });
    }

    // CSV: return zip-like multipart or just the first file for simplicity
    // Return newline-delimited JSON of filenames+content for the frontend to handle
    return Response.json(csvFiles);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
