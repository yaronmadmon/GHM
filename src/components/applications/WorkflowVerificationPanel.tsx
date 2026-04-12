"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AppDoc { id: string; docType: string; }
interface Reference { id: string; }
interface ActivityEvent {
  id: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor?: { name: string | null; email: string };
}

interface Application {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  employerName: string | null;
  monthlyIncome: number | null;
  backgroundCheckStatus: string | null;
  backgroundCheckDate: string | null;
  createdAt: string;
  reviewedAt: string | null;
  documents: AppDoc[];
  references: Reference[];
  convertedLeaseId: string | null;
}

interface Lease {
  id: string;
  signingStatus: string;
  tenantSignedAt: string | null;
  landlordSignedAt: string | null;
  moveInCompleted: boolean;
  moveInCompletedAt: string | null;
}

type StageStatus = "pass" | "fail" | "pending";

interface Stage {
  name: string;
  required: string[];
  status: StageStatus;
  detail: string;
  timestamp?: string;
  nextAction?: string;
}

function buildStages(app: Application, lease: Lease | null): Stage[] {
  const hasDoc = (type: string) => app.documents.some((d) => d.docType === type);
  const screeningOk = app.backgroundCheckStatus === "passed" || app.backgroundCheckStatus === "conditional";

  return [
    {
      name: "1. Application Received",
      required: ["Submitted application"],
      status: "pass",
      detail: `Received ${formatDate(new Date(app.createdAt))}`,
      timestamp: app.createdAt,
    },
    {
      name: "2. Contact Info",
      required: ["Email", "Phone"],
      status: (app.email && app.phone) ? "pass" : "fail",
      detail: app.email ? `${app.email}${app.phone ? ` · ${app.phone}` : ""}` : "Missing email or phone",
      nextAction: (!app.email || !app.phone) ? "Contact applicant for missing info" : undefined,
    },
    {
      name: "3. Employment",
      required: ["Employer name", "Monthly income"],
      status: (app.employerName && app.monthlyIncome) ? "pass" : "fail",
      detail: app.employerName ? `${app.employerName} · $${Number(app.monthlyIncome ?? 0).toLocaleString()}/mo` : "Missing employer or income",
    },
    {
      name: "4. References",
      required: ["At least 1 reference"],
      status: app.references.length > 0 ? "pass" : "fail",
      detail: `${app.references.length} reference(s) on file`,
      nextAction: app.references.length === 0 ? "Applicant did not provide references" : undefined,
    },
    {
      name: "5. Documents",
      required: ["Pay stub", "Government ID", "Bank statement"],
      status: (hasDoc("pay_stub") && hasDoc("id") && hasDoc("bank_statement")) ? "pass" : app.documents.length > 0 ? "pending" : "fail",
      detail: `${app.documents.length} doc(s) · ${["pay_stub","id","bank_statement"].filter(t => !hasDoc(t)).map(t => ({ pay_stub:"Pay stub", id:"ID", bank_statement:"Bank stmt"})[t]).join(", ") || "All present"}`,
      nextAction: app.documents.length === 0 ? 'Click "Request Documents" to advance status' : undefined,
    },
    {
      name: "6. Screening",
      required: ["Background check passed or conditional"],
      status: screeningOk ? "pass" : app.backgroundCheckStatus && app.backgroundCheckStatus !== "not_started" ? "pending" : "fail",
      detail: app.backgroundCheckStatus
        ? `${app.backgroundCheckStatus.replace("_", " ")}${app.backgroundCheckDate ? ` on ${formatDate(new Date(app.backgroundCheckDate))}` : ""}`
        : "Not started",
      timestamp: app.backgroundCheckDate ?? undefined,
      nextAction: !screeningOk ? "Run background check and update screening status" : undefined,
    },
    {
      name: "7. Decision",
      required: ["Application approved or denied"],
      status: app.status === "approved" ? "pass" : app.status === "denied" ? "fail" : "pending",
      detail: `Status: ${app.status}`,
      timestamp: app.reviewedAt ?? undefined,
      nextAction: app.status === "pending" ? "Approve (requires docs + screening) or deny" : undefined,
    },
    {
      name: "8. Lease Signed",
      required: ["Tenant signed", "Landlord countersigned"],
      status: lease?.signingStatus === "fully_signed" ? "pass" : lease ? "pending" : "fail",
      detail: lease
        ? lease.signingStatus === "fully_signed"
          ? `Fully signed ${lease.landlordSignedAt ? formatDate(new Date(lease.landlordSignedAt)) : ""}`
          : `Status: ${lease.signingStatus.replace("_", " ")}`
        : "No lease created",
      timestamp: lease?.landlordSignedAt ?? undefined,
      nextAction: lease?.signingStatus === "draft" ? "Send lease for tenant signature" : lease?.signingStatus === "tenant_signed" ? "Countersign the lease" : undefined,
    },
    {
      name: "9. Move-in Confirmed",
      required: ["All checklist items checked"],
      status: lease?.moveInCompleted ? "pass" : "pending",
      detail: lease?.moveInCompleted
        ? `Confirmed ${lease.moveInCompletedAt ? formatDate(new Date(lease.moveInCompletedAt)) : ""}`
        : "Not yet confirmed",
      timestamp: lease?.moveInCompletedAt ?? undefined,
      nextAction: lease?.signingStatus === "fully_signed" && !lease.moveInCompleted ? "Complete move-in checklist on lease detail page" : undefined,
    },
  ];
}

interface Props {
  app: Application;
}

export function WorkflowVerificationPanel({ app }: Props) {
  const [lease, setLease] = useState<Lease | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (app.convertedLeaseId) {
      fetch(`/api/leases/${app.convertedLeaseId}`)
        .then((r) => r.json())
        .then(setLease)
        .catch(() => {});
    }
    fetch(`/api/activity?entityType=application&entityId=${app.id}`)
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [app.id, app.convertedLeaseId]);

  const stages = buildStages(app, lease);
  const passed = stages.filter((s) => s.status === "pass").length;

  const statusIcon = (s: StageStatus) => {
    if (s === "pass") return <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />;
    if (s === "fail") return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    return <Clock className="h-4 w-4 text-amber-400 shrink-0" />;
  };

  return (
    <div className="space-y-1">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="font-medium">{passed}/{stages.length} stages complete</span>
        <span className={passed === stages.length ? "text-emerald-600 font-medium" : ""}>
          {passed === stages.length ? "✓ Ready for move-in" : `${stages.length - passed} remaining`}
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(passed / stages.length) * 100}%` }} />
      </div>

      {/* Stage rows */}
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.name} className={`rounded-lg border p-3 text-xs ${stage.status === "pass" ? "border-emerald-200 bg-emerald-50/40" : stage.status === "fail" ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/30"}`}>
            <div className="flex items-start gap-2">
              {statusIcon(stage.status)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{stage.name}</p>
                <p className="text-muted-foreground mt-0.5">{stage.detail}</p>
                {stage.timestamp && (
                  <p className="text-muted-foreground/70 mt-0.5">{formatDate(new Date(stage.timestamp))}</p>
                )}
                {stage.nextAction && (
                  <p className="text-amber-700 font-medium mt-1">→ {stage.nextAction}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity log */}
      <div className="mt-3 border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
          onClick={() => setLogOpen((o) => !o)}
        >
          <span>Activity Log ({events.length})</span>
          {logOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {logOpen && (
          <div className="divide-y max-h-64 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">No activity yet.</p>
            ) : events.map((e) => (
              <div key={e.id} className="px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{e.eventType.replace("_", " ")}</span>
                  <span className="text-muted-foreground">{formatDate(new Date(e.createdAt))}</span>
                </div>
                <p className="text-muted-foreground">
                  {e.actor?.name ?? e.actor?.email ?? "System"}
                  {e.metadata?.from && e.metadata?.to ? ` · ${e.metadata.from} → ${e.metadata.to}` : ""}
                  {e.metadata?.action ? ` · ${String(e.metadata.action).replace("_", " ")}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
