"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, subjectMeta } from "@/lib/constants";
import type { Attempt, Question } from "@/lib/quiz";
import Review from "@/components/QuizReview";
import { ThumbGrid } from "@/components/Thumb";
import AudioPlayer from "@/components/AudioPlayer";
import MistakeList, { type Mistake } from "@/components/MistakeList";
import { Empty, PageTitle, Ring, SubjectChip, Tabs } from "@/components/ui";

type Hw = { id: string; subject: string; title: string; description: string; due_date: string | null; file_paths: string[] };
type Sub = { id: string; homework_id: string; file_paths: string[]; note: string; status: string; marks: number | null; comment: string; submitted_at: string };
type QA = Attempt & { quizzes: { subject: string; topic: string } | null };
type SA = { id: string; audio_path: string | null; transcript: string; ai_score: number | null; ai_feedback: string; mistakes: Mistake[]; teacher_score: number | null; teacher_comment: string; created_at: string;
  speaking_tasks: { prompt: string; kind: string; target: string; speaking_sets: { topic: string } | null } | null };
type T = { id: string; subject: string; title: string; test_date: string; syllabus: string; syllabus_files: string[]; marks_obtained: number | null; max_marks: number | null; file_paths: string[] };
type TP = { test_id: string; file_paths: string[]; note: string };
type TA = { test_id: string; file_paths: string[]; note: string; submitted_at: string };

const ymd = (d: string) => d.slice(0, 7);
const monthLabel = (ym: string) => new Date(ym + "-01").toLocaleString("en", { month: "long", year: "numeric" });

export default function History() {
  const me = useMe();
  const [tab, setTab] = useState<"hw" | "quiz" | "speak" | "test">("hw");
  const [hws, setHws] = useState<Hw[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [qas, setQas] = useState<QA[]>([]);
  const [sas, setSas] = useState<SA[]>([]);
  const [tests, setTests] = useState<T[]>([]);
  const [tpapers, setTpapers] = useState<Record<string, TP>>({});
  const [tans, setTans] = useState<Record<string, TA>>({});
  const [subject, setSubject] = useState("All");
  const [month, setMonth] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const [qcache, setQcache] = useState<Record<string, Question[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [h, s, q, sp, t, tp, ta] = await Promise.all([
        supabase.from("homework").select("*"),
        supabase.from("submissions").select("*").order("submitted_at", { ascending: false }),
        supabase.from("quiz_attempts").select("*, quizzes(subject, topic)").order("submitted_at", { ascending: false }),
        supabase.from("speaking_attempts").select("*, speaking_tasks(prompt, kind, target, speaking_sets(topic))").order("created_at", { ascending: false }),
        supabase.from("tests").select("*").order("test_date", { ascending: false }),
        supabase.from("test_papers").select("*"),
        supabase.from("test_submissions").select("*"),
      ]);
      setTpapers(Object.fromEntries((tp.data ?? []).map((x) => [x.test_id, x as TP])));
      setTans(Object.fromEntries((ta.data ?? []).map((x) => [x.test_id, x as TA])));
      setHws((h.data ?? []) as Hw[]); setSubs((s.data ?? []) as Sub[]); setQas((q.data ?? []) as unknown as QA[]);
      setSas((sp.data ?? []) as unknown as SA[]); setTests(((t.data ?? []) as T[]).filter((x) => x.test_date < new Date().toLocaleDateString("en-CA")));
      setLoaded(true);
    })();
  }, []);

  async function toggleQuiz(a: QA) {
    const next = open === a.id ? null : a.id;
    setOpen(next);
    if (next && !qcache[a.quiz_id]) {
      const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", a.quiz_id).order("position");
      setQcache((c) => ({ ...c, [a.quiz_id]: (data ?? []) as Question[] }));
    }
  }

  const hwById = useMemo(() => Object.fromEntries(hws.map((h) => [h.id, h])), [hws]);
  const subItems = subs.filter((s) => hwById[s.homework_id]);
  const months = useMemo(() => {
    const all = [...subItems.map((s) => s.submitted_at), ...qas.map((a) => a.submitted_at), ...sas.map((a) => a.created_at), ...tests.map((t) => t.test_date)].map(ymd);
    return [...new Set(all)].sort().reverse();
  }, [subItems, qas, sas, tests]);

  const okMonth = (d: string) => month === "All" || ymd(d) === month;
  const okSubj = (s: string) => subject === "All" || s === subject;
  const fHw = subItems.filter((s) => okMonth(s.submitted_at) && okSubj(hwById[s.homework_id].subject));
  const fQ = qas.filter((a) => okMonth(a.submitted_at) && okSubj(a.quizzes?.subject ?? ""));
  const fS = sas.filter((a) => okMonth(a.created_at) && okSubj("English"));
  const fT = tests.filter((t) => okMonth(t.test_date) && okSubj(t.subject));

  // progress by subject
  const prog = SUBJECTS.map((s) => {
    const q = qas.filter((a) => a.quizzes?.subject === s && a.total);
    const quizPct = q.length ? Math.round((q.reduce((n, a) => n + a.score / a.total, 0) / q.length) * 100) : null;
    const t = tests.filter((x) => x.subject === s && x.marks_obtained !== null && x.max_marks);
    const testPct = t.length ? Math.round((t.reduce((n, x) => n + (x.marks_obtained! / x.max_marks!), 0) / t.length) * 100) : null;
    return { s, quizPct, testPct, quizzes: q.length, tests: t.length };
  });
  const allQ = qas.filter((a) => a.total);
  const avgQuiz = allQ.length ? Math.round((allQ.reduce((n, a) => n + a.score / a.total, 0) / allQ.length) * 100) : 0;

  if (!loaded) return <div className="text-center py-16 text-5xl float">🦉</div>;

  return (
    <div className="space-y-4">
      <PageTitle emoji="📚" title="My Work" sub={me.role === "student" ? "Everything I have done, saved forever" : "Kashika's saved work and progress"} />

      <section className="card p-4 fade-up space-y-3">
        <div className="flex items-center gap-4">
          <Ring value={avgQuiz} max={100} size={92}><div><div className="font-display font-extrabold text-xl leading-none">{avgQuiz}%</div><div className="text-[10px] font-bold text-slate-500">quiz avg</div></div></Ring>
          <div className="flex-1 grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <div className="rounded-2xl bg-violet-50 py-2"><div className="font-display font-extrabold text-xl text-violet-600">{qas.length}</div>Quizzes</div>
            <div className="rounded-2xl bg-sky-50 py-2"><div className="font-display font-extrabold text-xl text-sky-600">{subItems.length}</div>Homework</div>
            <div className="rounded-2xl bg-pink-50 py-2"><div className="font-display font-extrabold text-xl text-pink-600">{sas.length}</div>Speaking</div>
          </div>
        </div>
        <div className="space-y-2">
          {prog.map((p, i) => (
            <div key={p.s} className="flex items-center gap-2 text-sm">
              <span className="w-24 font-extrabold">{subjectMeta(p.s).icon} {p.s}</span>
              <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                {p.quizPct !== null && <div className={`h-full rounded-full ${subjectMeta(p.s).bar} bar-grow`} style={{ width: `${Math.max(p.quizPct, 4)}%`, animationDelay: `${i * 0.08}s` }} />}
              </div>
              <span className="w-28 text-right text-[11px] leading-tight font-bold text-slate-500">{[p.quizPct !== null && `${p.quizPct}% quiz`, p.testPct !== null && `${p.testPct}% test`].filter(Boolean).join(" · ") || "no data yet"}</span>
            </div>
          ))}
        </div>
      </section>

      <Tabs value={tab} onChange={(v) => { setTab(v); setOpen(null); }} tabs={[
        { id: "hw", label: "Homework" }, { id: "quiz", label: "Quizzes" }, { id: "speak", label: "Speaking" }, { id: "test", label: "Tests" },
      ]} />

      <div className="flex gap-2">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="field !w-auto !py-2 font-bold">
          <option value="All">📆 All time</option>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        {tab !== "speak" && (
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="field !w-auto !py-2 font-bold">
            <option value="All">🌈 All subjects</option>{SUBJECTS.map((s) => <option key={s} value={s}>{subjectMeta(s).icon} {s}</option>)}
          </select>
        )}
      </div>

      {tab === "hw" && (fHw.length === 0 ? <Empty emoji="📝" title="No homework answers saved yet" sub="Submitted homework will appear here" /> : fHw.map((s, i) => {
        const h = hwById[s.homework_id];
        return (
          <article key={s.id} className="card p-4 space-y-2 fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
            <div className="flex items-center gap-2 flex-wrap">
              <SubjectChip subject={h.subject} />
              <span className={`chip ${s.status === "checked" ? "bg-emerald-100 text-emerald-800" : s.status === "redo" ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"}`}>{s.status === "checked" ? "Checked ✓✓" : s.status === "redo" ? "Redo 🔁" : "Submitted ✓"}</span>
              <span className="ml-auto text-xs font-bold text-slate-500">{new Date(s.submitted_at).toLocaleDateString()}</span>
            </div>
            <h2 className="font-display font-extrabold text-lg">{h.title}</h2>
            <ThumbGrid paths={h.file_paths} label="Homework" title={h.title} />
            <div className="rounded-2xl bg-violet-50/70 border border-violet-100 p-3 space-y-2">
              <div className="text-sm font-extrabold">My answer</div>
              {s.note && <p className="text-sm">{s.note}</p>}
              {s.file_paths.length > 0 ? <ThumbGrid paths={s.file_paths} label="Page" title={`My answer · ${h.title}`} /> : !s.note && <p className="text-sm text-slate-400">No file</p>}
            </div>
            {(s.marks !== null || s.comment) && <div className="rounded-xl bg-emerald-100 text-emerald-900 px-3 py-2 text-sm">{s.marks !== null && <b className="mr-2">⭐ {s.marks}</b>}{s.comment && <>👩‍🏫 “{s.comment}”</>}</div>}
          </article>
        );
      }))}

      {tab === "quiz" && (fQ.length === 0 ? <Empty emoji="🧠" title="No quizzes finished yet" sub="Finished quizzes are saved here with every answer" /> : fQ.map((a, i) => {
        const subj = a.quizzes?.subject ?? "";
        const isOpen = open === a.id;
        return (
          <div key={a.id} className="space-y-2">
            <button onClick={() => toggleQuiz(a)} className="card card-lift w-full text-left p-3.5 flex items-center gap-3 fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
              <span className={`size-12 rounded-2xl grid place-items-center text-2xl text-white bg-gradient-to-br ${subjectMeta(subj).grad}`}>{subjectMeta(subj).icon}</span>
              <span className="flex-1 min-w-0"><span className="block font-extrabold truncate">{a.quizzes?.topic ?? "Quiz"}</span><span className="block text-xs text-slate-500 font-semibold">{subj} · {new Date(a.submitted_at).toLocaleDateString()}</span></span>
              <span className={`chip !text-sm ${a.total && a.score / a.total >= 0.6 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>⭐ {a.score}/{a.total}</span>
              <span className={`text-slate-400 transition ${isOpen ? "rotate-90" : ""}`}>›</span>
            </button>
            {isOpen && (qcache[a.quiz_id] ? qcache[a.quiz_id].map((q, k) => <Review key={q.id} q={q} n={k + 1} resp={a.responses[q.id] ?? (q.type === "fill" ? "" : q.type === "match" ? [] : -1)} />) : <p className="text-sm text-slate-400 pl-2">Loading answers…</p>)}
          </div>
        );
      }))}

      {tab === "speak" && (fS.length === 0 ? <Empty emoji="🎤" title="No voice notes yet" sub="Your recordings and stars are saved here" /> : fS.map((a, i) => {
        const sc = a.teacher_score ?? a.ai_score;
        return (
          <article key={a.id} className="card p-4 space-y-2 fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="chip bg-sky-100 text-sky-800">🎤 {a.speaking_tasks?.speaking_sets?.topic ?? "Speaking"}</span>
              <span className="ml-auto text-xs font-bold text-slate-500">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
            <div className="font-display font-extrabold">{a.speaking_tasks?.prompt}</div>
            {a.speaking_tasks?.target && <div className="text-sm bg-violet-50 rounded-xl px-3 py-1.5">Sentence: <b>{a.speaking_tasks.target}</b></div>}
            {a.audio_path && <AudioPlayer path={a.audio_path} />}
            {a.transcript && <p className="text-sm bg-amber-50 rounded-xl px-3 py-2"><b>Heard:</b> {a.transcript}</p>}
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-0.5">
              <div className="text-xl">{sc === null ? "Waiting for ma'am 🎧" : <>{"⭐".repeat(sc)}{"☆".repeat(5 - sc)} <b className="text-base">{sc}/5</b></>}</div>
              {a.ai_feedback && <p>🤖 {a.ai_feedback}</p>}
              {a.teacher_comment && <p>👩‍🏫 “{a.teacher_comment}”</p>}
            </div>
            <MistakeList items={a.mistakes} />
          </article>
        );
      }))}

      {tab === "test" && (fT.length === 0 ? <Empty emoji="🏆" title="No past tests yet" /> : fT.map((t, i) => {
        const pct = t.marks_obtained !== null && t.max_marks ? Math.round((t.marks_obtained / t.max_marks) * 100) : null;
        return (
          <article key={t.id} className="card p-4 space-y-2 fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
            <div className="flex items-center gap-2"><SubjectChip subject={t.subject} /><span className="ml-auto text-xs font-bold text-slate-500">{t.test_date}</span></div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><h2 className="font-display font-extrabold text-lg">{t.title}</h2>{t.syllabus && <p className="text-sm text-slate-600">📖 {t.syllabus}</p>}</div>
              {pct !== null && <Ring value={pct} max={100} size={72} stroke={9} from={pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#fb7185"} to={pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"}><div className="text-xs font-extrabold">{t.marks_obtained}/{t.max_marks}</div></Ring>}
            </div>
            {t.syllabus_files.length > 0 && <div className="space-y-1"><div className="text-xs font-extrabold text-slate-500">📚 Syllabus</div><ThumbGrid paths={t.syllabus_files} label="Syllabus" title={`${t.title} · syllabus`} /></div>}
            {tpapers[t.id] && <div className="space-y-1"><div className="text-xs font-extrabold text-slate-500">📄 Test paper</div><ThumbGrid paths={tpapers[t.id].file_paths} label="Paper" title={`${t.title} · test paper`} /></div>}
            {tans[t.id] && <div className="space-y-1 rounded-2xl bg-violet-50/70 border border-violet-100 p-2.5"><div className="text-xs font-extrabold text-slate-500">✍️ My answer sheet · {new Date(tans[t.id].submitted_at).toLocaleDateString()}</div>{tans[t.id].file_paths.length > 0 && <ThumbGrid paths={tans[t.id].file_paths} label="Page" title={`My answer sheet · ${t.title}`} />}{tans[t.id].note && <p className="text-sm">{tans[t.id].note}</p>}</div>}
            {t.file_paths.length > 0 && <div className="space-y-1"><div className="text-xs font-extrabold text-slate-500">✅ Checked paper</div><ThumbGrid paths={t.file_paths} label="Checked" title={`${t.title} · checked paper`} /></div>}
          </article>
        );
      }))}
    </div>
  );
}
