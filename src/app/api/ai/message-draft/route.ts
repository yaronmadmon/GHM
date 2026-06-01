import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export const maxDuration = 30;

let _openai: OpenAI | null = null;
function getOpenAI() {
  _openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { threadId, mode } = (await req.json()) as {
      threadId: string;
      mode: "reply" | "summarize";
    };

    const thread = await prisma.messageThread.findFirst({
      where: { id: threadId, organizationId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 20 },
      },
    });
    if (!thread) return Response.json({ error: "Thread not found" }, { status: 404 });

    const history = thread.messages
      .map((m) => `${m.senderRole === "landlord" ? "Landlord" : "Tenant"}: ${m.body}`)
      .join("\n");

    if (mode === "summarize") {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a property management assistant. Summarize the following message thread in 2-3 concise bullet points, highlighting key issues, action items, and outstanding questions. Be brief and factual.",
          },
          { role: "user", content: `Thread: ${thread.subject}\n\n${history}` },
        ],
      });
      return Response.json({ result: completion.choices[0]?.message?.content ?? "" });
    }

    // mode === "reply"
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are a property management assistant helping a landlord draft professional, friendly replies to tenant messages. Write a concise, helpful reply in first person. Keep it under 3 sentences unless the situation requires more. Do not include a greeting line or sign-off — just the body. Do not make promises you cannot keep. Do not include placeholders like [date] — if you need to reference something unknown, note it vaguely.",
        },
        {
          role: "user",
          content: `Thread subject: ${thread.subject}\n\nConversation:\n${history}\n\nDraft a reply from the landlord:`,
        },
      ],
    });

    return Response.json({ result: completion.choices[0]?.message?.content ?? "" });
  } catch (err) {
    console.error("[MESSAGE DRAFT]", err);
    return Response.json({ error: "Draft failed" }, { status: 500 });
  }
}
