import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateCards } from "@/lib/flashcards-ai";
import { weekStart } from "@/lib/quiz";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can create flashcards." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  const { topic } = (await req.json().catch(() => ({}))) as { topic?: string };
  try {
    const out = await generateCards((topic ?? "").slice(0, 200), 10);
    if (out.cards.length < 4) throw new Error("Too few valid cards came back. Please try again.");
    const { data: set, error } = await supabase.from("flashcard_sets").insert({ topic: out.topic, week_start: weekStart() }).select("id").single();
    if (error) throw error;
    const { error: e2 } = await supabase.from("flashcards").insert(out.cards.map((c, i) => ({ set_id: set.id, position: i, ...c })));
    if (e2) { await supabase.from("flashcard_sets").delete().eq("id", set.id); throw e2; }
    return NextResponse.json({ ok: true, id: set.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
