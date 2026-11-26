"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { subjectMeta } from "@/lib/constants";
import { gradeQuiz, isCorrect, type Attempt, type Question, type Quiz } from "@/lib/quiz";
import Review, { correctText } from "@/components/QuizReview";
import { Confetti, ErrorBox, Ring, SubjectChip } from "@/components/ui";
import { useTodo } from "@/lib/todo";

type Resp = Attempt["responses"];

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const todo = useTodo();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [qs, setQs] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [resp, setResp] = useState<Resp>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [idx, setIdx] = useState(0);
  const [taking, setTaking] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [party, setParty] = useState(false);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from("quizzes").select("*").eq("id", id).maybeSingle(),
      supabase.from("quiz_questions").select("*").eq("quiz_id", id).order("position"),
      supabase.from("quiz_attempts").select("*").eq("quiz_id", id).order("submitted_at", { ascending: false }),
    ]);
    setQuiz(a.data as Quiz | null);
    setQs((b.data ?? []) as Question[]);
    setAttempts((c.data ?? []) as Attempt[]);
    setLoaded(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!loaded) return <div className="text-center py-16 text-5xl float">🦉</div>;
  if (!quiz) return <p>Quiz not found.</p>;

  const m = subjectMeta(quiz.subject);
  const isTeacher = me.role === "teacher";
  const shownAttempt = attempts.find((a) => a.id === viewId) ?? attempts[0];

  async function setStatus(status: "draft" | "assigned") { await supabase.from("quizzes").update({ status }).eq("id", id); load(); todo.refresh(); }
  async function delQuiz() { if (!confirm("Delete this whole quiz?")) return; await supabase.from("quizzes").delete().eq("id", id); todo.refresh(); router.push("/quizzes"); }
  async function remove(q: Question) { await supabase.from("quiz_questions").delete().eq("id", q.id); load(); }
  async function replace(q: Question) {
    setBusy(true); setErr("");
    const r = await fetch("/api/quiz/replace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question_id: q.id }) });
    if (!r.ok) setErr((await r.json()).error || "Could not replace");
    setBusy(false); load();
  }

  async function finish() {
    setBusy(true); setErr("");
    const { score, total } = gradeQuiz(qs, resp);
    const { data, error } = await supabase.from("quiz_attempts").insert({ quiz_id: id, responses: resp, score, total }).select("id").single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setTaking(false); setResp({}); setChecked({}); setIdx(0); setViewId(data.id);
    if (total && score / total >= 0.6) { setParty(true); setTimeout(() => setParty(false), 5000); }
    load(); todo.refresh();
  }

  const head = (
    <div className="space-y-2 fade-up">
      <button onClick={() => router.push("/quizzes")} className="text-sm font-extrabold text-violet-600">‹ All quizzes</button>
      <div className={`rounded-[1.75rem] p-4 text-white bg-gradient-to-r ${m.grad} shadow-lg`}>
        <div className="flex items-center gap-3">
          <span className="size-12 rounded-2xl bg-white/25 grid place-items-center text-2xl">{m.icon}</span>
          <div><div className="text-white/85 text-xs font-extrabold uppercase tracking-wide">{quiz.subject} quiz</div><h1 className="text-2xl font-extrabold leading-tight">{quiz.topic}</h1></div>
        </div>
      </div>
    </div>
  );

  // ---------- Ma'am: review / assign ----------
  if (isTeacher) {
    return (
      <div className="space-y-3">
        {head}
        <div className="card p-3 flex flex-wrap items-center gap-2 fade-up">
          <span className={`chip ${quiz.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{quiz.status === "draft" ? "Draft" : "Assigned to Kashika"}</span>
          {quiz.status === "draft"
            ? <button onClick={() => setStatus("assigned")} disabled={!qs.length} className="btn btn-green !py-2">✔ Assign to Kashika</button>
            : <button onClick={() => setStatus("draft")} className="btn btn-ghost !py-2">Take back to draft</button>}
          <button onClick={delQuiz} className="text-rose-600 text-sm font-bold ml-auto">Delete quiz</button>
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
        {attempts.length > 0 && (
          <div className="rounded-2xl bg-violet-50 border border-violet-100 p-3 text-sm"><b>Kashika&apos;s attempts:</b> {attempts.map((a) => `${a.score}/${a.total} (${new Date(a.submitted_at).toLocaleDateString()})`).join(" · ")}</div>
        )}
        {qs.length === 0 && <p className="text-slate-500">All questions removed.</p>}
        {qs.map((q, i) => <Review key={q.id} q={q} n={i + 1} onRemove={() => remove(q)} onReplace={() => replace(q)} busy={busy} />)}
      </div>
    );
  }

  // ---------- Kashika taking the quiz (one question at a time) ----------
  if (me.role === "student" && (taking || !attempts.length)) {
    const q = qs[idx];
    if (!q) return <p>No questions in this quiz.</p>;
    const done = checked[q.id];
    const r = resp[q.id];
    const ok = done && isCorrect(q, r);
    const matchCur = (q.type === "match" ? ((r as number[]) ?? (q.options as { left: string[] }).left.map(() => -1)) : []) as number[];
    const canCheck = q.type === "fill" ? typeof r === "string" && r.trim() !== "" : q.type === "match" ? matchCur.every((x) => x >= 0) : r !== undefined;
    const last = idx === qs.length - 1;
    const doneCount = Object.keys(checked).length;

    function pick(k: number) { if (done) return; setResp({ ...resp, [q.id]: k }); setChecked({ ...checked, [q.id]: true }); }

    return (
      <div className="space-y-3">
        {head}
        <div className="fade-up">
          <div className="flex justify-between text-sm font-extrabold mb-1"><span>Question {idx + 1} of {qs.length}</span><span>⭐ {qs.slice(0, idx + (done ? 1 : 0)).filter((x) => checked[x.id] && isCorrect(x, resp[x.id])).length}</span></div>
          <div className="h-3 rounded-full bg-white border border-violet-100 overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${m.grad} transition-all duration-500`} style={{ width: `${(doneCount / qs.length) * 100}%` }} /></div>
        </div>

        <article key={q.id} className="card p-5 space-y-4 pop">
          <h2 className="text-2xl font-extrabold leading-snug">{q.prompt}</h2>

          {q.type === "mcq" && (
            <div className="grid gap-2.5">
              {(q.options as string[]).map((o, k) => {
                const isSel = r === k, isAns = q.answer === k;
                const cls = !done ? "border-violet-100 bg-white hover:border-violet-300 hover:bg-violet-50" : isAns ? "border-emerald-400 bg-emerald-50" : isSel ? "border-rose-400 bg-rose-50 shake" : "border-slate-100 bg-slate-50 opacity-60";
                return (
                  <button key={k} onClick={() => pick(k)} className={`text-left rounded-2xl border-2 px-4 py-3.5 text-lg font-bold transition active:scale-[.98] flex items-center gap-3 ${cls}`}>
                    <span className={`size-9 rounded-xl grid place-items-center text-sm font-extrabold ${done && isAns ? "bg-emerald-500 text-white" : done && isSel ? "bg-rose-500 text-white" : "bg-violet-100 text-violet-700"}`}>{done && isAns ? "✓" : done && isSel ? "✗" : String.fromCharCode(65 + k)}</span>
                    <span className="flex-1">{o}</span>
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "fill" && (
            <input disabled={done} value={(r as string) ?? ""} onChange={(e) => setResp({ ...resp, [q.id]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && canCheck && !done) setChecked({ ...checked, [q.id]: true }); }}
              placeholder="Type your answer here…" className={`field !text-xl !py-3.5 ${done ? (ok ? "!border-emerald-400 !bg-emerald-50" : "!border-rose-400 !bg-rose-50") : ""}`} />
          )}

          {q.type === "match" && (() => {
            const o = q.options as { left: string[]; right: string[] };
            return <div className="space-y-2.5">{o.left.map((l, i) => {
              const good = done && (q.answer as number[])[i] === matchCur[i];
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 font-extrabold bg-violet-50 rounded-2xl px-3 py-3">{l}</span>
                  <span className="text-slate-400 font-extrabold">→</span>
                  <select disabled={done} value={matchCur[i]} onChange={(e) => { const n = [...matchCur]; n[i] = Number(e.target.value); setResp({ ...resp, [q.id]: n }); }}
                    className={`field flex-1 !py-3 font-bold ${done ? (good ? "!border-emerald-400 !bg-emerald-50" : "!border-rose-400 !bg-rose-50") : ""}`}>
                    <option value={-1}>Choose…</option>
                    {o.right.map((rr, k) => <option key={k} value={k}>{rr}</option>)}
                  </select>
                </div>
              );
            })}</div>;
          })()}

          {done && (
            <div className={`rounded-2xl p-3.5 pop ${ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
              <div className="font-display font-extrabold text-lg">{ok ? "🎉 Correct! Great job!" : "Oops! Let's learn from it 💪"}</div>
              {!ok && <div className="text-sm mt-0.5"><b>Right answer:</b> {correctText(q)}</div>}
              {q.explanation && <div className="text-sm mt-1">💡 {q.explanation}</div>}
            </div>
          )}
        </article>

        {err && <ErrorBox>{err}</ErrorBox>}
        {!done && q.type !== "mcq" && <button onClick={() => setChecked({ ...checked, [q.id]: true })} disabled={!canCheck} className="btn btn-primary btn-big">Check ✓</button>}
        {done && !last && <button onClick={() => setIdx(idx + 1)} className="btn btn-primary btn-big pop">Next question →</button>}
        {done && last && <button onClick={finish} disabled={busy} className="btn btn-green btn-big pop">{busy ? "Saving…" : "Finish & see my score 🎉"}</button>}
      </div>
    );
  }

  // ---------- Result (Kashika after finishing, or parent) ----------
  const a = shownAttempt;
  const pct = a && a.total ? a.score / a.total : 0;
  return (
    <div className="space-y-3">
      {party && <Confetti />}
      {head}
      {!a ? <p className="text-slate-500 card p-5">Kashika has not attempted this quiz yet.</p> : (
        <>
          <div className="card p-5 text-center space-y-2 pop">
            <Ring value={a.score} max={a.total} size={140} stroke={14} from={pct >= 0.6 ? "#34d399" : "#fbbf24"} to={pct >= 0.6 ? "#10b981" : "#f97316"}>
              <div><div className="text-4xl">{pct === 1 ? "🏆" : pct >= 0.6 ? "🌟" : "💪"}</div><div className="font-display font-extrabold text-2xl leading-none">{a.score}/{a.total}</div></div>
            </Ring>
            <div className="font-display font-extrabold text-xl">{pct === 1 ? "Perfect! Superstar!" : pct >= 0.8 ? "Awesome work!" : pct >= 0.6 ? "Great job!" : "Good try! Practise a bit more."}</div>
            {me.role === "student" && <button onClick={() => { setResp({}); setChecked({}); setIdx(0); setTaking(true); }} className="btn btn-primary">🔁 Try again</button>}
          </div>
          {attempts.length > 1 && (
            <div className="space-y-1.5 fade-up">
              <div className="text-sm font-extrabold">📚 All attempts</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {attempts.map((x, i) => (
                  <button key={x.id} onClick={() => setViewId(x.id)} className={`chip !text-sm !py-2 whitespace-nowrap ${x.id === a.id ? "bg-violet-600 text-white shadow" : "bg-white border border-violet-100 text-slate-600"}`}>
                    #{attempts.length - i} · {x.score}/{x.total} · {new Date(x.submitted_at).toLocaleDateString()}
                  </button>
                ))}
              </div>
            </div>
          )}
          {qs.map((q, i) => <Review key={q.id} q={q} n={i + 1} resp={a.responses[q.id] ?? (q.type === "fill" ? "" : q.type === "match" ? [] : -1)} />)}
        </>
      )}
    </div>
  );
}
