import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { runPortfolioAgent } from "@/lib/agent/portfolio-agent";

export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const runId = await runPortfolioAgent(organizationId, "manual");
    return Response.json({ runId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AGENT TRIGGER]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
