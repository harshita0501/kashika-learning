import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateCards } from "@/lib/flashcards-ai";
import { loadSource } from "@/lib/book-source";
import { pastItems, remember, topicKey } from "@/lib/ai-history";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can change flashcards." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  const { set_id, count } = (await req.json().catch(() => ({}))) as { set_id?: string; count?: number };
  const n = Math.max(1, Math.min(10, Math.round(Number(count) || 0)));
  if (!set_id) return NextResponse.json({ error: "Missing set." }, { status: 400 });
  const { data: set } = await supabase.from("flashcard_sets").select("topic, chapter_id, source_paths").eq("id", set_id).single();
  if (!set) return NextResponse.json({ error: "Set not found." }, { status: 404 });
  const { data: have } = await supabase.from("flashcards").select("word, position").eq("set_id", set_id);
  if ((have?.length ?? 0) + n > 30) return NextResponse.json({ error: "A set can have at most 30 cards." }, { status: 400 });
  try {
    const source = await loadSource(supabase, set.chapter_id, set.source_paths ?? [], set.topic);
    const key = topicKey(set.topic, set.chapter_id);
    const past = await pastItems(supabase, "flashcards", "", key);
    const out = await generateCards(set.topic, n, [...(have ?? []).map((h) => h.word), ...past], source);
    if (!out.cards.length) throw new Error("Could not make new cards. Please try again.");
    const start = Math.max(-1, ...(have ?? []).map((h) => h.position)) + 1;
    const { error } = await supabase.from("flashcards").insert(out.cards.map((c, i) => ({ set_id, position: start + i, ...c })));
    if (error) throw error;
    await remember(supabase, "flashcards", "", key, out.cards.map((c) => c.word));
    return NextResponse.json({ ok: true, added: out.cards.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
