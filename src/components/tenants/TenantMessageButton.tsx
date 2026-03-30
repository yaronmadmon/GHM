"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantUserId: string;
  tenantName: string;
  existingThreadId?: string;
  landlordUserId: string;
}

export function TenantMessageButton({ tenantUserId, tenantName, existingThreadId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setSending(true);

    if (existingThreadId) {
      // Reply to existing thread
      const res = await fetch(`/api/messages/${existingThreadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, recipientId: tenantUserId }),
      });
      setSending(false);
      if (!res.ok) { toast.error("Failed to send"); return; }
      toast.success("Message sent");
      setOpen(false);
      setBody("");
      router.push("/messages");
    } else {
      // Create new thread
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim() || `Message to ${tenantName}`,
          tenantUserId,
          body,
        }),
      });
      setSending(false);
      if (!res.ok) { toast.error("Failed to send"); return; }
      toast.success("Message sent");
      setOpen(false);
      setSubject("");
      setBody("");
      router.push("/messages");
    }
  }

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <MessageSquare className="h-4 w-4" />
        Message
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message {tenantName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!existingThreadId && (
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={`Message to ${tenantName}`}
                />
              </div>
            )}
            {existingThreadId && (
              <p className="text-sm text-muted-foreground">
                Sending to existing conversation thread.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) send(); }}
              />
              <p className="text-xs text-muted-foreground">⌘↵ to send</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={send} disabled={sending || !body.trim()} className="flex-1">
                {sending ? "Sending..." : "Send Message"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
