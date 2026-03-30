import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { DollarSign, FileText, Wrench, MessageSquare, AlertTriangle } from "lucide-react";

export default async function TenantPortalPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "tenant") redirect("/login");

  // Find tenant linked to this user
  const tenant = await prisma.tenant.findFirst({
    where: { portalUserId: session.user.id },
    include: {
      leaseLinks: {
        include: {
          lease: {
            include: {
              unit: { include: { property: true } },
              rentPayments: { orderBy: { dueDate: "desc" }, take: 3 },
            },
          },
        },
      },
    },
  });

  if (!tenant) return (
    <div className="text-center py-12 text-muted-foreground">
      <p>No tenant account linked. Please contact your landlord.</p>
    </div>
  );

  const activeLease = tenant.leaseLinks.find((l) => l.lease?.status === "active")?.lease;
  const recentPayments = activeLease?.rentPayments ?? [];
  const overduePayment = recentPayments.find((p) => p.status === "overdue");

  const openMaintenance = await prisma.maintenanceRequest.count({
    where: { reportedByTenantId: tenant.id, status: { in: ["open", "in_progress"] } },
  });

  const unreadMessages = await prisma.message.count({
    where: { recipientId: session.user.id, isRead: false },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {tenant.firstName}!</h1>
        {activeLease && (
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeLease.unit.property.name} · Unit {activeLease.unit.unitNumber}
          </p>
        )}
      </div>

      {overduePayment && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="font-medium text-sm">Overdue rent payment</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(Number(overduePayment.amountDue))} was due {formatDate(overduePayment.dueDate)}
            </p>
          </div>
          <Link href="/portal/payments" className="ml-auto text-sm text-primary hover:underline">Pay now</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Link href="/portal/lease">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />Lease
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeLease ? (
                <>
                  <p className="font-semibold">{formatCurrency(Number(activeLease.rentAmount))}/mo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeLease.endDate ? `Expires in ${daysUntil(activeLease.endDate)} days` : "Month-to-month"}
                  </p>
                </>
              ) : <p className="text-sm text-muted-foreground">No active lease</p>}
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/payments">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{recentPayments.filter((p) => p.status === "paid").length} paid</p>
              <p className="text-xs text-muted-foreground mt-0.5">{recentPayments.filter((p) => p.status === "overdue").length} overdue</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/maintenance">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wrench className="h-4 w-4" />Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{openMaintenance}</p>
              <p className="text-xs text-muted-foreground mt-0.5">open requests</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/messages">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />Messages
                {unreadMessages > 0 && <Badge variant="destructive" className="ml-auto h-4 text-xs px-1">{unreadMessages}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{unreadMessages > 0 ? `${unreadMessages} unread` : "All read"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">messages from landlord</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
