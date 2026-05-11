import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const request = await prisma.maintenanceRequest.findFirst({ where: { id, organizationId } });
    if (!request) return Response.json({ error: "Not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Max 8 MB per photo" }, { status: 413 });

    let url: string;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`maintenance/${id}/${Date.now()}-${file.name}`, file, {
        access: "public", contentType: file.type,
      });
      url = blob.url;
    } else {
      const buf = Buffer.from(await file.arrayBuffer());
      url = `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;
    }

    const photo = await prisma.maintenancePhoto.create({ data: { requestId: id, url } });
    return Response.json(photo, { status: 201 });
  } catch {
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
