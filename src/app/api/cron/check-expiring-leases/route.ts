import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expiringSoon = await prisma.lease.findMany({
    where: {
      status: "active",
      endDate: { gte: new Date(), lte: addDays(new Date(), 60) },
    },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true } },
    },
  });

  // In production: send email notifications via Resend
  console.log(`[CRON] Found ${expiringSoon.length} leases expiring within 60 days`);

  return Response.json({ processed: expiringSoon.length });
}
