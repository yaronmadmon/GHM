import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Validate token
  const invite = await prisma.applicationInvite.findFirst({
    where: { token, isActive: true },
  });
  if (!invite) return Response.json({ error: "Invalid invite" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const applicationId = formData.get("applicationId") as string | null;
  const docType = (formData.get("docType") as string) || "other";

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
  if (!applicationId) return Response.json({ error: "No applicationId provided" }, { status: 400 });

  // Verify the application belongs to this invite
  const application = await prisma.application.findFirst({
    where: { id: applicationId, inviteId: invite.id },
  });
  if (!application) return Response.json({ error: "Application not found" }, { status: 404 });

  // Limit file size to 8MB (base64 overhead ~33% → ~10.5MB in DB)
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "File too large. Max 8 MB per file." }, { status: 413 });
  }

  try {
    // If Vercel Blob is configured, use it. Otherwise store as base64 data URI in DB.
    let url: string;
    let fileKey: string | undefined;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Dynamic import so the module doesn't break when token isn't set
      const { put } = await import("@vercel/blob");
      const blob = await put(
        `applications/${applicationId}/${Date.now()}-${file.name}`,
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

    const doc = await prisma.applicationDocument.create({
      data: {
        applicationId,
        name: file.name,
        url,
        fileKey: fileKey ?? null,
        docType,
      },
    });

    // Return the doc without the full base64 payload to keep the response small
    return Response.json(
      { id: doc.id, name: doc.name, docType: doc.docType, createdAt: doc.createdAt, url: fileKey ? url : "[stored]" },
      { status: 201 }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
