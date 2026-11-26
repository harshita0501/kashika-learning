import { supabase, today } from "./supabase";

export type Badge = { id: string; icon: string; name: string; hint: string; earned: boolean };
export type Stats = { streak: number; stars: number; monthPct: number | null; present: number; absent: number; badges: Badge[]; level: number; levelProgress: number };

export async function loadStats(): Promise<Stats> {
  const t = today();
  const [att, qa, sa, subs, ts, fk] = await Promise.all([
    supabase.from("attendance").select("day, status").order("day", { ascending: false }),
    supabase.from("quiz_attempts").select("score, total"),
    supabase.from("speaking_attempts").select("task_id, ai_score, teacher_score, created_at").order("created_at", { ascending: false }),
    supabase.from("submissions").select("status"),
    supabase.from("tests").select("marks_obtained, max_marks"),
    supabase.from("flashcard_progress").select("card_id").eq("known", true),
  ]);

  let streak = 0;
  for (const r of att.data ?? []) {
    if (r.status === "holiday") continue;
    if (r.status === "present") streak++; else break;
  }
  const month = (att.data ?? []).filter((r) => r.day >= t.slice(0, 8) + "01" && r.status !== "holiday");
  const present = month.filter((r) => r.status === "present").length;
  const absent = month.length - present;

  const seen = new Set<string>();
  let speakStars = 0, bestSpeak = 0;
  for (const a of sa.data ?? []) {
    if (seen.has(a.task_id)) continue;
    seen.add(a.task_id);
    const sc = a.teacher_score ?? a.ai_score ?? 0;
    speakStars += sc; bestSpeak = Math.max(bestSpeak, sc);
  }
  const quizzes = qa.data ?? [];
  const quizStars = quizzes.reduce((n, q) => n + q.score, 0);
  const stars = quizStars + speakStars + Math.floor((fk.data?.length ?? 0) / 2);
  const checked = (subs.data ?? []).filter((s) => s.status === "checked").length;
  const topper = (ts.data ?? []).some((x) => x.marks_obtained !== null && x.max_marks && x.marks_obtained / x.max_marks >= 0.9);

  const badges: Badge[] = [
    { id: "s3", icon: "🔥", name: "3-day streak", hint: "Attend 3 classes in a row", earned: streak >= 3 },
    { id: "s7", icon: "🚀", name: "7-day streak", hint: "Attend 7 classes in a row", earned: streak >= 7 },
    { id: "q1", icon: "🧠", name: "Quiz starter", hint: "Finish your first quiz", earned: quizzes.length >= 1 },
    { id: "q5", icon: "🎓", name: "Quiz master", hint: "Finish 5 quizzes", earned: quizzes.length >= 5 },
    { id: "q100", icon: "💯", name: "Perfect score", hint: "Get every answer right in a quiz", earned: quizzes.some((q) => q.total > 0 && q.score === q.total) },
    { id: "sp1", icon: "🎤", name: "Speaker", hint: "Record your first voice note", earned: seen.size >= 1 },
    { id: "sp5", icon: "🌟", name: "Star speaker", hint: "Get 5 stars on a speaking task", earned: bestSpeak >= 5 },
    { id: "hw5", icon: "📝", name: "Homework hero", hint: "Get 5 homework checked", earned: checked >= 5 },
    { id: "top", icon: "🏆", name: "Test topper", hint: "Score 90% or more in a test", earned: topper },
  ];
  const words = fk.data?.length ?? 0;
  badges.push({ id: "w10", icon: "🃏", name: "Word wizard", hint: "Learn 10 flashcard words", earned: words >= 10 });
  const level = Math.floor(stars / 25) + 1;
  return { streak, stars, monthPct: month.length ? Math.round((present / month.length) * 100) : null, present, absent, badges, level, levelProgress: (stars % 25) / 25 };
}
