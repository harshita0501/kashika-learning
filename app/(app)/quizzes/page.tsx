"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, SUBJECT_STYLE } from "@/lib/constants";
import type { Quiz, Attempt } from "@/lib/quiz";

const PLACEHOLDER: Record<string, string> = {
  Hindi: "e.g. vilom shabd / matraen",
  English: "e.g. prepositions, articles",
  EVS: "e.g. road transport",
  Maths: "e.g. division",
  Science: "e.g. solar system",
};

export default function Quizzes() {
  const me = useMe();
  const [quizzes, setQuizzes] = useState<(Quiz & { n: number })[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [q, a] = await Promise.all([
      supabase.from("quizzes").select("*, quiz_questions(count)").order("created_at", { ascending: false }),
      supabase.from("quiz_attempts").select("*").order("submitted_at", { ascending: false }),
    ]);
    setQuizzes((q.data ?? []).map((x) => ({ ...(x as Quiz), n: (x as { quiz_questions: { count: number }[] }).quiz_questions?.[0]?.count ?? 0 })));
    setAttempts((a.data ?? []) as Attempt[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setMsg([]);
    try {
      const res = await fetch("/api/quiz/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      setMsg(j.results.map((r: { subject: string; ok: boolean; count?: number; error?: string }) =>
        ({ ok: r.ok, text: r.ok ? `${r.subject}: ${r.count} questions ready for review` : `${r.subject}: ${r.error}` })));
      setTopics({});
      load();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  const latest = (id: string) => attempts.find((a) => a.quiz_id === id);
  const weeks = [...new Set(quizzes.map((q) => q.week_start))];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🧠 Weekly Quizzes</h1>

      {me.role === "teacher" && (
        <form onSubmit={generate} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <h2 className="font-semibold">✨ Make this week&apos;s quizzes</h2>
          <p className="text-sm text-gray-600">Write a topic for each subject (leave blank to skip). The AI will draft the quiz and you can review it before giving it to Kashika.</p>
          {SUBJECTS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <span className={`w-20 text-center text-xs px-2 py-1 rounded-full font-semibold ${SUBJECT_STYLE[s]}`}>{s}</span>
              <input value={topics[s] ?? ""} onChange={(e) => setTopics({ ...topics, [s]: e.target.value })} placeholder={PLACEHOLDER[s]}
                className="flex-1 border rounded-xl px-3 py-2" disabled={busy} />
            </label>
          ))}
          <button disabled={busy} className="bg-indigo-600 text-white rounded-xl px-5 py-2 font-semibold disabled:opacity-50">
            {busy ? "Making quizzes… (about a minute)" : "Create quizzes"}
          </button>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          {msg.map((m, i) => <p key={i} className={`text-sm ${m.ok ? "text-green-700" : "text-red-600"}`}>{m.ok ? "✓" : "✗"} {m.text}</p>)}
        </form>
      )}

      {quizzes.length === 0 && <p className="text-gray-500">{me.role === "teacher" ? "No quizzes yet." : "No quiz assigned yet."}</p>}

      {weeks.map((w) => (
        <section key={w} className="space-y-2">
          <h2 className="font-bold text-gray-700">Week of {w}</h2>
          {quizzes.filter((q) => q.week_start === w).map((q) => {
            const a = latest(q.id);
            return (
              <Link key={q.id} href={`/quizzes/${q.id}`} className="block bg-white rounded-2xl p-4 shadow-sm active:scale-[.99] transition">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${SUBJECT_STYLE[q.subject]}`}>{q.subject}</span>
                  {me.role === "teacher" && (
                    <span className={`text-xs px-2 py-1 rounded-full ${q.status === "draft" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                      {q.status === "draft" ? "Draft — needs review" : "Assigned"}
                    </span>
                  )}
                  <span className="ml-auto text-sm font-semibold">
                    {a ? `⭐ ${a.score}/${a.total}` : me.role === "student" ? "Start →" : q.status === "assigned" ? "Not attempted" : ""}
                  </span>
                </div>
                <div className="font-bold mt-1">{q.topic}</div>
                <div className="text-xs text-gray-500">{q.n} questions</div>
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
