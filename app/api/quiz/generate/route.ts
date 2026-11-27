import { NextResponse } from "next/server";
import { teacherClient } from "@/lib/supabase-server";
import { generateQuestions } from "@/lib/quiz-ai";
import { weekStart } from "@/lib/quiz";
import { loadSource } from "@/lib/book-source";
import { pastItems, remember, topicKey } from "@/lib/ai-history";
import { SUBJECTS } from "@/lib/constants";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await teacherClient();
  if (!supabase) return NextResponse.json({ error: "Only ma'am can create quizzes." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { topics?: Record<string, string>; chapters?: Record<string, string>; photos?: Record<string, string[]>; count?: number };
  const jobs = SUBJECTS.filter((s) => body.topics?.[s]?.trim() || body.chapters?.[s] || body.photos?.[s]?.length).map((s) => ({ subject: s, topic: (body.topics?.[s] ?? "").trim().slice(0, 200), chapter: body.chapters?.[s] || null, photos: (body.photos?.[s] ?? []).slice(0, 12) }));
  if (!jobs.length) return NextResponse.json({ error: "Please enter a topic, pick a book chapter, or upload photos for at least one subject." }, { status: 400 });

  const COUNT = Math.max(8, Math.min(20, Math.round(Number(body.count) || 8)));
  const week = weekStart();
  const results = await Promise.all(
    jobs.map(async (j) => {
      try {
        const source = await loadSource(supabase, j.chapter, j.photos, j.topic);
        const key = topicKey(j.topic, j.chapter);
        const past = await pastItems(supabase, "quiz", j.subject, key);
        const qs = await generateQuestions(j.subject, j.topic, COUNT, past, source);
        if (qs.length < 6) throw new Error("Too few valid questions came back. Please try again.");
        const { data: quiz, error } = await supabase.from("quizzes").insert({ subject: j.subject, topic: j.topic || (j.chapter ? source?.title : "") || (j.photos.length ? "From my photos" : "") || j.subject, week_start: week, chapter_id: j.chapter, source_paths: j.photos }).select("id").single();
        if (error) throw error;
        const { error: e2 } = await supabase.from("quiz_questions").insert(
          qs.map((q, i) => ({ quiz_id: quiz.id, position: i, type: q.type, prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation })),
        );
        if (e2) { await supabase.from("quizzes").delete().eq("id", quiz.id); throw e2; }
        await remember(supabase, "quiz", j.subject, key, qs.map((q) => q.prompt));
        return { subject: j.subject, ok: true as const, count: qs.length };
      } catch (e) {
        return { subject: j.subject, ok: false as const, error: (e as Error).message };
      }
    }),
  );
  return NextResponse.json({ results });
}
