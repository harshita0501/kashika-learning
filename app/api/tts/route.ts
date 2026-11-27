import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { serverClient } from "@/lib/supabase-server";

export const maxDuration = 30;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Natural voice for "Listen". Needs AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (free tier is enough); otherwise returns 501
 * and the app falls back to the device voice. Each sentence is synthesised once and cached in storage.
 */
export async function POST(req: Request) {
  const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return NextResponse.json({ error: "neural voice not configured" }, { status: 501 });

  const supabase = await serverClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const clean = (text ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!clean) return NextResponse.json({ error: "No text." }, { status: 400 });

  const voice = process.env.TTS_VOICE || "en-IN-NeerjaNeural";
  const rate = process.env.TTS_RATE || "-6%";
  const hash = createHash("sha1").update(`${voice}|${rate}|${clean}`).digest("hex");
  const path = `tts/${hash}.mp3`;

  const cached = await supabase.storage.from("uploads").createSignedUrl(path, 3600 * 6);
  if (cached.data?.signedUrl) return NextResponse.json({ url: cached.data.signedUrl });

  const lang = voice.split("-").slice(0, 2).join("-");
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${esc(voice)}"><prosody rate="${esc(rate)}">${esc(clean)}</prosody></voice></speak>`;
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "kashika-learning" },
    body: ssml,
  });
  if (!r.ok) return NextResponse.json({ error: `voice service said ${r.status}` }, { status: 502 });
  const bytes = new Uint8Array(await r.arrayBuffer());

  const up = await supabase.storage.from("uploads").upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
  if (up.error) return NextResponse.json({ error: "could not save audio" }, { status: 500 });
  const signed = await supabase.storage.from("uploads").createSignedUrl(path, 3600 * 6);
  return NextResponse.json({ url: signed.data?.signedUrl });
}
