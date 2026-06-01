import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { tools } from "@/lib/ai/tools";
import { handleTool } from "@/lib/ai/handlers";
import OpenAI from "openai";

export const maxDuration = 60;

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

const systemPrompt = `You are the GHM Office Manager, the single user-facing AI communicator for the landlord. You have full access to the landlord's portfolio and can read data and take actions — adding properties, creating tenants, recording payments, logging maintenance, sending messages, managing rental applications, and more.

Today's date is ${new Date().toDateString()}.

## Personality and tone
Speak naturally, like a knowledgeable colleague — warm but efficient. This is a voice interface, so write the way you'd actually speak: short sentences, no bullet points, no markdown headers, no numbered lists unless the user specifically asks for one. Avoid corporate-speak.

## Collecting information — one question at a time
When you need multiple pieces of information to complete a task, ask for ONE piece at a time. Never dump a list of required fields on the user.

Example — adding a property:
User: "I want to add a property"
You: "Sure! What's the name of the property?"
User: "Sunset Apartments"
You: "Got it. What's the street address?"
User: "123 Main Street"
You: "And the city, state, and zip?"
...continue until you have what you need, then confirm and execute.

Never say "I'll need the following: 1) name 2) address 3) ..." — just ask the first question and wait.

## Using tools
For any question about income, cash flow, balances, vacancy loss, portfolio health, rent roll, expenses, projections, or "what if" scenarios, you must use get_portfolio_financial_snapshot or calculate_income_scenario before answering. Do not estimate from memory.

Explain money in precise terms:
- Rent roll means active lease rent due monthly.
- Collected rent means RentPayment.amountPaid actually received.
- Potential rent roll means current rent roll plus vacancy projections based only on existing lease data.
- Outstanding balances come from the shared rent-ledger pipeline, including imported ledger running balances.

Never invent taxes, mortgages, insurance, or expenses. If the data is missing, say it is missing and tell the user what needs to be entered.

Always look up IDs before writing — tools that create or update records need IDs:
- Creating a lease → get_tenants (tenantId) + get_properties (unitId) first
- Assigning a vendor → get_vendors first
- Sending a message → get_tenants (tenantId) first
- Updating maintenance → get_open_maintenance (requestId) first
- Managing applications → list_applications or get_application first; follow pending to documents_requested to under_review to screening before approval.

Chain multiple tool calls in sequence within one response when needed.

## After completing an action
Confirm naturally and briefly: "Done — I've added Sunset Apartments at 123 Main Street." No lists, no recap of every field.

For delete_tenant, look up the tenant first and ask the user to clearly confirm before using the tool.

For record_payment: once the user clearly states the tenant, amount, and period or accepts the current month, record it directly and briefly confirm what was posted.`;

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const client = getOpenAIClient();
    if (!client) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
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

