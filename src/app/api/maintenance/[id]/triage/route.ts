import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import OpenAI from "openai";

export const maxDuration = 30;

let _openai: OpenAI | null = null;
function getOpenAI() {
  _openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const TRIAGE_PROMPT = `You are a property maintenance triage assistant. Analyze the maintenance request and respond with JSON.

Fields:
- category: one of "plumbing" | "electrical" | "hvac" | "appliance" | "structural" | "other"
- priority: one of "low" | "medium" | "high" | "emergency"
- isEmergency: boolean — true if there is immediate risk to safety, habitability, or structural integrity
- vendorType: suggested trade (e.g. "plumber", "electrician", "hvac technician", "handyman", "general contractor")
- reasoning: 1-2 sentences explaining the triage decision
- suggestedResponse: a short professional message to send to the tenant (2-3 sentences, acknowledge receipt, set expectations, do not make promises about timing)

Be conservative — only flag emergency if genuinely urgent. Respond only with valid JSON.`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;

    const request = await prisma.maintenanceRequest.findFirst({
      where: { id, organizationId },
      include: {
        property: { select: { name: true } },
        unit: { select: { unitNumber: true } },
      },
    });
    if (!request) return Response.json({ error: "Not found" }, { status: 404 });

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        { role: "system", content: TRIAGE_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            title: request.title,
            description: request.description,
            currentCategory: request.category,
            currentPriority: request.priority,
            property: request.property?.name,
            unit: request.unit?.unitNumber,
          }),
        },
      ],
    });

    const triage = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      category?: string;
      priority?: string;
      isEmergency?: boolean;
      vendorType?: string;
      reasoning?: string;
      suggestedResponse?: string;
    };

    // Post triage as a comment so it appears in the timeline
    const commentBody = [
      `**AI Triage** · ${new Date().toLocaleDateString()}`,
      `**Category:** ${triage.category ?? request.category ?? "other"}`,
      `**Priority:** ${triage.priority ?? request.priority}${triage.isEmergency ? " 🚨 EMERGENCY" : ""}`,
      `**Suggested vendor:** ${triage.vendorType ?? "—"}`,
      `**Reasoning:** ${triage.reasoning ?? "—"}`,
      triage.suggestedResponse ? `\n**Suggested tenant response:**\n${triage.suggestedResponse}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const comment = await prisma.maintenanceComment.create({
      data: {
        requestId: id,
        authorId: userId,
        body: commentBody,
      },
    });

    // Update category and priority if AI suggests a change
    const updates: Record<string, string> = {};
    if (triage.category && triage.category !== request.category) updates.category = triage.category;
    if (triage.priority && triage.priority !== request.priority) updates.priority = triage.priority;
    if (Object.keys(updates).length > 0) {
      await prisma.maintenanceRequest.update({ where: { id }, data: updates });
    }

    return Response.json({
      triage,
      commentId: comment.id,
      updatedFields: Object.keys(updates),
    });
  } catch (err) {
    console.error("[MAINTENANCE TRIAGE]", err);
    return Response.json({ error: "Triage failed" }, { status: 500 });
  }
}
