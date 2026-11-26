import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateQuestions } from "@/lib/quiz-ai";
import { weekStart } from "@/lib/quiz";
import { SUBJECTS } from "@/lib/constants";

export const maxDuration = 120;
const COUNT = 8;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can create quizzes." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { topics?: Record<string, string> };
  const jobs = SUBJECTS.filter((s) => body.topics?.[s]?.trim()).map((s) => ({ subject: s, topic: body.topics![s].trim().slice(0, 200) }));
  if (!jobs.length) return NextResponse.json({ error: "Please enter at least one topic." }, { status: 400 });

  const week = weekStart();
  const results = await Promise.all(
    jobs.map(async (j) => {
      try {
        const qs = await generateQuestions(j.subject, j.topic, COUNT);
        if (qs.length < 3) throw new Error("Too few valid questions came back. Please try again.");
        const { data: quiz, error } = await supabase.from("quizzes").insert({ subject: j.subject, topic: j.topic, week_start: week }).select("id").single();
        if (error) throw error;
        const { error: e2 } = await supabase.from("quiz_questions").insert(
          qs.map((q, i) => ({ quiz_id: quiz.id, position: i, type: q.type, prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation })),
        );
        if (e2) { await supabase.from("quizzes").delete().eq("id", quiz.id); throw e2; }
        return { subject: j.subject, ok: true as const, count: qs.length };
      } catch (e) {
        return { subject: j.subject, ok: false as const, error: (e as Error).message };
      }
    }),
  );
  return NextResponse.json({ results });
}
