import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.rentPayment.updateMany({
    where: {
      status: "pending",
      dueDate: { lt: new Date() },
    },
    data: { status: "overdue" },
  });

  console.log(`[CRON] Marked ${result.count} payments as overdue`);
  return Response.json({ updated: result.count });
}
