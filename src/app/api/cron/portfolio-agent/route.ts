import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPortfolioAgent } from "@/lib/agent/portfolio-agent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  console.log(`[AGENT CRON] Running portfolio agent for ${orgs.length} organizations`);

  const results: { org: string; runId?: string; error?: string }[] = [];

  for (const org of orgs) {
    try {
      const runId = await runPortfolioAgent(org.id, "daily_cron");
      results.push({ org: org.name, runId });
      console.log(`[AGENT CRON] Completed for org ${org.name}: run ${runId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ org: org.name, error: msg });
      console.error(`[AGENT CRON] Failed for org ${org.name}:`, msg);
    }
  }

  return Response.json({ processed: orgs.length, results });
}
