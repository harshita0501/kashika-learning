import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateTasks } from "@/lib/speaking-ai";
import { weekStart } from "@/lib/quiz";
import { loadSource } from "@/lib/book-source";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can create speaking practice." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  const { topic, chapter_id, photos = [] } = (await req.json().catch(() => ({}))) as { topic?: string; chapter_id?: string; photos?: string[] };
  try {
    const source = await loadSource(supabase, chapter_id, photos.slice(0, 12), topic);
    const out = await generateTasks((topic ?? "").slice(0, 200), 4, [], undefined, source);
    if (out.tasks.length < 2) throw new Error("Too few valid tasks came back. Please try again.");
    const { data: set, error } = await supabase.from("speaking_sets").insert({ topic: out.topic, week_start: weekStart(), chapter_id: chapter_id || null, source_paths: photos.slice(0, 12) }).select("id").single();
    if (error) throw error;
    const { error: e2 } = await supabase.from("speaking_tasks").insert(out.tasks.map((t, i) => ({ set_id: set.id, position: i, kind: t.kind, prompt: t.prompt, target: t.target, hint: t.hint })));
    if (e2) { await supabase.from("speaking_sets").delete().eq("id", set.id); throw e2; }
    return NextResponse.json({ ok: true, id: set.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
