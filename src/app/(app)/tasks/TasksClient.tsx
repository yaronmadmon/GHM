"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  relatedType: string | null;
  relatedId: string | null;
  tenantId: string | null;
  propertyId: string | null;
  createdByAI: boolean;
  createdAt: string;
};

const STATUS_FILTERS = ["all", "open", "in_progress", "waiting", "done", "cancelled"];
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 border-red-200",
  high: "bg-orange-500/10 text-orange-600 border-orange-200",
  medium: "bg-amber-500/10 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground",
};

function statusIcon(status: string) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "cancelled") return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
  if (status === "in_progress") return <Clock className="h-4 w-4 text-blue-500" />;
  if (status === "waiting") return <Clock className="h-4 w-4 text-amber-500" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function isDueOrOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) <= new Date();
}

export function TasksClient({ initialTasks }: { initialTasks: TaskRow[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Create form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    relatedType: "",
    relatedId: "",
  });
  const [creating, setCreating] = useState(false);

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setCreating(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description || undefined,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        relatedType: form.relatedType || undefined,
        relatedId: form.relatedId || undefined,
      }),
    });
    setCreating(false);
    if (!res.ok) { toast.error("Failed to create task"); return; }
    const task = await res.json();
    setTasks((prev) => [{ ...task, dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null, createdAt: new Date(task.createdAt).toISOString() }, ...prev]);
    setForm({ title: "", description: "", priority: "medium", dueDate: "", relatedType: "", relatedId: "" });
    setDialogOpen(false);
    toast.success("Task created");
  }

  async function handleStatusToggle(task: TaskRow) {
    const newStatus = task.status === "done" ? "open" : "done";
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { toast.error("Failed to update task"); return; }
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
  }

  async function handleDelete(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete task"); return; }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast.success("Task deleted");
  }

  const openCount = tasks.filter((t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting").length;
  const dueCount = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && isDueOrOverdue(t.dueDate)).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {openCount} open{dueCount > 0 && ` · ${dueCount} overdue`}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add Task
          </Button>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input placeholder="e.g. Call tenant about lease renewal" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input placeholder="Optional details" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v ?? "medium" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={creating} size="sm">{creating ? "Saving..." : "Create Task"}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
            >
              {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v ?? "all")}>
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">{tasks.length === 0 ? "No tasks yet" : "No tasks match these filters"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tasks.length === 0 ? "Create your first task to get started." : "Try clearing the filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const overdue = task.status !== "done" && task.status !== "cancelled" && isDueOrOverdue(task.dueDate);
            return (
              <Card key={task.id} className={task.status === "done" ? "opacity-60" : ""}>
                <CardContent className="flex items-start gap-3 py-3">
                  <button
                    onClick={() => handleStatusToggle(task)}
                    className="mt-0.5 shrink-0 hover:scale-110 transition-transform"
                    title={task.status === "done" ? "Mark open" : "Mark done"}
                  >
                    {statusIcon(task.status)}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                      {task.createdByAI && <span className="ml-1.5 text-xs text-primary/60">AI</span>}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <Badge className={`text-xs border ${PRIORITY_COLORS[task.priority] ?? ""}`}>
                        {task.priority}
                      </Badge>
                      {task.dueDate && (
                        <span className={`flex items-center gap-1 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {overdue && <AlertTriangle className="h-3 w-3" />}
                          {formatDate(new Date(task.dueDate))}
                        </span>
                      )}
                      {task.relatedType && (
                        <span className="text-xs text-muted-foreground capitalize">{task.relatedType}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                    title="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
