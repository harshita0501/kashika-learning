import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateQuestions } from "@/lib/quiz-ai";
import { loadSource } from "@/lib/book-source";
import { pastItems, remember, topicKey } from "@/lib/ai-history";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can change quizzes." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });

  const { question_id } = (await req.json().catch(() => ({}))) as { question_id?: string };
  if (!question_id) return NextResponse.json({ error: "Missing question." }, { status: 400 });

  const { data: q } = await supabase.from("quiz_questions").select("id, quiz_id, position").eq("id", question_id).single();
  if (!q) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  const { data: quiz } = await supabase.from("quizzes").select("subject, topic, chapter_id, source_paths").eq("id", q.quiz_id).single();
  const { data: others } = await supabase.from("quiz_questions").select("prompt").eq("quiz_id", q.quiz_id);
  if (!quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });

  try {
    const source = await loadSource(supabase, quiz.chapter_id, quiz.source_paths ?? [], quiz.topic);
    const key = topicKey(quiz.topic, quiz.chapter_id);
    const past = await pastItems(supabase, "quiz", quiz.subject, key);
    const [n] = await generateQuestions(quiz.subject, quiz.topic, 1, [...(others ?? []).map((o) => o.prompt), ...past], source);
    if (!n) throw new Error("Could not make a new question. Please try again.");
    const { error } = await supabase.from("quiz_questions").update({ type: n.type, prompt: n.prompt, options: n.options, answer: n.answer, explanation: n.explanation }).eq("id", q.id);
    if (error) throw error;
    await remember(supabase, "quiz", quiz.subject, key, [n.prompt]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
