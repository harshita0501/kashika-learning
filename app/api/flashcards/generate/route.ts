import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateCards } from "@/lib/flashcards-ai";
import { weekStart } from "@/lib/quiz";
import { loadSource } from "@/lib/book-source";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can create flashcards." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  const { topic, chapter_id, photos = [], count } = (await req.json().catch(() => ({}))) as { topic?: string; chapter_id?: string; photos?: string[]; count?: number };
  try {
    const source = await loadSource(supabase, chapter_id, photos.slice(0, 12), topic);
    const out = await generateCards((topic ?? "").slice(0, 200), Math.max(8, Math.min(20, Math.round(Number(count) || 8))), [], source);
    if (out.cards.length < 6) throw new Error("Too few valid cards came back. Please try again.");
    const { data: set, error } = await supabase.from("flashcard_sets").insert({ topic: out.topic, week_start: weekStart(), chapter_id: chapter_id || null, source_paths: photos.slice(0, 12) }).select("id").single();
    if (error) throw error;
    const { error: e2 } = await supabase.from("flashcards").insert(out.cards.map((c, i) => ({ set_id: set.id, position: i, ...c })));
    if (e2) { await supabase.from("flashcard_sets").delete().eq("id", set.id); throw e2; }
    return NextResponse.json({ ok: true, id: set.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
