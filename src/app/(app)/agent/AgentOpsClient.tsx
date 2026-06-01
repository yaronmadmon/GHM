"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Mail,
  BarChart2,
  Wrench,
  FileText,
  DollarSign,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentRun {
  id: string;
  triggerEvent: string;
  status: string;
  confidenceScore: number | null;
  observationSummary: string | null;
  tasksGenerated: number;
  autoExecuted: number;
  pendingApproval: number;
  rawOutput: Record<string, string> | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface AgentTask {
  id: string;
  actionId: string;
  riskTier: string;
  workflow: string;
  title: string;
  description: string | null;
  status: string;
  executionPayload: Record<string, unknown> | null;
  createdAt: string;
  runTrigger: string;
  runStartedAt: string;
}

interface Props {
  initialRuns: AgentRun[];
  initialPendingTasks: AgentTask[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WORKFLOW_ICONS: Record<string, React.ElementType> = {
  daily_briefing: BarChart2,
  collections: DollarSign,
  lease_renewal: FileText,
  maintenance_triage: Wrench,
  document_bookkeeping: FileText,
};

const WORKFLOW_LABELS: Record<string, string> = {
  daily_briefing: "Daily Briefing",
  collections: "Collections",
  lease_renewal: "Lease Renewal",
  maintenance_triage: "Maintenance",
  document_bookkeeping: "Documents",
};

const TIER_STYLES: Record<string, string> = {
  AUTO_RUN: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  AUTO_DRAFT: "bg-amber-500/10 text-amber-700 border-amber-200",
  STRICT_BLOCK: "bg-red-500/10 text-red-700 border-red-200",
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <Badge variant="outline" className={`text-xs border ${TIER_STYLES[tier] ?? ""}`}>
      {tier === "AUTO_RUN" ? "Auto" : tier === "AUTO_DRAFT" ? "Needs Approval" : "Blocked"}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    running: "bg-blue-500/10 text-blue-700 border-blue-200",
    failed: "bg-red-500/10 text-red-700 border-red-200",
    pending: "bg-amber-500/10 text-amber-700 border-amber-200",
    executed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    auto_executed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    rejected: "bg-slate-500/10 text-slate-600 border-slate-200",
    blocked: "bg-red-500/10 text-red-700 border-red-200",
  };
  return (
    <Badge variant="outline" className={`text-xs border capitalize ${map[status] ?? ""}`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

// ─── Pending Task Card ───────────────────────────────────────────────────────

function PendingTaskCard({
  task,
  onApprove,
  onReject,
}: {
  task: AgentTask;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  const WorkflowIcon = WORKFLOW_ICONS[task.workflow] ?? Bot;
  const payload = task.executionPayload;
  const isEmail = payload?.type === "send_email";

  async function handle(action: "approve" | "reject") {
    setLoading(action);
    try {
      if (action === "approve") await onApprove(task.id);
      else await onReject(task.id);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
            <WorkflowIcon className="h-4 w-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">{task.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {WORKFLOW_LABELS[task.workflow] ?? task.workflow} ·{" "}
              {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <TierBadge tier={task.riskTier} />
      </div>

      {task.description && (
        <p className="text-sm text-muted-foreground">{task.description}</p>
      )}

      {isEmail && (
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Email to {payload?.toName as string ?? payload?.to as string}
          </div>
          <p className="text-xs font-medium">{payload?.subject as string}</p>
          {expanded && (
            <div
              className="text-xs text-muted-foreground mt-2 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: (payload?.html as string) ?? "" }}
            />
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Preview"} email
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          disabled={loading !== null}
          onClick={() => handle("approve")}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {loading === "approve" ? "Sending…" : "Approve & Send"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          disabled={loading !== null}
          onClick={() => handle("reject")}
        >
          <XCircle className="h-3.5 w-3.5" />
          {loading === "reject" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

// ─── Run Card ─────────────────────────────────────────────────────────────────

function RunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false);
  const briefing = run.rawOutput?.runSummary ?? null;

  return (
    <div className="border rounded-lg p-4 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium capitalize">
              {run.triggerEvent.replace("_", " ")} run
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
              {run.confidenceScore != null &&
                ` · ${Math.round(run.confidenceScore * 100)}% confidence`}
            </p>
          </div>
        </div>
        <StatusBadge status={run.status} />
      </div>

      {run.status === "completed" && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-emerald-600" />
            {run.autoExecuted} auto-run
          </span>
          {run.pendingApproval > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-600" />
              {run.pendingApproval} pending
            </span>
          )}
        </div>
      )}

      {run.errorMessage && (
        <p className="text-xs text-red-600 bg-red-500/5 rounded px-2 py-1">
          {run.errorMessage}
        </p>
      )}

      {briefing && (
        <>
          {expanded ? (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
              {run.rawOutput?.runSummary}
              {run.rawOutput?.observationSummary && (
                <div className="mt-2 pt-2 border-t">{run.rawOutput.observationSummary}</div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground line-clamp-2">{briefing}</p>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Collapse" : "View full briefing"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AgentOpsClient({ initialRuns, initialPendingTasks }: Props) {
  const [runs, setRuns] = useState<AgentRun[]>(initialRuns);
  const [pendingTasks, setPendingTasks] = useState<AgentTask[]>(initialPendingTasks);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  async function triggerAgent() {
    setTriggering(true);
    setTriggerError(null);
    try {
      const res = await fetch("/api/agent/trigger", { method: "POST" });
      const data = await res.json() as { runId?: string; error?: string };
      if (!res.ok) {
        setTriggerError(data.error ?? "Agent run failed");
        return;
      }
      // Refresh runs
      const runsRes = await fetch("/api/agent/runs");
      if (runsRes.ok) {
        const fresh = await runsRes.json() as AgentRun[];
        setRuns(fresh);
      }
      // Refresh pending tasks
      const tasksRes = await fetch("/api/agent/tasks?status=pending");
      if (tasksRes.ok) {
        const fresh = await tasksRes.json() as AgentTask[];
        setPendingTasks(fresh);
      }
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTriggering(false);
    }
  }

  async function handleApprove(taskId: string) {
    const res = await fetch(`/api/agent/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    if (res.ok) {
      setPendingTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  async function handleReject(taskId: string) {
    const res = await fetch(`/api/agent/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    if (res.ok) {
      setPendingTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  const latestRun = runs[0] ?? null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Background portfolio operator — OBSERVE → PLAN → ACT → VERIFY → AUDIT
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 shrink-0"
          onClick={triggerAgent}
          disabled={triggering}
        >
          <Play className="h-4 w-4" />
          {triggering ? "Running…" : "Run Agent Now"}
        </Button>
      </div>

      {triggerError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-500/5 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {triggerError}
        </div>
      )}

      {/* Stats */}
      {latestRun && latestRun.status === "completed" && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{latestRun.autoExecuted}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-executed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Awaiting approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                {latestRun.confidenceScore != null
                  ? `${Math.round(latestRun.confidenceScore * 100)}%`
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Confidence</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={pendingTasks.length > 0 ? "approvals" : "history"}>
        <TabsList>
          <TabsTrigger value="approvals" className="gap-2">
            Pending Approvals
            {pendingTasks.length > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1">
                {pendingTasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-4 space-y-3">
          {pendingTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No actions awaiting your approval.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Run the agent to generate new actions.
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingTasks.map((task) => (
              <PendingTaskCard
                key={task.id}
                task={task}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {runs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bot className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No agent runs yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Run Agent Now" to start the first analysis.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Safety Tiers</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Zap className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-emerald-700">AUTO_RUN</p>
                      <p className="text-muted-foreground">Read-only ops, briefings — runs immediately</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-700">AUTO_DRAFT</p>
                      <p className="text-muted-foreground">Tenant emails, fee notices — needs your approval</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700">STRICT_BLOCK</p>
                      <p className="text-muted-foreground">Legal, eviction — surfaced only, never drafted</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {runs.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
