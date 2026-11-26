"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECT_STYLE } from "@/lib/constants";
import { gradeQuiz, isCorrect, type Attempt, type Question, type Quiz } from "@/lib/quiz";

type Resp = Attempt["responses"];

function correctText(q: Question): string {
  if (q.type === "mcq") return (q.options as string[])[q.answer as number];
  if (q.type === "fill") return (q.answer as string[])[0];
  const o = q.options as { left: string[]; right: string[] };
  return (q.answer as number[]).map((r, i) => `${o.left[i]} → ${o.right[r]}`).join("  ·  ");
}

function Review({ q, n, resp, onRemove, onReplace, busy }: {
  q: Question; n: number; resp?: Resp[string]; onRemove?: () => void; onReplace?: () => void; busy?: boolean;
}) {
  const answered = resp !== undefined;
  const ok = answered && isCorrect(q, resp);
  return (
    <article className={`rounded-2xl p-4 shadow-sm space-y-1 ${answered ? (ok ? "bg-green-50" : "bg-red-50") : "bg-white"}`}>
      <div className="font-semibold">{answered && (ok ? "✅ " : "❌ ")}{n}. {q.prompt}</div>
      {q.type === "mcq" && <ul className="text-sm list-disc ml-5">{(q.options as string[]).map((o, i) => <li key={i}>{o}</li>)}</ul>}
      {q.type === "match" && (
        <div className="text-sm grid grid-cols-2 gap-x-4">
          <div>{(q.options as { left: string[] }).left.map((l, i) => <div key={i}>{l}</div>)}</div>
          <div>{(q.options as { right: string[] }).right.map((r, i) => <div key={i}>{r}</div>)}</div>
        </div>
      )}
      <div className="text-sm"><b>Answer:</b> {correctText(q)}</div>
      {q.explanation && <div className="text-sm text-gray-600">💡 {q.explanation}</div>}
      {onRemove && (
        <div className="flex gap-3 pt-1 text-sm">
          <button disabled={busy} onClick={onReplace} className="text-indigo-600 font-semibold disabled:opacity-40">🔄 Replace with new</button>
          <button disabled={busy} onClick={onRemove} className="text-red-600 font-semibold disabled:opacity-40">🗑 Remove</button>
        </div>
      )}
    </article>
  );
}

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [qs, setQs] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [resp, setResp] = useState<Resp>({});
  const [taking, setTaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

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

  if (!loaded) return <p className="text-gray-500">Loading…</p>;
  if (!quiz) return <p>Quiz not found.</p>;

  const last = attempts[0];
  const isTeacher = me.role === "teacher";

  async function setStatus(status: "draft" | "assigned") {
    await supabase.from("quizzes").update({ status }).eq("id", id);
    load();
  }
  async function delQuiz() {
    if (!confirm("Delete this whole quiz?")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    router.push("/quizzes");
  }
  async function remove(q: Question) {
    await supabase.from("quiz_questions").delete().eq("id", q.id);
    load();
  }
  async function replace(q: Question) {
    setBusy(true); setErr("");
    const r = await fetch("/api/quiz/replace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question_id: q.id }) });
    if (!r.ok) setErr((await r.json()).error || "Could not replace");
    setBusy(false);
    load();
  }
  async function submit() {
    setBusy(true); setErr("");
    const { score, total } = gradeQuiz(qs, resp);
    const { error } = await supabase.from("quiz_attempts").insert({ quiz_id: id, responses: resp, score, total });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setTaking(false); setResp({});
    load();
  }

  const head = (
    <div className="space-y-1">
      <button onClick={() => router.push("/quizzes")} className="text-sm text-indigo-600">← All quizzes</button>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${SUBJECT_STYLE[quiz.subject]}`}>{quiz.subject}</span>
        <h1 className="text-xl font-bold">{quiz.topic}</h1>
      </div>
    </div>
  );

  // ---------- Ma'am: review / assign ----------
  if (isTeacher) {
    return (
      <div className="space-y-3">
        {head}
        <div className="bg-white rounded-2xl p-3 shadow-sm flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${quiz.status === "draft" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
            {quiz.status === "draft" ? "Draft" : "Assigned to Kashika"}
          </span>
          {quiz.status === "draft"
            ? <button onClick={() => setStatus("assigned")} disabled={!qs.length} className="bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40">✔ Assign to Kashika</button>
            : <button onClick={() => setStatus("draft")} className="bg-gray-200 rounded-xl px-4 py-2 text-sm font-semibold">Take back to draft</button>}
          <button onClick={delQuiz} className="text-red-600 text-sm ml-auto">Delete quiz</button>
        </div>
        {err && <p className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{err}</p>}
        {attempts.length > 0 && (
          <div className="bg-indigo-50 rounded-2xl p-3 text-sm">
            <b>Kashika&apos;s attempts:</b> {attempts.map((a) => `${a.score}/${a.total} (${new Date(a.submitted_at).toLocaleDateString()})`).join(" · ")}
          </div>
        )}
        {qs.length === 0 && <p className="text-gray-500">All questions removed.</p>}
        {qs.map((q, i) => <Review key={q.id} q={q} n={i + 1} onRemove={() => remove(q)} onReplace={() => replace(q)} busy={busy} />)}
      </div>
    );
  }

  // ---------- Kashika taking the quiz ----------
  if (me.role === "student" && (taking || !last)) {
    const done = qs.filter((q) => resp[q.id] !== undefined && !(Array.isArray(resp[q.id]) && (resp[q.id] as number[]).includes(-1)) && resp[q.id] !== "").length;
    return (
      <div className="space-y-3">
        {head}
        {qs.map((q, i) => (
          <article key={q.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="font-semibold text-lg">{i + 1}. {q.prompt}</div>
            {q.type === "mcq" && (
              <div className="grid gap-2">
                {(q.options as string[]).map((o, k) => (
                  <button key={k} onClick={() => setResp({ ...resp, [q.id]: k })}
                    className={`text-left rounded-xl border-2 px-4 py-3 ${resp[q.id] === k ? "border-indigo-600 bg-indigo-50 font-semibold" : "border-gray-200"}`}>{o}</button>
                ))}
              </div>
            )}
            {q.type === "fill" && (
              <input value={(resp[q.id] as string) ?? ""} onChange={(e) => setResp({ ...resp, [q.id]: e.target.value })}
                placeholder="Type your answer" className="w-full border-2 rounded-xl px-4 py-3 text-lg" />
            )}
            {q.type === "match" && (() => {
              const o = q.options as { left: string[]; right: string[] };
              const cur = (resp[q.id] as number[]) ?? o.left.map(() => -1);
              return o.left.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 font-medium">{l}</span>
                  <select value={cur[i]} onChange={(e) => { const n = [...cur]; n[i] = Number(e.target.value); setResp({ ...resp, [q.id]: n }); }}
                    className="flex-1 border-2 rounded-xl px-2 py-2">
                    <option value={-1}>Choose…</option>
                    {o.right.map((r, k) => <option key={k} value={k}>{r}</option>)}
                  </select>
                </div>
              ));
            })()}
          </article>
        ))}
        {err && <p className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{err}</p>}
        <button onClick={submit} disabled={busy || qs.length === 0}
          className="w-full bg-green-600 text-white text-lg font-bold rounded-2xl py-4 disabled:opacity-50">
          Submit ({done}/{qs.length} answered)
        </button>
      </div>
    );
  }

  // ---------- Result (Kashika after submit, or parent) ----------
  return (
    <div className="space-y-3">
      {head}
      {!last ? <p className="text-gray-500">Kashika has not attempted this quiz yet.</p> : (
        <>
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm">
            <div className="text-5xl">{last.score === last.total ? "🏆" : last.score / last.total >= 0.6 ? "🌟" : "💪"}</div>
            <div className="text-3xl font-bold mt-1">{last.score} / {last.total}</div>
            <div className="text-gray-600 text-sm">
              {last.score === last.total ? "Perfect! Superb!" : last.score / last.total >= 0.6 ? "Great job!" : "Good try! Practise a little more."}
            </div>
            {me.role === "student" && <button onClick={() => { setResp({}); setTaking(true); }} className="mt-3 bg-indigo-600 text-white rounded-xl px-5 py-2 font-semibold">Try again</button>}
          </div>
          {qs.map((q, i) => <Review key={q.id} q={q} n={i + 1} resp={last.responses[q.id] ?? (q.type === "fill" ? "" : -1)} />)}
        </>
      )}
    </div>
  );
}
