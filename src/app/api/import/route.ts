import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { z } from "zod";

// Phase 1: parse file and return headers + sample rows
export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "parse";

    if (action === "parse") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

      const buf = Buffer.from(await file.arrayBuffer());
      let rows: Record<string, string>[] = [];

      if (file.name.endsWith(".csv")) {
        const text = buf.toString("utf-8");
        const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
        rows = result.data;
      } else {
        const wb = XLSX.read(buf, { type: "buffer" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      }

      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const sample = rows.slice(0, 3);

      return Response.json({ headers, sample, totalRows: rows.length });
    }

    if (action === "commit") {
      const body = await req.json();
      const { entity, mapping, rows } = body as {
        entity: string;
        mapping: Record<string, string>; // fieldName -> columnName
        rows: Record<string, string>[];
      };

      const results = { imported: 0, skipped: 0, errors: [] as string[] };

      for (const row of rows) {
        try {
          const mapped: Record<string, string> = {};
          for (const [field, col] of Object.entries(mapping)) {
            mapped[field] = row[col] ?? "";
          }

          if (entity === "tenants") {
            if (!mapped.firstName || !mapped.lastName) { results.skipped++; continue; }
            await prisma.tenant.create({
              data: {
                organizationId,
                firstName: mapped.firstName,
                lastName: mapped.lastName,
                email: mapped.email || null,
                phone: mapped.phone || null,
              },
            });
            results.imported++;
          } else if (entity === "properties") {
            if (!mapped.name || !mapped.address) { results.skipped++; continue; }
            await prisma.property.create({
              data: {
                organizationId,
                name: mapped.name,
                addressLine1: mapped.address,
                city: mapped.city || "",
                state: mapped.state || "",
                zip: mapped.zip || "",
                propertyType: mapped.type || "single_family",
              },
            });
            results.imported++;
          } else if (entity === "transactions") {
            const amount = parseFloat((mapped.amount ?? "0").replace(/[$,]/g, ""));
            if (isNaN(amount)) { results.skipped++; continue; }
            await prisma.transaction.create({
              data: {
                organizationId,
                type: mapped.type === "expense" ? "expense" : "income",
                category: mapped.category || "Other",
                amount,
                date: mapped.date ? new Date(mapped.date) : new Date(),
                description: mapped.description || null,
              },
            });
            results.imported++;
          }
        } catch {
          results.errors.push(`Row ${results.imported + results.skipped + 1}: import failed`);
          results.skipped++;
        }
      }

      return Response.json(results);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
