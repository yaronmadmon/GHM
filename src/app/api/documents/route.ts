import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { parsePropertyDocument } from "@/lib/document-parser";

export const maxDuration = 60;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES)
      return Response.json({ error: "File too large. Max 15 MB." }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    const fileBase64 = buf.toString("base64");
    const mimeType = file.type || "application/octet-stream";

    // Fetch all properties so the AI can match by name/address
    const properties = await prisma.property.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true, name: true, addressLine1: true, city: true, state: true },
      orderBy: { name: "asc" },
    });

    const propertyList = properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: `${p.addressLine1}, ${p.city}, ${p.state}`,
    }));

    const parsed = await parsePropertyDocument(fileBase64, mimeType, propertyList);

    // Store the file now so the save step only needs to send metadata
    let fileUrl: string;
    let fileKey: string | undefined;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(
        `documents/${organizationId}/${Date.now()}-${file.name}`,
        file,
        { access: "public", contentType: mimeType },
      );
      fileUrl = blob.url;
      fileKey = blob.pathname;
    } else {
      fileUrl = `data:${mimeType};base64,${fileBase64}`;
    }

    return Response.json({
      parsed,
      fileUrl,
      fileKey: fileKey ?? null,
      fileName: file.name,
      properties: propertyList,
    });
  } catch (err) {
    console.error("Document parse error:", err);
    return Response.json({ error: "Failed to analyze document" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");

    const documents = await prisma.propertyDocument.findMany({
      where: {
        organizationId,
        ...(propertyId ? { propertyId } : {}),
      },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(
      documents.map((d) => ({
        ...d,
        amount: d.amount !== null ? Number(d.amount) : null,
        issueDate: d.issueDate?.toISOString() ?? null,
        dueDate: d.dueDate?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    );
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
