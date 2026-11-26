import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateTasks } from "@/lib/speaking-ai";
import { loadSource } from "@/lib/book-source";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can change speaking practice." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  const { set_id, count } = (await req.json().catch(() => ({}))) as { set_id?: string; count?: number };
  const n = Math.max(1, Math.min(6, Math.round(Number(count) || 0)));
  if (!set_id) return NextResponse.json({ error: "Missing set." }, { status: 400 });
  const { data: set } = await supabase.from("speaking_sets").select("topic, chapter_id, source_paths").eq("id", set_id).single();
  if (!set) return NextResponse.json({ error: "Set not found." }, { status: 404 });
  const { data: have } = await supabase.from("speaking_tasks").select("prompt, position").eq("set_id", set_id);
  if ((have?.length ?? 0) + n > 12) return NextResponse.json({ error: "A speaking set can have at most 12 tasks." }, { status: 400 });
  try {
    const source = await loadSource(supabase, set.chapter_id, set.source_paths ?? [], set.topic);
    const out = await generateTasks(set.topic, n, (have ?? []).map((h) => h.prompt), undefined, source);
    if (!out.tasks.length) throw new Error("Could not make new tasks. Please try again.");
    const start = Math.max(-1, ...(have ?? []).map((h) => h.position)) + 1;
    const { error } = await supabase.from("speaking_tasks").insert(out.tasks.map((t, i) => ({ set_id, position: start + i, kind: t.kind, prompt: t.prompt, target: t.target, hint: t.hint })));
    if (error) throw error;
    return NextResponse.json({ ok: true, added: out.tasks.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
