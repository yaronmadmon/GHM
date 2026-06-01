"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Send, Sparkles, Users } from "lucide-react";
import Link from "next/link";
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
  tenantUserId: string;
  lastMessageAt: string;
  messages: Message[];
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function draftReply() {
    if (!activeThread) return;
    setDrafting(true);
    const res = await fetch("/api/ai/message-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: activeThread.id, mode: "reply" }),
    });
    setDrafting(false);
    if (!res.ok) { toast.error("AI draft failed"); return; }
    const { result } = await res.json();
    setReply(result);
    toast.success("Draft ready — review before sending");
  }

  async function summarizeThread() {
    if (!activeThread) return;
    setSummarizing(true);
    const res = await fetch("/api/ai/message-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: activeThread.id, mode: "summarize" }),
    });
    setSummarizing(false);
    if (!res.ok) { toast.error("Summarize failed"); return; }
    const { result } = await res.json();
    setSummary(result);
  }

  useEffect(() => {
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => { setThreads(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function openThread(thread: Thread) {
    const res = await fetch(`/api/messages/${thread.id}`);
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
    const res = await fetch(`/api/messages/${activeThread.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, recipientId: activeThread.tenantUserId }),
    });
    setSending(false);
    if (!res.ok) { toast.error("Failed to send"); return; }
    const msg = await res.json();
    setActiveThread((prev) => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
    setReply("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Messages</h1>
        <Link href="/tenants">
          <Button size="sm" className="gap-2">
            <Users className="h-4 w-4" /> Message a Tenant
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
        {/* Thread list */}
        <Card className="overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 px-4 text-center">
                <MessageSquare className="h-8 w-8" />
                <p className="text-sm">No conversations yet</p>
                <Link href="/tenants" className="text-xs text-primary hover:underline">
                  Go to Tenants to start a conversation →
                </Link>
              </div>
            ) : (
              threads.map((t) => {
                const unread = t.messages?.filter((m) => !m.isRead && m.senderRole === "tenant").length ?? 0;
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
        <Card className="lg:col-span-2 flex flex-col">
          {activeThread ? (
            <>
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base truncate">{activeThread.subject}</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0 h-7 text-xs"
                    disabled={summarizing}
                    onClick={() => { setSummary(null); summarizeThread(); }}
                  >
                    {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Summarize
                  </Button>
                </div>
                {summary && (
                  <div className="mt-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-line">
                    {summary}
                    <button className="ml-2 text-primary hover:underline" onClick={() => setSummary(null)}>×</button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeThread.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.senderRole === "landlord" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${m.senderRole === "landlord" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.body}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </CardContent>
              <div className="p-4 border-t space-y-2">
                <div className="flex gap-2">
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
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs"
                  disabled={drafting}
                  onClick={draftReply}
                >
                  {drafting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {drafting ? "Drafting…" : "AI Draft Reply"}
                </Button>
              </div>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <MessageSquare className="h-10 w-10" />
              <p>Select a conversation to view messages</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
