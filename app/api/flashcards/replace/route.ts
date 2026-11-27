import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateCards } from "@/lib/flashcards-ai";
import { loadSource } from "@/lib/book-source";
import { pastItems, remember, topicKey } from "@/lib/ai-history";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can change flashcards." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  const { card_id } = (await req.json().catch(() => ({}))) as { card_id?: string };
  if (!card_id) return NextResponse.json({ error: "Missing card." }, { status: 400 });
  const { data: c } = await supabase.from("flashcards").select("id, set_id").eq("id", card_id).single();
  if (!c) return NextResponse.json({ error: "Card not found." }, { status: 404 });
  const [{ data: set }, { data: others }] = await Promise.all([
    supabase.from("flashcard_sets").select("topic, chapter_id, source_paths").eq("id", c.set_id).single(),
    supabase.from("flashcards").select("word").eq("set_id", c.set_id),
  ]);
  try {
    const source = await loadSource(supabase, set?.chapter_id, set?.source_paths ?? [], set?.topic ?? "");
    const key = topicKey(set?.topic, set?.chapter_id);
    const past = await pastItems(supabase, "flashcards", "", key);
    const out = await generateCards(set?.topic ?? "", 1, [...(others ?? []).map((o) => o.word), ...past], source);
    const n = out.cards[0];
    if (!n) throw new Error("Could not make a new card. Please try again.");
    const { error } = await supabase.from("flashcards").update(n).eq("id", c.id);
    if (error) throw error;
    await remember(supabase, "flashcards", "", key, [n.word]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
