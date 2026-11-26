"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase, uploadFile } from "@/lib/supabase";
import FileInput from "@/components/FileInput";
import { useMe } from "@/lib/session";
import { SUBJECTS, subjectMeta } from "@/lib/constants";
import type { Quiz, Attempt } from "@/lib/quiz";
import { Empty, ErrorBox, PageTitle, SubjectChip, Tabs } from "@/components/ui";
import { useTodo } from "@/lib/todo";
import { useChapters } from "@/lib/chapters";
import ChapterSelect from "@/components/ChapterSelect";

const PLACEHOLDER: Record<string, string> = {
  Hindi: "e.g. vilom shabd / matraen", English: "e.g. prepositions, articles", EVS: "e.g. road transport", Maths: "e.g. division", Science: "e.g. solar system",
};

export default function Quizzes() {
  const me = useMe();
  const todo = useTodo();
  const [quizzes, setQuizzes] = useState<(Quiz & { n: number })[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [chap, setChap] = useState<Record<string, string>>({});
  const chapters = useChapters();
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }[]>([]);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"new" | "done">("new");

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
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const photos: Record<string, string[]> = {};
      for (const s of SUBJECTS) {
        const files = (fd.getAll("photos_" + s) as File[]).filter((x) => x.size);
        if (files.length) photos[s] = await Promise.all(files.map((x) => uploadFile(x, "sources")));
      }
      const res = await fetch("/api/quiz/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics, chapters: chap, photos }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      setMsg(j.results.map((r: { subject: string; ok: boolean; count?: number; error?: string }) => ({ ok: r.ok, text: r.ok ? `${r.subject}: ${r.count} questions ready for review` : `${r.subject}: ${r.error}` })));
      setTopics({}); setChap({}); setFormKey((k) => k + 1); load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  const latest = (id: string) => attempts.find((a) => a.quiz_id === id);
  const isTeacher = me.role === "teacher";
  const list = isTeacher ? quizzes : quizzes.filter((q) => (tab === "new" ? !latest(q.id) : !!latest(q.id)));
  const weeks = [...new Set(list.map((q) => q.week_start))];
  const newCount = quizzes.filter((q) => !latest(q.id)).length;

  return (
    <div className="space-y-4">
      <PageTitle emoji="🧠" title="Weekly Quizzes" sub={isTeacher ? "Make, review and assign" : "Test your brain!"} />

      {isTeacher && (
        <form key={formKey} onSubmit={generate} className="card p-4 space-y-2.5 fade-up">
          <h2 className="font-display font-extrabold text-xl">✨ Make this week&apos;s quizzes</h2>
          <p className="text-sm text-slate-600">For each subject write a topic, pick a book chapter, or upload photos of the pages (any mix). Leave a subject empty to skip it. The AI drafts the quiz and you review it before giving it to Kashika.</p>
          {SUBJECTS.map((s) => (
            <div key={s} className="space-y-1.5 rounded-2xl bg-violet-50/50 border border-violet-100 p-2.5">
              <div className="flex items-center gap-2">
                <span className={`chip w-24 justify-center ${subjectMeta(s).chip}`}>{subjectMeta(s).icon} {s}</span>
                <input value={topics[s] ?? ""} onChange={(e) => setTopics({ ...topics, [s]: e.target.value })} placeholder={PLACEHOLDER[s]} className="field" disabled={busy} />
              </div>
              <ChapterSelect chapters={chapters} subject={s} value={chap[s] ?? ""} onChange={(v) => setChap({ ...chap, [s]: v })} disabled={busy} />
              <FileInput name={"photos_" + s} multiple compact disabled={busy} label="Or upload photos / PDF of the pages" />
            </div>
          ))}
          <button disabled={busy} className="btn btn-primary btn-big">{busy ? "🪄 Making quizzes… (about a minute)" : "🪄 Create quizzes"}</button>
          {err && <ErrorBox>{err}</ErrorBox>}
          {msg.map((m, i) => <p key={i} className={`text-sm font-bold ${m.ok ? "text-emerald-700" : "text-rose-600"}`}>{m.ok ? "✓" : "✗"} {m.text}</p>)}
        </form>
      )}

      {!isTeacher && <Tabs value={tab} onChange={setTab} tabs={[{ id: "new", label: "To do", count: newCount }, { id: "done", label: "Completed" }]} />}

      {list.length === 0 && <Empty emoji={isTeacher ? "🪄" : tab === "new" ? "🎉" : "📭"} title={isTeacher ? "No quizzes yet" : tab === "new" ? "No new quizzes!" : "No completed quizzes yet"} sub={isTeacher ? "Create this week's quizzes above" : undefined} />}

      {weeks.map((w) => (
        <section key={w} className="space-y-2">
          <h2 className="font-display font-extrabold text-slate-600">📆 Week of {w}</h2>
          {list.filter((q) => q.week_start === w).map((q, i) => {
            const a = latest(q.id), m = subjectMeta(q.subject);
            return (
              <Link key={q.id} href={`/quizzes/${q.id}`} className="card card-lift flex overflow-hidden fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={`w-20 grid place-items-center text-4xl bg-gradient-to-b ${m.grad}`}>{m.icon}</div>
                <div className="flex-1 p-3.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SubjectChip subject={q.subject} />
                    {isTeacher && <span className={`chip ${q.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{q.status === "draft" ? "Draft — review" : "Assigned"}</span>}
                  </div>
                  <div className="font-display font-extrabold text-lg truncate mt-0.5">{q.topic}</div>
                  <div className="text-xs text-slate-500 font-semibold">{q.n} questions{a ? ` · attempted ${attempts.filter((x) => x.quiz_id === q.id).length}×` : ""}</div>
                </div>
                <div className="pr-3 grid place-items-center font-extrabold text-sm">
                  {a ? <span className="chip bg-amber-100 text-amber-800 !text-sm">⭐ {a.score}/{a.total}</span> : !isTeacher && me.role === "student" ? <span className="chip bg-violet-600 text-white !text-sm">Start ›</span> : <span className="text-slate-300 text-xl">›</span>}
                </div>
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
