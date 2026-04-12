import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User, Phone, Mail, Home, Briefcase, FileText, DollarSign,
  Calendar, ArrowLeft, MessageSquare, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { TenantMessageButton } from "@/components/tenants/TenantMessageButton";
import { SendPortalInviteButton } from "@/components/tenants/SendPortalInviteButton";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      leaseLinks: {
        include: {
          lease: {
            include: {
              unit: { include: { property: true } },
              rentPayments: { orderBy: { dueDate: "desc" }, take: 12 },
              documents: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      convertedFrom: {
        include: {
          property: true,
          unit: true,
          references: true,
          documents: true,
        },
      },
    },
  });

  if (!tenant) notFound();

  const activeLease = tenant.leaseLinks.find((l) => l.lease?.status === "active")?.lease;
  const pastLeases = tenant.leaseLinks.filter((l) => l.lease?.status !== "active").map((l) => l.lease);
  const app = tenant.convertedFrom;

  // Find existing message thread with this tenant's portal user
  const portalUserId = tenant.portalUserId;
  const existingThread = portalUserId
    ? await prisma.messageThread.findFirst({
        where: {
          organizationId: session.user.organizationId,
          landlordUserId: session.user.id,
          tenantUserId: portalUserId,
        },
        orderBy: { lastMessageAt: "desc" },
      })
    : null;

  const overduePayments = activeLease?.rentPayments.filter((p) => p.status === "overdue") ?? [];
  const totalOverdue = overduePayments.reduce((s, p) => s + (Number(p.amountDue) - Number(p.amountPaid)), 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tenants">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg shrink-0">
            {getInitials(`${tenant.firstName} ${tenant.lastName}`)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold truncate">{tenant.firstName} {tenant.lastName}</h1>
            {activeLease && (
              <p className="text-sm text-muted-foreground">
                {activeLease.unit.property.name} · Unit {activeLease.unit.unitNumber}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {portalUserId ? (
            <TenantMessageButton
              tenantUserId={portalUserId}
              tenantName={`${tenant.firstName} ${tenant.lastName}`}
              existingThreadId={existingThread?.id}
              landlordUserId={session.user.id}
            />
          ) : tenant.email ? (
            <SendPortalInviteButton tenantId={tenant.id} email={tenant.email} />
          ) : (
            <Button size="sm" variant="outline" disabled className="gap-2">
              <MessageSquare className="h-4 w-4" />
              No email on file
            </Button>
          )}
        </div>
      </div>

      {/* Overdue alert */}
      {totalOverdue > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">
            {formatCurrency(totalOverdue)} overdue across {overduePayments.length} payment{overduePayments.length > 1 ? "s" : ""}
          </p>
          <Link href="/rent" className="ml-auto text-xs text-primary hover:underline">View rent →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Personal info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {tenant.email ? (
                <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">{tenant.email}</a>
              ) : <span className="text-muted-foreground">—</span>}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {tenant.phone ? (
                <a href={`tel:${tenant.phone}`} className="hover:underline">{tenant.phone}</a>
              ) : <span className="text-muted-foreground">—</span>}
            </div>
            {tenant.dateOfBirth && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>DOB: {new Date(tenant.dateOfBirth).toLocaleDateString()}</span>
              </div>
            )}
            {tenant.ssnLast4 && (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>SSN: ···{tenant.ssnLast4}</span>
              </div>
            )}
            {tenant.emergencyContactName && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Emergency contact</p>
                <p className="font-medium">{tenant.emergencyContactName}</p>
                {tenant.emergencyContactPhone && <p className="text-muted-foreground">{tenant.emergencyContactPhone}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active lease */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {activeLease ? "Active Lease" : "No Active Lease"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {activeLease ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property</span>
                  <span className="font-medium">{activeLease.unit.property.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium">{activeLease.unit.unitNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rent</span>
                  <span className="font-medium font-mono">{formatCurrency(Number(activeLease.rentAmount))}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start</span>
                  <span>{formatDate(activeLease.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires</span>
                  <span>{activeLease.endDate ? formatDate(activeLease.endDate) : "Month-to-month"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Signing</span>
                  <span className="text-xs">
                    {activeLease.signingStatus === "fully_signed" && <span className="text-green-600 font-medium">✓ Fully signed</span>}
                    {activeLease.signingStatus === "tenant_signed" && <span className="text-amber-600">Awaiting counter-sign</span>}
                    {activeLease.signingStatus === "sent" && <span className="text-muted-foreground">Sent to tenant</span>}
                    {activeLease.signingStatus === "draft" && <span className="text-muted-foreground">Not sent</span>}
                  </span>
                </div>
                <div className="pt-2">
                  <Link href={`/leases/${activeLease.id}`}>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <FileText className="h-3.5 w-3.5" />View full lease
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No active lease. <Link href="/leases/new" className="text-primary hover:underline">Create one →</Link></p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rent payment history */}
      {activeLease && activeLease.rentPayments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />Recent Rent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {activeLease.rentPayments.slice(0, 6).map((p) => {
                const statusColor = p.status === "paid" ? "text-emerald-600" : p.status === "overdue" ? "text-destructive" : "text-muted-foreground";
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <span className="text-muted-foreground">{new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatCurrency(Number(p.amountPaid))} / {formatCurrency(Number(p.amountDue))}</span>
                      <span className={`text-xs font-medium capitalize ${statusColor}`}>{p.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application data */}
      {app && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4" />Employment (from application)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Employer</p><p>{app.employerName ?? "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Job Title</p><p>{app.jobTitle ?? "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Monthly Income</p><p>{app.monthlyIncome ? formatCurrency(Number(app.monthlyIncome)) : "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Employer Phone</p><p>{app.employerPhone ?? "—"}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Home className="h-4 w-4" />Rental History (from application)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Previous Landlord</p><p>{app.currentLandlordName ?? "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Landlord Phone</p><p>{app.currentLandlordPhone ?? "—"}</p></div>
              <div className="col-span-2"><p className="text-muted-foreground text-xs">Reason for Moving</p><p>{app.reasonForMoving ?? "—"}</p></div>
              {(app.hasPets || app.hasVehicles) && (
                <>
                  {app.hasPets && <div><p className="text-muted-foreground text-xs">Pets</p><p>{app.petsDescription || "Yes"}</p></div>}
                  {app.hasVehicles && <div><p className="text-muted-foreground text-xs">Vehicles</p><p>{app.vehiclesDescription || "Yes"}</p></div>}
                </>
              )}
            </CardContent>
          </Card>

          {app.references.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">References (from application)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {app.references.map((ref) => (
                  <div key={ref.id} className="text-sm border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ref.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{ref.type}</Badge>
                    </div>
                    {ref.relationship && <p className="text-xs text-muted-foreground">{ref.relationship}</p>}
                    <div className="flex gap-3 mt-1">
                      {ref.phone && <a href={`tel:${ref.phone}`} className="text-xs text-primary hover:underline">{ref.phone}</a>}
                      {ref.email && <a href={`mailto:${ref.email}`} className="text-xs text-primary hover:underline">{ref.email}</a>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {app.backgroundCheckStatus && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />Background Check
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={app.backgroundCheckStatus === "passed" ? "default" : app.backgroundCheckStatus === "failed" ? "destructive" : "secondary"}>
                    {app.backgroundCheckStatus}
                  </Badge>
                </div>
                {app.backgroundCheckNotes && <p className="text-muted-foreground">{app.backgroundCheckNotes}</p>}
              </CardContent>
            </Card>
          )}

          <div className="flex">
            <Link href={`/applications/${app.id}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />View original application
              </Button>
            </Link>
          </div>
        </>
      )}

      {/* Past leases */}
      {pastLeases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Past Leases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pastLeases.map((l) => l && (
              <Link key={l.id} href={`/leases/${l.id}`}>
                <div className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted transition-colors">
                  <span>{l.unit?.property?.name ?? "—"} · Unit {l.unit?.unitNumber}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">{formatDate(l.startDate)} – {l.endDate ? formatDate(l.endDate) : "MTM"}</span>
                    <Badge variant="outline" className="text-xs">{l.status}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {tenant.notes && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{tenant.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
