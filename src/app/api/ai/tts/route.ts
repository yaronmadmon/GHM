import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import OpenAI from "openai";

export const maxDuration = 30;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export async function POST(req: NextRequest) {
  try {
    await requireOrg();
    const { text } = await req.json();
    if (!text?.trim()) return Response.json({ error: "No text" }, { status: 400 });

    const cleaned = stripMarkdown(text).slice(0, 4096);

    const mp3 = await client.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: cleaned,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
