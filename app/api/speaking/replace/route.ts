import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateTasks } from "@/lib/speaking-ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can change speaking practice." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  const { task_id } = (await req.json().catch(() => ({}))) as { task_id?: string };
  if (!task_id) return NextResponse.json({ error: "Missing task." }, { status: 400 });
  const { data: t } = await supabase.from("speaking_tasks").select("id, set_id, kind").eq("id", task_id).single();
  if (!t) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  const [{ data: set }, { data: others }] = await Promise.all([
    supabase.from("speaking_sets").select("topic").eq("id", t.set_id).single(),
    supabase.from("speaking_tasks").select("prompt").eq("set_id", t.set_id),
  ]);
  try {
    const out = await generateTasks(set?.topic ?? "", 1, (others ?? []).map((o) => o.prompt), t.kind);
    const n = out.tasks[0];
    if (!n) throw new Error("Could not make a new task. Please try again.");
    const { error } = await supabase.from("speaking_tasks").update({ kind: n.kind, prompt: n.prompt, target: n.target, hint: n.hint }).eq("id", t.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
