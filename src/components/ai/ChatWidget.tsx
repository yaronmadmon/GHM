"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, X, Send, Bot, User, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

// Web Speech API types (not always in TS default lib)
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  abort(): void;
  onstart: ((e: Event) => void) | null;
  onend: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
  onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Strip markdown for clean TTS output
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[•\-]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
  utterance.rate = 1.05;
  utterance.pitch = 1;
  // Prefer a natural-sounding voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) =>
    /google us english|samantha|karen|daniel|moira|fiona/i.test(v.name)
  ) ?? voices.find((v) => v.lang.startsWith("en") && !v.name.toLowerCase().includes("zira"));
  if (preferred) utterance.voice = preferred;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const voiceOutRef = useRef(voiceOut);
  voiceOutRef.current = voiceOut;

  // Check browser support on mount
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRec && !!window.speechSynthesis);

    // Pre-load voices (some browsers need this)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      const welcome = "Hi! I'm your property assistant with full control over your portfolio. I can read data and take actions — ask me anything or use the mic to speak.";
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm your property assistant with full control over your portfolio. I can read data and take actions.\n\nExamples:\n• *What's John Smith's balance?*\n• *Add a maintenance request for 123 Main — leaking roof, high priority*\n• *Send a message to Sarah Johnson about her lease renewal*\n• *Create a tenant: Mike Lee, mike@example.com*\n• *Add a vendor: Bob's Plumbing, phone 555-0100*\n• *Record a $1,500 payment from John Smith*\n• *Mark the kitchen faucet request as in progress*",
      }]);
      if (voiceOutRef.current) speak(welcome);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Stop TTS when panel closes
  useEffect(() => {
    if (!open) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      stopListening();
    }
  }, [open]);

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setListening(false);
  }

  const toggleMic = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }

    const SpeechRec = window.SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    window.speechSynthesis?.cancel();
    setSpeaking(false);

    const recognition = new SpeechRec() as ISpeechRecognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (e) => {
      const results = e.results as { [i: number]: { [i: number]: { transcript: string } } };
      const transcript = Object.values(results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(transcript);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      // Auto-send if there's a result
      setInput((current) => {
        if (current.trim()) {
          // Trigger send on next tick so state is flushed
          setTimeout(() => sendMessageRef.current?.(), 50);
        }
        return current;
      });
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [listening]);

  // Use a ref so the recognition onend closure can call the latest sendMessage
  const sendMessageRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

    stopListening();
    window.speechSynthesis?.cancel();
    setSpeaking(false);

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
              accumulated = `Error: ${parsed.error}`;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
              );
            }
          } catch {}
        }
      }

      // Speak the completed response
      if (voiceOutRef.current && accumulated) {
        setSpeaking(true);
        speak(accumulated, () => setSpeaking(false));
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, I encountered an error. Please try again." } : m)
      );
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages]);

  // Keep ref in sync with latest sendMessage
  useEffect(() => {
    sendMessageRef.current = () => sendMessage();
  }, [sendMessage]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function toggleVoiceOut() {
    const next = !voiceOut;
    setVoiceOut(next);
    if (!next) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
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
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center transition-all",
              speaking ? "bg-primary/20 ring-2 ring-primary/40 animate-pulse" : "bg-primary/10"
            )}>
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Property Assistant</p>
              <p className="text-xs text-muted-foreground">
                {speaking ? "Speaking…" : streaming ? "Thinking…" : listening ? "Listening…" : "Powered by Claude"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {/* Voice output toggle */}
              {speechSupported && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", voiceOut ? "text-primary" : "text-muted-foreground")}
                  onClick={toggleVoiceOut}
                  title={voiceOut ? "Mute assistant voice" : "Enable assistant voice"}
                >
                  {voiceOut ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              )}
              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">Online</Badge>
            </div>
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
          <div className="p-3 border-t space-y-2">
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? "Listening… speak now" : "Ask anything or tap the mic…"}
                className={cn("min-h-[40px] max-h-[120px] resize-none text-sm transition-colors", listening && "border-primary ring-1 ring-primary")}
                disabled={streaming}
                rows={1}
              />
              {/* Mic button */}
              {speechSupported && (
                <Button
                  size="icon"
                  variant={listening ? "default" : "outline"}
                  className={cn("h-10 w-10 shrink-0 transition-all", listening && "animate-pulse bg-red-500 hover:bg-red-600 border-red-500")}
                  onClick={toggleMic}
                  disabled={streaming}
                  title={listening ? "Stop listening" : "Speak your message"}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              {/* Send button */}
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {speechSupported
                ? "Enter to send · Tap mic to speak · AI voice " + (voiceOut ? "on" : "off")
                : "Enter to send · Shift+Enter for new line"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
