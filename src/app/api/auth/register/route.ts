import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return Response.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const org = await prisma.organization.create({
      data: {
        name: data.organizationName,
        users: {
          create: {
            email: data.email,
            name: data.name,
            passwordHash,
            role: "owner",
          },
        },
        lateFeeConfig: {
          create: {
            gracePeriodDays: 5,
            feeType: "flat",
            flatAmount: 50,
          },
        },
      },
      include: { users: true },
    });

    const user = org.users[0];
    return Response.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: err.issues }, { status: 400 });
    }
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
