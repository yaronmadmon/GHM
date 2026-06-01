import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedDocumentTypes = new Set([
  "government_id",
  "pay_stub",
  "bank_statement",
  "tax_return",
  "previous_lease",
  "other",
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Validate token
  const invite = await prisma.applicationInvite.findFirst({
    where: { token, isActive: true },
  });
  if (!invite) return Response.json({ error: "Invalid invite" }, { status: 404 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return Response.json({ error: "This invite link has expired" }, { status: 410 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const applicationIdValue = formData.get("applicationId");
  const applicationId = typeof applicationIdValue === "string" && applicationIdValue.trim()
    ? applicationIdValue
    : null;
  const docTypeValue = formData.get("docType");
  const docType = typeof docTypeValue === "string" && docTypeValue.trim()
    ? docTypeValue
    : "other";

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
  if (!allowedDocumentTypes.has(docType)) {
    return Response.json({ error: "Invalid document type" }, { status: 400 });
  }

  if (applicationId) {
    // Verify the application belongs to this invite
    const application = await prisma.application.findFirst({
      where: { id: applicationId, inviteId: invite.id },
    });
    if (!application) return Response.json({ error: "Application not found" }, { status: 404 });
  }

  // Limit file size to 8MB (base64 overhead ~33% → ~10.5MB in DB)
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "File too large. Max 8 MB per file." }, { status: 413 });
  }

  try {
    // If Vercel Blob is configured, use it. Otherwise return/store a base64 data URI.
    let url: string;
    let fileKey: string | undefined;
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageScope = applicationId ?? `pending/${invite.id}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Dynamic import so the module doesn't break when token isn't set
      const { put } = await import("@vercel/blob");
      const blob = await put(
        `applications/${storageScope}/${Date.now()}-${safeFileName}`,
        file,
        { access: "public", contentType: file.type }
      );
      url = blob.url;
      fileKey = blob.pathname;
    } else {
      // Fallback: base64 data URI stored in the database
      const buf = Buffer.from(await file.arrayBuffer());
      url = `data:${file.type || "application/octet-stream"};base64,${buf.toString("base64")}`;
    }

    if (!applicationId) {
      return Response.json(
        { name: file.name, docType, createdAt: new Date().toISOString(), url, fileKey: fileKey ?? null },
        { status: 201 }
      );
    }

    const doc = await prisma.applicationDocument.create({
      data: {
        applicationId,
        name: file.name,
        url,
        fileKey: fileKey ?? null,
        docType,
      },
    });

    await prisma.activityEvent.create({
      data: {
        organizationId: invite.organizationId,
        entityType: "application",
        entityId: applicationId,
        eventType: "updated",
        metadata: { action: "applicant_document_uploaded", docType, name: file.name },
      },
    });

    // Return the doc without the full base64 payload to keep the response small
    return Response.json(
      { id: doc.id, name: doc.name, docType: doc.docType, createdAt: doc.createdAt, url: fileKey ? url : "[stored]", fileKey: doc.fileKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
