"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Wrench, MessageSquare, Send } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const PRIORITY_STYLES: Record<string, string> = {
  emergency: "bg-red-500 text-white",
  high: "bg-orange-500/10 text-orange-700 border-orange-200",
  medium: "bg-amber-500/10 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-700 border-blue-200",
  in_progress: "bg-amber-500/10 text-amber-700 border-amber-200",
  pending_parts: "bg-purple-500/10 text-purple-700 border-purple-200",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUSES = ["open", "in_progress", "pending_parts", "completed", "cancelled"];

export default function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/maintenance/${id}`).then((r) => r.json()).then(setRequest).catch(() => {});
  }, [id]);

  async function updateStatus(status: string) {
    setUpdating(true);
    const res = await fetch(`/api/maintenance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(false);
    if (!res.ok) { toast.error("Failed to update"); return; }
    setRequest((r: any) => ({ ...r, status }));
    toast.success("Status updated");
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/maintenance/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment }),
    });
    setPosting(false);
    if (!res.ok) { toast.error("Failed to post comment"); return; }
    const newComment = await res.json();
    setRequest((r: any) => ({ ...r, comments: [...(r.comments ?? []), newComment] }));
    setComment("");
  }

  if (!request) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/maintenance">
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold truncate">{request.title}</h1>
          <p className="text-sm text-muted-foreground">
            {request.property?.name}{request.unit ? ` · Unit ${request.unit.unitNumber}` : ""}
          </p>
        </div>
        <Badge className={`border shrink-0 ${PRIORITY_STYLES[request.priority] ?? ""}`}>{request.priority}</Badge>
      </div>

      {/* Status + update */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wrench className="h-4 w-4" />Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-24 shrink-0">Status</span>
            <Select value={request.status} onValueChange={updateStatus} disabled={updating}>
              <SelectTrigger className="h-8 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-24 shrink-0">Category</span>
            <span className="capitalize">{request.category ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-24 shrink-0">Vendor</span>
            <span>{request.assignedVendor?.name ?? "—"}</span>
          </div>
          {request.estimatedCost && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-24 shrink-0">Est. Cost</span>
              <span>${Number(request.estimatedCost).toFixed(2)}</span>
            </div>
          )}
          {request.actualCost && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-24 shrink-0">Actual Cost</span>
              <span>${Number(request.actualCost).toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-24 shrink-0">Reported by</span>
            <span>{request.reportedByTenant ? `${request.reportedByTenant.firstName} ${request.reportedByTenant.lastName}` : "Landlord"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-24 shrink-0">Created</span>
            <span>{formatDate(request.createdAt)}</span>
          </div>
          {request.resolvedAt && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-24 shrink-0">Resolved</span>
              <span>{formatDate(request.resolvedAt)}</span>
            </div>
          )}
          {request.description && (
            <div className="pt-2 border-t">
              <p className="text-muted-foreground text-xs mb-1">Description</p>
              <p className="whitespace-pre-wrap">{request.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      {request.photos?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {request.photos.map((photo: any) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
              <img src={photo.url} alt="Maintenance photo" className="rounded-lg w-full h-32 object-cover hover:opacity-90 transition-opacity" />
            </a>
          ))}
        </div>
      )}

      {/* Comments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />Comments ({request.comments?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {request.comments?.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}
          {request.comments?.map((c: any) => (
            <div key={c.id} className="text-sm">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium">{c.author?.name ?? "You"}</span>
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}

          <form onSubmit={postComment} className="flex gap-2 pt-2 border-t">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="resize-none text-sm"
            />
            <Button type="submit" size="icon" disabled={posting || !comment.trim()} className="self-end shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
