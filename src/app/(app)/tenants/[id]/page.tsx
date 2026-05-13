import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  Mail,
  MessageSquare,
  Phone,
  Receipt,
  ScrollText,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { formatCurrency, formatDate, formatRelativeTime, getInitials } from "@/lib/utils";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";
import { TenantMessageButton } from "@/components/tenants/TenantMessageButton";
import { SendPortalInviteButton } from "@/components/tenants/SendPortalInviteButton";
import { TenantActions } from "@/components/tenants/TenantActions";
import { MonthlyChargesManager } from "@/components/tenants/MonthlyChargesManager";

type Occupant = {
  name?: string;
  relationship?: string;
  dateOfBirth?: string;
};

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b py-2 text-sm last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="min-w-0 font-medium">{value || <span className="text-muted-foreground">--</span>}</div>
    </div>
  );
}

function parseOccupants(value: unknown): Occupant[] {
  if (!Array.isArray(value)) return [];
  const occupants: Occupant[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const occupant = {
        name: typeof row.name === "string" ? row.name : undefined,
        relationship: typeof row.relationship === "string" ? row.relationship : undefined,
        dateOfBirth: typeof row.dateOfBirth === "string" ? row.dateOfBirth : undefined,
      };
      if (occupant.name) occupants.push(occupant);
    }
  }
  return occupants;
}

function latestDate(dates: Array<Date | null | undefined>) {
  return dates
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      leaseLinks: {
        include: {
          lease: {
            include: {
              unit: { include: { property: true } },
              tenants: { include: { tenant: true }, orderBy: { createdAt: "asc" } },
              rentPayments: { orderBy: { dueDate: "asc" } },
              documents: { orderBy: { createdAt: "desc" } },
              transactions: { orderBy: { date: "asc" } },
              monthlyCharges: { orderBy: { createdAt: "asc" } },
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
          documents: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!tenant) notFound();

  const [existingThread, messageThreads, activityEvents] = await Promise.all([
    tenant.portalUserId
      ? prisma.messageThread.findFirst({
          where: {
            organizationId: session.user.organizationId,
            landlordUserId: session.user.id,
            tenantUserId: tenant.portalUserId,
          },
          orderBy: { lastMessageAt: "desc" },
        })
      : null,
    tenant.portalUserId
      ? prisma.messageThread.findMany({
          where: {
            organizationId: session.user.organizationId,
            tenantUserId: tenant.portalUserId,
          },
          include: { messages: { orderBy: { createdAt: "desc" }, take: 3 } },
          orderBy: { lastMessageAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    prisma.activityEvent.findMany({
      where: {
        organizationId: session.user.organizationId,
        OR: [
          { entityType: "tenant", entityId: tenant.id },
          ...tenant.leaseLinks.map((link) => ({ entityType: "lease", entityId: link.leaseId })),
        ],
      },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const activeLease = tenant.leaseLinks.find((link) => link.lease?.status === "active")?.lease;
  const pastLeases = tenant.leaseLinks.filter((link) => link.lease?.status !== "active").map((link) => link.lease);
  const app = tenant.convertedFrom;
  const tenantName = `${tenant.firstName} ${tenant.lastName}`;
  const occupants = parseOccupants(app?.additionalOccupants);
  const leaseTenants = activeLease?.tenants ?? [];
  const currentBalance = activeLease
    ? calculateLeaseOutstandingBalance({ rentPayments: activeLease.rentPayments, transactions: activeLease.transactions })
    : 0;
  const monthlyCharges = activeLease?.monthlyCharges.filter((charge) => charge.isActive).map((charge) => ({
    id: charge.id,
    name: charge.name,
    category: charge.category,
    amount: Number(charge.amount),
    startDate: charge.startDate?.toISOString() ?? null,
    endDate: charge.endDate?.toISOString() ?? null,
    isActive: charge.isActive,
    notes: charge.notes,
  })) ?? [];
  const monthlyChargeTotal = monthlyCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const monthlyTotalDue = Number(activeLease?.rentAmount ?? 0) + monthlyChargeTotal;
  const latestRentPayment = latestDate(activeLease?.rentPayments.map((payment) => payment.paidAt ?? null) ?? []);
  const latestLedgerPayment = latestDate(
    activeLease?.transactions
      .filter((transaction) => transaction.type === "expense")
      .map((transaction) => transaction.date) ?? [],
  );
  const lastReceipt = latestDate([latestRentPayment, latestLedgerPayment]);
  const portalActive = Boolean(tenant.portalUserId);
  const statusLabel = currentBalance > 0 ? "Balance Due" : "Current";
  const propertyLine = activeLease
    ? `${activeLease.unit.property.name} - ${activeLease.unit.unitNumber} | ${activeLease.unit.property.addressLine1} - ${activeLease.unit.unitNumber}, ${activeLease.unit.property.city}, ${activeLease.unit.property.state} ${activeLease.unit.property.zip}`
    : "No active occupancy";
  const tenantActionData = {
    id: tenant.id,
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    email: tenant.email,
    phone: tenant.phone,
    dateOfBirth: tenant.dateOfBirth,
    ssnLast4: tenant.ssnLast4,
    emergencyContactName: tenant.emergencyContactName,
    emergencyContactPhone: tenant.emergencyContactPhone,
    notes: tenant.notes,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/tenants">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {getInitials(tenantName)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{tenantName}</h1>
            <p className="truncate text-sm text-muted-foreground">{propertyLine}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TenantActions
            tenant={tenantActionData}
          />
          <Link href={`/tenants/${id}/ledger`}>
            <Button size="sm" variant="outline" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Ledger
            </Button>
          </Link>
          {portalActive ? (
            <TenantMessageButton
              tenantUserId={tenant.portalUserId!}
              tenantName={tenantName}
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

      <Section title="Summary" icon={<ClipboardList className="h-4 w-4" />}>
        <div className="mb-4 text-sm font-medium">{propertyLine}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Monthly Charges</p>
            <p className="mt-1 font-mono text-lg font-semibold">{formatCurrency(monthlyTotalDue)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Current Balance</p>
            <p className={`mt-1 font-mono text-lg font-semibold ${currentBalance > 0 ? "text-destructive" : "text-emerald-600"}`}>
              {formatCurrency(currentBalance)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Deposit Paid</p>
            <p className="mt-1 font-mono text-lg font-semibold">{formatCurrency(Number(activeLease?.depositAmount ?? 0))}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Last Receipt</p>
            <p className="mt-1 text-sm font-semibold">{lastReceipt ? formatDate(lastReceipt) : "--"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Lease End Date</p>
            <p className="mt-1 text-sm font-semibold">{activeLease?.endDate ? formatDate(activeLease.endDate) : "--"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Online Portal Status</p>
            <p className="mt-1 text-sm font-semibold">{portalActive ? "Portal Active" : "Not Active"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={currentBalance > 0 ? "destructive" : "secondary"} className="mt-1">
              {statusLabel}
            </Badge>
          </div>
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <Section title="Tenants" icon={<Users className="h-4 w-4" />} action={<TenantActions tenant={tenantActionData} editOnly variant="ghost" />}>
            <div className="space-y-3 text-sm">
              {leaseTenants.length > 0 ? leaseTenants.map((link) => (
                <div key={link.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Link href={`/tenants/${link.tenant.id}`} className="font-medium hover:text-primary">
                      {link.tenant.firstName} {link.tenant.lastName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{link.isPrimary ? "Primary Tenant" : "Tenant"}</p>
                  </div>
                  <Badge variant={link.isPrimary ? "default" : "outline"}>{link.isPrimary ? "Primary" : "Occupant"}</Badge>
                </div>
              )) : (
                <div className="rounded-lg border p-3 font-medium">{tenantName}</div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Other Occupants</p>
                {occupants.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {occupants.map((occupant, index) => (
                      <div key={`${occupant.name}-${index}`} className="rounded-lg border p-3">
                        <p className="font-medium">{occupant.name}</p>
                        <p className="text-xs text-muted-foreground">{occupant.relationship || "Occupant"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No other occupants recorded.</p>
                )}
              </div>
            </div>
          </Section>

          <Section title={tenantName} icon={<User className="h-4 w-4" />} action={<TenantActions tenant={tenantActionData} editOnly variant="ghost" />}>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Field label="Birthday" value={tenant.dateOfBirth ? formatDate(tenant.dateOfBirth) : app?.dateOfBirth ? formatDate(app.dateOfBirth) : "--"} />
                <Field label="Primary Tenant" value={leaseTenants.find((link) => link.tenantId === tenant.id)?.isPrimary ? "Yes" : "No"} />
                <Field label="Tenant Status" value={statusLabel} />
                <Field label="Type" value="Financially Responsible" />
              </div>
              <div>
                <Field label="Move In" value={activeLease ? formatDate(activeLease.startDate) : app?.desiredMoveInDate ? formatDate(app.desiredMoveInDate) : "--"} />
                <Field label="Move Out" value="--" />
                <Field label="Notice" value="--" />
                <Field label="Move Out Reason" value="--" />
              </div>
            </div>
          </Section>

          <Section title="Contact" icon={<Phone className="h-4 w-4" />} action={<TenantActions tenant={tenantActionData} editOnly variant="ghost" />}>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone Numbers</p>
                {tenant.phone ? (
                  <a href={`tel:${tenant.phone}`} className="text-sm font-medium hover:text-primary">Home {tenant.phone}</a>
                ) : (
                  <p className="text-sm text-muted-foreground">No phone number recorded.</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Emails</p>
                {tenant.email ? (
                  <a href={`mailto:${tenant.email}`} className="text-sm font-medium text-primary hover:underline">{tenant.email}</a>
                ) : (
                  <p className="text-sm text-muted-foreground">No email recorded.</p>
                )}
              </div>
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Addresses</p>
                <p className="text-sm font-medium">
                  {activeLease ? `${activeLease.unit.property.addressLine1} - ${activeLease.unit.unitNumber}` : app?.currentAddress ?? "--"}
                </p>
                {activeLease && (
                  <p className="text-sm text-muted-foreground">
                    {activeLease.unit.property.city}, {activeLease.unit.property.state} {activeLease.unit.property.zip}
                  </p>
                )}
              </div>
            </div>
          </Section>

          <Section title="Lease Information" icon={<FileText className="h-4 w-4" />} action={<Button variant="ghost" size="sm">Edit</Button>}>
            {activeLease ? (
              <div className="space-y-4">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Field label="Lease Signed" value={activeLease.tenantSignedAt ? formatDate(activeLease.tenantSignedAt) : activeLease.signingStatus === "fully_signed" ? "Fully Executed" : "--"} />
                    <Field label="Month To Month" value={activeLease.leaseType === "month_to_month" ? "Yes" : "No"} />
                    <Field label="Lease From" value={formatDate(activeLease.startDate)} />
                    <Field label="Lease To" value={activeLease.endDate ? formatDate(activeLease.endDate) : "Month-to-month"} />
                  </div>
                  <div>
                    <Field label="Last Lease Renewal" value="--" />
                    <Field label="Payment Due Day" value={`Day ${activeLease.paymentDueDay}`} />
                    <Field label="Signing Status" value={activeLease.signingStatus.replace("_", " ")} />
                    <Field label="Eligible For Renewal" value="Yes" />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lease Documents</p>
                  {activeLease.documents.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Document</th>
                            <th className="px-3 py-2 text-left">Lease Dates</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeLease.documents.map((doc) => (
                            <tr key={doc.id} className="border-t">
                              <td className="px-3 py-2">{doc.name}</td>
                              <td className="px-3 py-2 text-muted-foreground">{formatDate(activeLease.startDate)} - {activeLease.endDate ? formatDate(activeLease.endDate) : "MTM"}</td>
                              <td className="px-3 py-2">Fully Executed</td>
                              <td className="px-3 py-2"><a href={doc.url} className="text-primary hover:underline">View in Browser</a></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No lease documents found.</p>
                  )}
                </div>
                <Link href={`/leases/${activeLease.id}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    View full lease
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active lease. <Link href="/leases/new" className="text-primary hover:underline">Create one</Link>.</p>
            )}
          </Section>

          <Section title="Financials" icon={<CircleDollarSign className="h-4 w-4" />} action={<Button variant="ghost" size="sm">Edit</Button>}>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Field label="Deposit Paid" value={formatCurrency(Number(activeLease?.depositAmount ?? 0))} />
                <Field label="Current Balance" value={<span className={currentBalance > 0 ? "text-destructive" : "text-emerald-600"}>{formatCurrency(currentBalance)}</span>} />
                <Field label="NSF Fee" value={activeLease?.transactions.some((txn) => /nsf/i.test(txn.description ?? "")) ? "Recorded in ledger" : "--"} />
                <Field label="Eligible For Rent Increase On" value={activeLease?.endDate ? formatDate(new Date(activeLease.endDate.getFullYear(), activeLease.endDate.getMonth(), activeLease.endDate.getDate() + 1)) : "--"} />
              </div>
              <div>
                <Field label="Utility Billing Enabled" value="No" />
                <Field label="Allow Online Payments" value="Yes" />
                <Field label="Require Online Payments In Full" value="No" />
                <Field label="Flexible Rent" value="Not Applied" />
              </div>
            </div>
          </Section>

          <Section
            title="Monthly Charges"
            icon={<Receipt className="h-4 w-4" />}
            action={activeLease ? <MonthlyChargesManager leaseId={activeLease.id} charges={monthlyCharges} /> : null}
          >
            {activeLease ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">4100: Rent Income</p>
                    <p className="text-xs text-muted-foreground">{formatDate(activeLease.startDate)} to {activeLease.endDate ? formatDate(activeLease.endDate) : "(no end date)"}</p>
                  </div>
                  <p className="font-mono font-semibold">{formatCurrency(Number(activeLease.rentAmount))}</p>
                </div>
                {monthlyCharges.map((charge) => (
                  <div key={charge.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{charge.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{charge.category.replace("_", " ")}</p>
                    </div>
                    <p className="font-mono font-semibold">{formatCurrency(charge.amount)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total charges for this month</span>
                  <span className="font-mono font-semibold">{formatCurrency(monthlyTotalDue)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next charge</span>
                  <span className="font-medium">{formatCurrency(monthlyTotalDue)} on the next due date</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recurring charges configured.</p>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Status" icon={<CheckCircle2 className="h-4 w-4" />} action={<Button variant="ghost" size="sm">Edit</Button>}>
            <Field label="Balance" value={<span className={currentBalance > 0 ? "text-destructive" : "text-emerald-600"}>{formatCurrency(currentBalance)}</span>} />
            <Field label="Delinquency Notes" value={currentBalance > 0 ? "Add delinquency note" : "--"} />
            <Field label="Last Receipt" value={lastReceipt ? formatDate(lastReceipt) : "--"} />
            <Field label="Evicting" value="No" />
            <Field label="In Collections" value="No" />
            <Field label="Certified Funds Only" value="No" />
            <Field label="Eligible for Renewal" value="Yes" />
          </Section>

          <Section title="Online Portal Status" icon={<CreditCard className="h-4 w-4" />} action={<Button variant="ghost" size="sm">Edit</Button>}>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={portalActive ? "default" : "outline"}>{portalActive ? "Portal Active" : "Not Active"}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Login Email</p>
                <p className="font-medium">{tenant.email ?? "--"}</p>
              </div>
              {tenant.email && !portalActive && <SendPortalInviteButton tenantId={tenant.id} email={tenant.email} />}
            </div>
          </Section>

          <Section title="Emergency Contact" icon={<ShieldCheck className="h-4 w-4" />} action={<TenantActions tenant={tenantActionData} editOnly variant="ghost" />}>
            <Field label="Name" value={tenant.emergencyContactName ?? app?.emergencyContactName ?? "--"} />
            <Field label="Phone" value={tenant.emergencyContactPhone ?? app?.emergencyContactPhone ?? "--"} />
            <Field label="Relation" value={app?.emergencyContactRelation ?? "--"} />
          </Section>

          <Section title="Upcoming Activities" icon={<Calendar className="h-4 w-4" />}>
            <p className="text-sm text-muted-foreground">There are no activities at this time.</p>
          </Section>

          <Section title="Insurance Coverage" icon={<ShieldCheck className="h-4 w-4" />}>
            <Field label="Insurance Requirement" value="No" />
            <div className="mt-3 overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Details</th>
                    <th className="px-3 py-2 text-left">Policyholder</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">No policies found.</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Messages" icon={<MessageSquare className="h-4 w-4" />}>
            {messageThreads.length > 0 ? (
              <div className="space-y-3">
                {messageThreads.map((thread) => (
                  <div key={thread.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Link href="/messages" className="font-medium hover:text-primary">{thread.subject}</Link>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(thread.lastMessageAt)}</span>
                    </div>
                    {thread.messages[0] && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{thread.messages[0].body}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No text or email messages recorded.</p>
            )}
          </Section>

          <Section title="Notes" icon={<ScrollText className="h-4 w-4" />} action={<TenantActions tenant={tenantActionData} editOnly variant="ghost" />}>
            {tenant.notes || app?.additionalNotes ? (
              <p className="whitespace-pre-wrap text-sm">{tenant.notes ?? app?.additionalNotes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes recorded.</p>
            )}
          </Section>
        </div>
      </div>

      <Section title="Audit Log" icon={<Activity className="h-4 w-4" />}>
        {activityEvents.length > 0 ? (
          <div className="space-y-2">
            {activityEvents.map((event) => (
              <div key={event.id} className="flex gap-3 border-b py-2 text-sm last:border-0">
                <div className="w-36 shrink-0 text-muted-foreground">{formatDate(event.createdAt)}</div>
                <div>
                  <p className="font-medium capitalize">{event.eventType.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.entityType} record updated{event.actor?.name ? ` by ${event.actor.name}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No audit events recorded.</p>
        )}
      </Section>

      <Section title="Attachments" icon={<FileText className="h-4 w-4" />}>
        {app?.documents.length || activeLease?.documents.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {activeLease?.documents.map((doc) => (
              <a key={doc.id} href={doc.url} className="rounded-lg border p-3 text-sm hover:border-primary/40">
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">Lease document</p>
              </a>
            ))}
            {app?.documents.map((doc) => (
              <a key={doc.id} href={doc.url} className="rounded-lg border p-3 text-sm hover:border-primary/40">
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.docType ?? "Application document"}</p>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No files attached.</p>
        )}
      </Section>

      {pastLeases.length > 0 && (
        <Section title="Past Leases" icon={<Home className="h-4 w-4" />}>
          <div className="space-y-2">
            {pastLeases.map((lease) => lease && (
              <Link key={lease.id} href={`/leases/${lease.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:border-primary/40">
                <span>{lease.unit?.property?.name ?? "--"} - Unit {lease.unit?.unitNumber}</span>
                <span className="text-xs text-muted-foreground">{formatDate(lease.startDate)} - {lease.endDate ? formatDate(lease.endDate) : "MTM"}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
