import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { tools } from "@/lib/ai/tools";
import { handleTool } from "@/lib/ai/handlers";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const systemPrompt = `You are a powerful property management assistant for GHM with FULL CONTROL over the landlord's portfolio. You can read data AND take actions — creating tenants, properties, leases, maintenance requests, sending messages, recording transactions, and more.

Today's date is ${new Date().toDateString()}.

## How to use your tools

**Always look up IDs before writing.** Tools that create or update records need IDs. Use read tools first:
- To create a lease: call get_tenants (get tenantId) + get_properties (get unitId) → then create_lease
- To assign a vendor: call get_vendors → then update_maintenance_request with assignedVendorId
- To send a message: call get_tenants (get tenantId) → then send_message
- To update maintenance: call get_open_maintenance (get requestId) → then update_maintenance_request

**Chain tool calls** — you can call multiple tools in sequence within one response.

## Writing style
- Be concise and direct
- Format currency as USD
- Use bullet points for lists
- After completing an action, confirm what was done with the key details (name, ID, amount, etc.)
- For record_payment specifically: the system requires user confirmation — say "I've queued the payment — please confirm in the dialog that appears."

## What you can do
- **Read**: properties, tenants, balances, overdue payments, expiring leases, maintenance, financials, messages, applications, vendors
- **Create**: tenants, properties, units, leases, maintenance requests, transactions, vendors
- **Update**: tenant info, maintenance status/priority/vendor, application workflow, screening status
- **Message**: send messages to any tenant (creates thread or replies to existing)
- **Payments**: record rent payments (requires user confirmation)`;

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const messages: Anthropic.MessageParam[] = body.messages ?? [];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages = [...messages];
          let response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            system: systemPrompt,
            tools,
            messages: currentMessages,
          });

          // Tool use loop — handles multi-step tool chains
          while (response.stop_reason === "tool_use") {
            const toolUses = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
            );

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const toolUse of toolUses) {
              const result = await handleTool(
                toolUse.name,
                toolUse.input as Record<string, unknown>,
                organizationId,
                userId,
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
              max_tokens: 2048,
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
          const msg = err instanceof Error ? err.message : String(err);
          console.error("AI chat error:", msg);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
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
