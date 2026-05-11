import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Wrench, Clock } from "lucide-react";
import { addDays } from "date-fns";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { ReportPrintControls } from "./ReportPrintControls";

const PRIORITY_BADGE: Record<string, string> = {
  emergency: "bg-red-500/10 text-red-600 border-red-200",
  high: "bg-orange-500/10 text-orange-600 border-orange-200",
  medium: "bg-amber-500/10 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground",
};

export default async function PropertyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const orgId = session.user.organizationId;

  const [property, org, monthPayments, ytdRentAgg, ytdExpenses, openMaintenance, expiringLeases] = await Promise.all([
    prisma.property.findFirst({
      where: { id, organizationId: orgId },
      include: {
        units: {
          include: {
            leases: {
              where: { status: "active" },
              include: {
                tenants: { include: { tenant: true } },
                rentPayments: { where: { status: { in: ["overdue", "partial", "pending"] } } },
              },
            },
          },
          orderBy: { unitNumber: "asc" },
        },
      },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.rentPayment.findMany({
      where: { organizationId: orgId, periodYear: year, periodMonth: month, lease: { unit: { propertyId: id } } },
    }),
    prisma.rentPayment.aggregate({
      where: { organizationId: orgId, periodYear: year, lease: { unit: { propertyId: id } } },
      _sum: { amountPaid: true },
    }),
    prisma.transaction.findMany({
      where: { propertyId: id, organizationId: orgId, type: "expense", date: { gte: new Date(year, 0, 1) } },
      orderBy: { date: "desc" },
    }),
    prisma.maintenanceRequest.findMany({
      where: { organizationId: orgId, unit: { propertyId: id }, status: { in: ["open", "in_progress", "pending_parts"] } },
      include: { unit: { select: { unitNumber: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.lease.findMany({
      where: { organizationId: orgId, status: "active", unit: { propertyId: id }, endDate: { gte: now, lte: addDays(now, 60) } },
      include: { unit: { select: { unitNumber: true } }, tenants: { include: { tenant: true }, where: { isPrimary: true } } },
      orderBy: { endDate: "asc" },
    }),
  ]);

  if (!property) notFound();

  // ── Calculations ──────────────────────────────────────────
  const totalUnits = property.units.length;
  const occupiedUnits = property.units.filter((u) => u.leases.length > 0).length;
  const monthExpected = monthPayments.reduce((s, p) => s + Number(p.amountDue), 0);
  const monthCollected = monthPayments.reduce((s, p) => s + Number(p.amountPaid), 0);
  const collectionRate = monthExpected > 0 ? Math.round((monthCollected / monthExpected) * 100) : 0;
  const ytdRentCollected = Number(ytdRentAgg._sum.amountPaid ?? 0);
  const ytdExpensesTotal = ytdExpenses.reduce((s, t) => s + Number(t.amount), 0);
  const ytdNet = ytdRentCollected - ytdExpensesTotal;

  // ── Rent roll rows ─────────────────────────────────────────
  const rows = property.units.map((unit) => {
    const lease = unit.leases[0];
    const primaryTenant = lease?.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease?.tenants[0]?.tenant;
    const arrears = lease?.rentPayments.reduce((s, p) => {
      const owed = Number(p.amountDue) - Number(p.amountPaid);
      return s + (owed > 0 ? owed : 0);
    }, 0) ?? 0;
    return {
      unitNumber: unit.unitNumber,
      bedrooms: unit.bedrooms != null ? Number(unit.bedrooms) : null,
      bathrooms: unit.bathrooms != null ? Number(unit.bathrooms) : null,
      sqft: unit.sqft,
      tenantName: primaryTenant ? `${primaryTenant.firstName} ${primaryTenant.lastName}` : null,
      tenantId: primaryTenant?.id ?? null,
      leaseId: lease?.id ?? null,
      rentAmount: lease ? Number(lease.rentAmount) : null,
      leaseStart: lease?.startDate ?? null,
      leaseEnd: lease?.endDate ?? null,
      arrears,
      occupied: !!lease,
    };
  });

  const totalMonthlyRent = rows.reduce((s, r) => s + (r.rentAmount ?? 0), 0);
  const address = `${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}`;
  const dateGenerated = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const overdueRows = rows.filter((r) => r.arrears > 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* ── Print styles ─────────────────────────────────── */}
      <style>{`
        .report-full-doc, .report-clean-doc { display: none; }

        @media print {
          body * { visibility: hidden; }

          html.print-full .report-full-doc,
          html.print-full .report-full-doc * { visibility: visible; }
          html.print-full .report-full-doc {
            position: absolute; top: 0; left: 0; right: 0;
            padding: 28px 36px; font-family: sans-serif; font-size: 12px; color: #000;
          }

          html.print-clean .report-clean-doc,
          html.print-clean .report-clean-doc * { visibility: visible; }
          html.print-clean .report-clean-doc {
            position: absolute; top: 0; left: 0; right: 0;
            padding: 28px 36px; font-family: sans-serif; font-size: 12px; color: #000;
          }

          .pt { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .pt th { background: #f0f0f0; font-weight: 700; font-size: 11px; text-align: left;
                   padding: 5px 8px; border: 1px solid #ccc; }
          .pt td { padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; vertical-align: top; }
          .pt tr:nth-child(even) td { background: #fafafa; }
          .pt .num { text-align: right; }
          .pt .red { color: #c00; font-weight: 600; }
          .pt .muted { color: #777; }

          .p-section { margin-bottom: 20px; page-break-inside: avoid; }
          .p-h1 { font-size: 18px; font-weight: 700; margin: 0 0 2px; }
          .p-h2 { font-size: 15px; font-weight: 700; margin: 0 0 8px; border-bottom: 2px solid #000; padding-bottom: 3px; }
          .p-sub { font-size: 11px; color: #555; margin: 0 0 16px; }
          .p-kpis { display: flex; gap: 24px; margin-bottom: 20px; }
          .p-kpi { border: 1px solid #ccc; border-radius: 4px; padding: 8px 14px; min-width: 120px; }
          .p-kpi-val { font-size: 18px; font-weight: 700; }
          .p-kpi-lbl { font-size: 10px; color: #555; margin-top: 2px; }
          .p-footer { margin-top: 32px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
          .p-action-list { margin: 4px 0 0 0; padding: 0; list-style: none; }
          .p-action-list li { padding: 3px 0; border-bottom: 1px solid #eee; font-size: 11px; }
          .p-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        }
      `}</style>

      {/* ── Screen UI ────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href={`/properties/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold">{property.name} — Report</h1>
          <p className="text-sm text-muted-foreground">{address}</p>
        </div>
      </div>

      <ReportPrintControls />

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Occupancy", value: `${occupiedUnits}/${totalUnits}`, sub: `${totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0}%` },
          { label: "This month", value: formatCurrency(monthCollected), sub: `${collectionRate}% of ${formatCurrency(monthExpected)}` },
          { label: "YTD Income", value: formatCurrency(ytdRentCollected), sub: `${year}` },
          { label: "YTD Net", value: formatCurrency(ytdNet), sub: `after ${formatCurrency(ytdExpensesTotal)} expenses`, highlight: ytdNet < 0 },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.highlight ? "text-destructive" : ""}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rent roll preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Rent Roll</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Unit</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Tenant</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Beds/Ba</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Rent/mo</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Lease Start</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Lease End</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Arrears</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.unitNumber} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{r.unitNumber}</td>
                    <td className="px-4 py-2.5">
                      {r.tenantName
                        ? <Link href={`/tenants/${r.tenantId}`} className="hover:text-primary transition-colors">{r.tenantName}</Link>
                        : <span className="text-muted-foreground italic">Vacant</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {r.bedrooms != null ? `${r.bedrooms}bd` : "—"}{r.bathrooms != null ? ` / ${r.bathrooms}ba` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{r.rentAmount != null ? formatCurrency(r.rentAmount) : "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.leaseStart ? formatDate(r.leaseStart) : "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.leaseEnd ? formatDate(r.leaseEnd) : r.occupied ? "MTM" : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {r.arrears > 0
                        ? <span className="text-destructive font-semibold">{formatCurrency(r.arrears)}</span>
                        : r.occupied ? <span className="text-emerald-600">Current</span> : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td colSpan={3} className="px-4 py-2.5 text-xs">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{formatCurrency(totalMonthlyRent)}/mo</td>
                  <td colSpan={2} />
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-destructive">
                    {overdueRows.length > 0 ? formatCurrency(overdueRows.reduce((s, r) => s + r.arrears, 0)) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action items */}
      {(overdueRows.length > 0 || openMaintenance.length > 0 || expiringLeases.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {overdueRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Overdue Rent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdueRows.map((r) => (
                  <div key={r.unitNumber} className="flex justify-between text-sm">
                    <span>{r.tenantName ?? `Unit ${r.unitNumber}`}</span>
                    <span className="text-destructive font-semibold">{formatCurrency(r.arrears)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {openMaintenance.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-orange-500" /> Open Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {openMaintenance.map((req) => (
                  <div key={req.id} className="flex items-start justify-between gap-2 text-sm">
                    <Link href={`/maintenance/${req.id}`} className="hover:text-primary line-clamp-1">{req.title}</Link>
                    <Badge className={`text-[10px] border shrink-0 ${PRIORITY_BADGE[req.priority] ?? ""}`}>{req.priority}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {expiringLeases.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" /> Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {expiringLeases.map((l) => {
                  const t = l.tenants[0]?.tenant;
                  const days = daysUntil(l.endDate);
                  return (
                    <div key={l.id} className="flex justify-between text-sm">
                      <span>{t ? `${t.firstName} ${t.lastName}` : `Unit ${l.unit.unitNumber}`}</span>
                      <Badge variant={days !== null && days <= 30 ? "destructive" : "secondary"} className="text-xs">{days}d</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── PRINT: Full Report ────────────────────────────── */}
      <div className="report-full-doc">
        <div className="p-section">
          <div className="p-h1">{property.name}</div>
          <div className="p-sub">{address} &nbsp;|&nbsp; Report generated: {dateGenerated} &nbsp;|&nbsp; {org?.name ?? ""}</div>
        </div>

        {/* KPIs */}
        <div className="p-section">
          <div className="p-h2">At a Glance — {year}</div>
          <div className="p-kpis">
            <div className="p-kpi">
              <div className="p-kpi-val">{occupiedUnits}/{totalUnits}</div>
              <div className="p-kpi-lbl">Units occupied ({totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0}%)</div>
            </div>
            <div className="p-kpi">
              <div className="p-kpi-val">{formatCurrency(monthCollected)}</div>
              <div className="p-kpi-lbl">Collected this month ({collectionRate}% of {formatCurrency(monthExpected)})</div>
            </div>
            <div className="p-kpi">
              <div className="p-kpi-val">{formatCurrency(ytdRentCollected)}</div>
              <div className="p-kpi-lbl">YTD rent collected</div>
            </div>
            <div className="p-kpi">
              <div className="p-kpi-val">{formatCurrency(ytdExpensesTotal)}</div>
              <div className="p-kpi-lbl">YTD expenses</div>
            </div>
            <div className="p-kpi">
              <div className="p-kpi-val" style={{ color: ytdNet < 0 ? "#c00" : "#1a7a3f" }}>{formatCurrency(ytdNet)}</div>
              <div className="p-kpi-lbl">YTD net</div>
            </div>
          </div>
        </div>

        {/* Full rent roll */}
        <div className="p-section">
          <div className="p-h2">Rent Roll</div>
          <table className="pt">
            <thead>
              <tr>
                <th>Unit</th><th>Tenant</th><th>Beds</th><th>Ba</th>
                <th className="num">Rent/mo</th><th>Lease Start</th><th>Lease End</th>
                <th className="num">Arrears</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.unitNumber}>
                  <td>{r.unitNumber}</td>
                  <td>{r.tenantName ?? <em className="muted">Vacant</em>}</td>
                  <td>{r.bedrooms ?? "—"}</td>
                  <td>{r.bathrooms ?? "—"}</td>
                  <td className="num">{r.rentAmount != null ? formatCurrency(r.rentAmount) : "—"}</td>
                  <td>{r.leaseStart ? formatDate(r.leaseStart) : "—"}</td>
                  <td>{r.leaseEnd ? formatDate(r.leaseEnd) : r.occupied ? "MTM" : "—"}</td>
                  <td className={`num ${r.arrears > 0 ? "red" : ""}`}>
                    {r.arrears > 0 ? formatCurrency(r.arrears) : r.occupied ? "Current" : "—"}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: "#f0f0f0" }}>
                <td colSpan={4}>Total</td>
                <td className="num">{formatCurrency(totalMonthlyRent)}/mo</td>
                <td colSpan={2} />
                <td className="num red">
                  {overdueRows.length > 0 ? formatCurrency(overdueRows.reduce((s, r) => s + r.arrears, 0)) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Income / Expenses */}
        <div className="p-two-col">
          <div className="p-section">
            <div className="p-h2">Income — {year} YTD</div>
            <table className="pt">
              <tbody>
                <tr><td>Rent collected</td><td className="num">{formatCurrency(ytdRentCollected)}</td></tr>
                <tr style={{ fontWeight: 700 }}><td>Total income</td><td className="num">{formatCurrency(ytdRentCollected)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="p-section">
            <div className="p-h2">Expenses — {year} YTD</div>
            <table className="pt">
              <tbody>
                {ytdExpenses.length === 0
                  ? <tr><td colSpan={2} className="muted">No expenses recorded</td></tr>
                  : ytdExpenses.map((t) => (
                    <tr key={t.id}>
                      <td>{t.description ?? t.category}</td>
                      <td className="num">{formatCurrency(Number(t.amount))}</td>
                    </tr>
                  ))}
                <tr style={{ fontWeight: 700 }}><td>Total expenses</td><td className="num">{formatCurrency(ytdExpensesTotal)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Action items */}
        {(overdueRows.length > 0 || openMaintenance.length > 0 || expiringLeases.length > 0) && (
          <div className="p-section">
            <div className="p-h2">Action Items</div>
            <div className="p-two-col">
              {overdueRows.length > 0 && (
                <div>
                  <strong>Overdue Rent</strong>
                  <ul className="p-action-list">
                    {overdueRows.map((r) => (
                      <li key={r.unitNumber}>Unit {r.unitNumber} — {r.tenantName} — <span style={{ color: "#c00" }}>{formatCurrency(r.arrears)}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {openMaintenance.length > 0 && (
                <div>
                  <strong>Open Maintenance ({openMaintenance.length})</strong>
                  <ul className="p-action-list">
                    {openMaintenance.map((req) => (
                      <li key={req.id}>[{req.priority.toUpperCase()}] {req.title} — Unit {req.unit?.unitNumber ?? "?"}</li>
                    ))}
                  </ul>
                </div>
              )}
              {expiringLeases.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Leases Expiring (60 days)</strong>
                  <ul className="p-action-list">
                    {expiringLeases.map((l) => {
                      const t = l.tenants[0]?.tenant;
                      const days = daysUntil(l.endDate);
                      return (
                        <li key={l.id}>Unit {l.unit.unitNumber} — {t ? `${t.firstName} ${t.lastName}` : "?"} — {l.endDate ? formatDate(l.endDate) : "?"} ({days}d)</li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-footer">
          {org?.name ?? ""} &nbsp;|&nbsp; {property.name} &nbsp;|&nbsp; Generated {dateGenerated} &nbsp;|&nbsp; Confidential
        </div>
      </div>

      {/* ── PRINT: Clean Rent Roll ───────────────────────── */}
      <div className="report-clean-doc">
        <div className="p-section">
          <div className="p-h1">{property.name}</div>
          <div className="p-sub">
            {address} &nbsp;|&nbsp; {org?.name ?? ""} &nbsp;|&nbsp; Rent Roll as of {dateGenerated}
          </div>
        </div>

        <table className="pt">
          <thead>
            <tr>
              <th>Unit</th><th>Beds</th><th>Ba</th><th>Sqft</th>
              <th className="num">Monthly Rent</th><th className="num">Annual Rent</th>
              <th>Lease Start</th><th>Lease End</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unitNumber}>
                <td>{r.unitNumber}</td>
                <td>{r.bedrooms ?? "—"}</td>
                <td>{r.bathrooms ?? "—"}</td>
                <td>{r.sqft != null ? r.sqft.toLocaleString() : "—"}</td>
                <td className="num">{r.rentAmount != null ? formatCurrency(r.rentAmount) : "—"}</td>
                <td className="num">{r.rentAmount != null ? formatCurrency(r.rentAmount * 12) : "—"}</td>
                <td>{r.leaseStart ? formatDate(r.leaseStart) : "—"}</td>
                <td>{r.leaseEnd ? formatDate(r.leaseEnd) : r.occupied ? "Month-to-month" : "—"}</td>
                <td>{r.occupied ? "Occupied" : "Vacant"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: "#f0f0f0" }}>
              <td colSpan={4}>Total — {totalUnits} units / {occupiedUnits} occupied ({totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0}%)</td>
              <td className="num">{formatCurrency(totalMonthlyRent)}/mo</td>
              <td className="num">{formatCurrency(totalMonthlyRent * 12)}/yr</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>

        <div className="p-footer">
          {org?.name ?? ""} &nbsp;|&nbsp; {property.name} &nbsp;|&nbsp; As of {dateGenerated} &nbsp;|&nbsp; For broker/lender use
        </div>
      </div>
    </div>
  );
}
