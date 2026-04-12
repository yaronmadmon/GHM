"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  email: string;
}

export function SendPortalInviteButton({ tenantId, email }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setSending(true);
    const res = await fetch("/api/portal/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSending(false);
    if (!res.ok) {
      toast.error("Failed to send invite");
      return;
    }
    setSent(true);
    toast.success(`Portal invite sent to ${email}`);
  }

  return (
    <Button
      size="sm"
      variant={sent ? "outline" : "default"}
      className="gap-2"
      onClick={handleSend}
      disabled={sending || sent}
    >
      <Send className="h-4 w-4" />
      {sent ? "Invite Sent" : sending ? "Sending..." : "Send Portal Invite"}
    </Button>
  );
}
