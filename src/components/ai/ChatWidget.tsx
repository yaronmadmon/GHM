"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, X, Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm your property assistant. Ask me anything about your portfolio — tenants, payments, leases, maintenance, or finances.\n\nExamples:\n• *Who hasn't paid rent this month?*\n• *What's John Smith's balance?*\n• *How many open maintenance requests do I have?*",
      }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const apiMessages = [...messages.filter((m) => m.id !== "welcome"), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.replace("data: ", "");
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: accumulated.trimEnd() } : m)
              );
            }
            if (parsed.error) {
              accumulated = "Sorry, I encountered an error. Please try again.";
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
              );
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, I encountered an error. Please try again." } : m)
      );
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all z-50"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-2 left-2 md:left-auto md:bottom-20 md:right-6 md:w-96 h-[65vh] md:h-[560px] bg-background border rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Property Assistant</p>
              <p className="text-xs text-muted-foreground">Powered by Claude</p>
            </div>
            <Badge variant="outline" className="ml-auto text-xs text-emerald-600 border-emerald-200">Online</Badge>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={cn(
                  "rounded-2xl px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"
                )}>
                  {msg.content || (streaming && msg.role === "assistant" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your properties…"
                className="min-h-[40px] max-h-[120px] resize-none text-sm"
                disabled={streaming}
                rows={1}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </>
  );
}
