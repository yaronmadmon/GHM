import { prisma } from "@/lib/prisma";

interface CreateNotificationInput {
  userId: string;
  type: "message" | "payment_due" | "maintenance_update" | "lease_expiry";
  title: string;
  body: string;
  relatedUrl?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      relatedUrl: input.relatedUrl,
    },
  });
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  if (!inputs.length) return;
  return prisma.notification.createMany({ data: inputs });
}
