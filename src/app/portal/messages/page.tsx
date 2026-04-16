"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, ArrowLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  senderId: string;
  senderRole: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface Thread {
  id: string;
  subject: string;
  landlordUserId: string;
  lastMessageAt: string;
  messages: Message[];
}

export default function PortalMessagesPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/portal/messages")
      .then((r) => {
        if (r.status === 401) { router.push("/portal/login"); return null; }
        return r.json();
      })
      .then((d) => { if (d) { setThreads(Array.isArray(d) ? d : []); } setLoading(false); })
      .catch(() => { router.push("/portal/login"); });
  }, [router]);

  async function openThread(thread: Thread) {
    const res = await fetch(`/api/portal/messages/${thread.id}`);
    if (res.status === 401) { router.push("/portal/login"); return; }
    if (res.ok) {
      const data = await res.json();
      setActiveThread(data);
      setThreads((prev) => prev.map((t) => t.id === thread.id ? { ...t, messages: data.messages } : t));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  async function sendReply() {
    if (!activeThread || !reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/portal/messages/${activeThread.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    setSending(false);
    if (!res.ok) { toast.error("Failed to send"); return; }
    const msg = await res.json();
    setActiveThread((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
    setReply("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Loading messages...
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <h1 className="font-semibold">Messages</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
          {/* Thread list */}
          <Card className="overflow-y-auto">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 px-4 text-center">
                  <MessageSquare className="h-8 w-8" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs">Your landlord can start a conversation with you.</p>
                </div>
              ) : (
                threads.map((t) => {
                  const unread = t.messages?.filter((m) => !m.isRead && m.senderRole === "landlord").length ?? 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => openThread(t)}
                      className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors ${activeThread?.id === t.id ? "bg-muted" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">{t.subject}</p>
                        {unread > 0 && <Badge variant="destructive" className="shrink-0 h-4 px-1 text-xs">{unread}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(new Date(t.lastMessageAt))}</p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Message view */}
          <Card className="md:col-span-2 flex flex-col">
            {activeThread ? (
              <>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-base">{activeThread.subject}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activeThread.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.senderRole === "tenant" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${m.senderRole === "tenant" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {m.body}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </CardContent>
                <div className="p-4 border-t flex gap-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type a reply..."
                    className="resize-none"
                    rows={2}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()} size="icon" className="self-end">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <MessageSquare className="h-10 w-10" />
                <p>Select a conversation to read messages</p>
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
