import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { tools } from "@/lib/ai/tools";
import { handleTool } from "@/lib/ai/handlers";
import OpenAI from "openai";

export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = body.messages ?? [];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [...messages];
          let response = await client.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 2048,
            tools,
            messages: [
              { role: "system", content: systemPrompt },
              ...currentMessages,
            ],
          });

          // Tool use loop — handles multi-step tool chains
          while (response.choices[0].finish_reason === "tool_calls") {
            const rawToolCalls = response.choices[0].message.tool_calls ?? [];

            const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
            for (const tc of rawToolCalls) {
              if (tc.type !== "function") continue;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fn = (tc as any).function as { name: string; arguments: string };
              let input: Record<string, unknown> = {};
              try { input = JSON.parse(fn.arguments); } catch {}
              const result = await handleTool(
                fn.name,
                input,
                organizationId,
                userId,
              );
              toolResults.push({
                role: "tool",
                tool_call_id: tc.id,
                content: result,
              });
            }

            currentMessages = [
              ...currentMessages,
              response.choices[0].message,
              ...toolResults,
            ];

            response = await client.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 2048,
              tools,
              messages: [
                { role: "system", content: systemPrompt },
                ...currentMessages,
              ],
            });
          }

          // Emit the final text
          const text = response.choices[0].message.content;
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
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
