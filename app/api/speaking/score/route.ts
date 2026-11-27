import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase-server";
import { scoreSpeech } from "@/lib/speaking-ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await serverClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { task_id?: string; transcript?: string; audio_path?: string };
  if (!body.task_id) return NextResponse.json({ error: "Missing task." }, { status: 400 });
  const transcript = (body.transcript ?? "").trim().slice(0, 600);
  const audio_path = body.audio_path && /^speaking\/[\w./-]+$/.test(body.audio_path) ? body.audio_path : null;

  const { data: task } = await supabase.from("speaking_tasks").select("id, kind, prompt, target").eq("id", body.task_id).single();
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

  let ai_score: number | null = null;
  let mistakes: unknown[] = [];
  let improved = "";
  let ai_feedback = "Ma'am will listen to your recording and give you marks. Well done for speaking!";
  if (transcript && process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await scoreSpeech(task, transcript);
      ai_score = r.score;
      ai_feedback = r.feedback;
      mistakes = r.mistakes;
      improved = r.improved;
    } catch {
      ai_feedback = "Ma'am will listen to your recording and give you marks. Well done for speaking!";
    }
  }
  const { data, error } = await supabase.from("speaking_attempts")
    .insert({ task_id: task.id, audio_path, transcript, ai_score, ai_feedback, mistakes, improved }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ attempt: data });
}
