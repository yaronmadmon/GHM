import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

export default async function PortalLeasePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "tenant") redirect("/login");

  const tenant = await prisma.tenant.findFirst({
    where: { portalUserId: session.user.id },
    include: {
      leaseLinks: {
        include: {
          lease: {
            include: {
              unit: { include: { property: true } },
              documents: true,
              tenants: { include: { tenant: true } },
            },
          },
        },
      },
    },
  });

  if (!tenant) redirect("/portal");
  const activeLease = tenant.leaseLinks.find((l) => l.lease?.status === "active")?.lease;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My Lease</h1>

      {!activeLease ? (
        <p className="text-muted-foreground">No active lease found.</p>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Lease Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Property</p>
                  <p className="font-medium">{activeLease.unit.property.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unit</p>
                  <p className="font-medium">Unit {activeLease.unit.unitNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(activeLease.startDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Date</p>
                  <p className="font-medium">{activeLease.endDate ? formatDate(activeLease.endDate) : "Month-to-month"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monthly Rent</p>
                  <p className="font-medium">{formatCurrency(Number(activeLease.rentAmount))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Security Deposit</p>
                  <p className="font-medium">{formatCurrency(Number(activeLease.depositAmount))}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge>{activeLease.status}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Documents</CardTitle></CardHeader>
            <CardContent>
              {activeLease.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {activeLease.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{doc.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {activeLease.tenants.length > 1 && (
            <Card>
              <CardHeader><CardTitle>Co-Tenants</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activeLease.tenants.map((lt) => (
                    <p key={lt.tenant.id} className="text-sm">
                      {lt.tenant.firstName} {lt.tenant.lastName}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
