import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { tools } from "@/lib/ai/tools";
import { handleTool } from "@/lib/ai/handlers";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const systemPrompt = `You are a helpful property management assistant for GHM (a rental property management app).
You have access to the landlord's live portfolio data via tools. Use tools proactively when answering questions about properties, tenants, payments, maintenance, or finances.
Today's date is ${new Date().toDateString()}.
Be concise and direct. Format currency as USD. When presenting lists, use bullet points.
For write operations (recording payments), always describe what you're about to do and use the record_payment tool — the system will show a confirmation dialog to the user before any data is changed.`;

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const body = await req.json();
    const messages: Anthropic.MessageParam[] = body.messages ?? [];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages = [...messages];
          let response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: systemPrompt,
            tools,
            messages: currentMessages,
          });

          // Tool use loop
          while (response.stop_reason === "tool_use") {
            const toolUses = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const toolUse of toolUses) {
              const result = await handleTool(
                toolUse.name,
                toolUse.input as Record<string, unknown>,
                organizationId
              );
              toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
            }

            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: response.content },
              { role: "user", content: toolResults },
            ];

            response = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 1024,
              system: systemPrompt,
              tools,
              messages: currentMessages,
            });
          }

          // Emit the final text
          const textContent = response.content.find(
            (b): b is Anthropic.TextBlock => b.type === "text"
          );
          if (textContent) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: textContent.text })}\n\n`)
            );
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("AI chat error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "AI service error" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
