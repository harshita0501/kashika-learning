import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateQuestions } from "@/lib/quiz-ai";
import { loadSource } from "@/lib/book-source";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can change quizzes." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  const { quiz_id, count } = (await req.json().catch(() => ({}))) as { quiz_id?: string; count?: number };
  const n = Math.max(1, Math.min(10, Math.round(Number(count) || 0)));
  if (!quiz_id) return NextResponse.json({ error: "Missing quiz." }, { status: 400 });
  const { data: quiz } = await supabase.from("quizzes").select("subject, topic, chapter_id, source_paths").eq("id", quiz_id).single();
  if (!quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  const { data: have } = await supabase.from("quiz_questions").select("prompt, position").eq("quiz_id", quiz_id);
  if ((have?.length ?? 0) + n > 30) return NextResponse.json({ error: "A quiz can have at most 30 questions." }, { status: 400 });
  try {
    const source = await loadSource(supabase, quiz.chapter_id, quiz.source_paths ?? [], quiz.topic);
    const qs = await generateQuestions(quiz.subject, quiz.topic, n, (have ?? []).map((h) => h.prompt), source);
    if (!qs.length) throw new Error("Could not make new questions. Please try again.");
    const start = Math.max(-1, ...(have ?? []).map((h) => h.position)) + 1;
    const { error } = await supabase.from("quiz_questions").insert(qs.map((q, i) => ({ quiz_id, position: start + i, type: q.type, prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation })));
    if (error) throw error;
    return NextResponse.json({ ok: true, added: qs.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
