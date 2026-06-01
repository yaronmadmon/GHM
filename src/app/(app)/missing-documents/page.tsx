import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";

export default async function MissingDocumentsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;

  // Get all active leases with their tenants and application documents
  const activeLeases = await prisma.lease.findMany({
    where: { organizationId: orgId, status: "active" },
    include: {
      unit: { include: { property: true } },
      tenants: {
        include: {
          tenant: {
            include: {
              convertedFrom: {
                include: { documents: { select: { docType: true } } },
              },
            },
          },
        },
        where: { isPrimary: true },
        take: 1,
      },
    },
  });

  // Low-confidence property documents (global Needs Review)
  const lowConfidenceDocs = await prisma.propertyDocument.findMany({
    where: {
      organizationId: orgId,
      OR: [{ confidenceScore: { lt: 0.6 } }, { confidenceScore: null }],
    },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  type TenantGap = {
    tenantId: string;
    tenantName: string;
    leaseId: string;
    unitLabel: string;
    missingItems: string[];
  };

  const tenantGaps: TenantGap[] = [];

  for (const lease of activeLeases) {
    const lt = lease.tenants[0];
    if (!lt) continue;

    const tenant = lt.tenant;
    const appDocs = tenant.convertedFrom?.documents ?? [];
    const docTypes = new Set(appDocs.map((d) => d.docType ?? ""));
    const missing: string[] = [];

    if (lease.signingStatus !== "fully_signed") missing.push("Signed lease");
    if (!docTypes.has("government_id")) missing.push("Government ID");
    if (!docTypes.has("pay_stub")) missing.push("Proof of income");

    if (missing.length > 0) {
      tenantGaps.push({
        tenantId: tenant.id,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        leaseId: lease.id,
        unitLabel: `${lease.unit.property.name} · Unit ${lease.unit.unitNumber}`,
        missingItems: missing,
      });
    }
  }

  const totalIssues = tenantGaps.length + lowConfidenceDocs.length;

  return (
    <div className="page-shell page-stack">
      <div>
        <p className="page-kicker">Document health</p>
        <h1 className="page-title mt-2">Missing Documents</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {totalIssues === 0
            ? "All required documents are on file."
            : `${totalIssues} issue${totalIssues === 1 ? "" : "s"} require attention.`}
        </p>
      </div>

      {tenantGaps.length === 0 && lowConfidenceDocs.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="font-medium">All clear</p>
              <p className="text-sm text-muted-foreground">No missing required documents or low-confidence items found.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Tenant document gaps */}
          {tenantGaps.length > 0 && (
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Tenant Required Documents
                  <Badge variant="outline" className="ml-auto border-amber-200 text-amber-700">
                    {tenantGaps.length} tenant{tenantGaps.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {tenantGaps.map((gap) => (
                  <div key={gap.tenantId} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/tenants/${gap.tenantId}`}
                        className="font-medium hover:text-primary"
                      >
                        {gap.tenantName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{gap.unitLabel}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {gap.missingItems.map((item) => (
                          <Badge
                            key={item}
                            variant="outline"
                            className="border-amber-200 bg-amber-500/5 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-300"
                          >
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        href={`/tenants/${gap.tenantId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View tenant →
                      </Link>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Low-confidence document center items */}
          {lowConfidenceDocs.length > 0 && (
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Document Center — Needs Review
                  <Badge variant="outline" className="ml-auto border-amber-200 text-amber-700">
                    {lowConfidenceDocs.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {lowConfidenceDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {doc.documentType.replace(/_/g, " ")}
                        {doc.property && ` · ${doc.property.name}`}
                        {doc.confidenceScore != null &&
                          ` · ${Math.round(doc.confidenceScore * 100)}% confidence`}
                      </p>
                    </div>
                    <Link href="/documents" className="shrink-0 text-xs text-primary hover:underline">
                      Review →
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
