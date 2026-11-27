"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, uploadFile } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import VoiceRecorder, { type Recorded } from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";
import { useTodo } from "@/lib/todo";
import { Confetti, ErrorBox } from "@/components/ui";
import MistakeList, { type Mistake } from "@/components/MistakeList";
import AddMore from "@/components/AddMore";
import { speak, prefetchSpeech } from "@/lib/speech";

type SetRow = { id: string; topic: string; week_start: string; status: "draft" | "assigned" };
type Task = { id: string; position: number; kind: "repeat" | "answer" | "describe"; prompt: string; target: string; hint: string };
type Att = { id: string; task_id: string; audio_path: string | null; transcript: string; ai_score: number | null; ai_feedback: string; mistakes: Mistake[]; teacher_score: number | null; teacher_comment: string; created_at: string };

const KIND: Record<string, string> = { repeat: "🔁 Repeat after me", answer: "💬 Answer", describe: "🖼️ Describe" };
const stars = (n: number) => "⭐".repeat(n) + "☆".repeat(5 - n);
const finalScore = (a?: Att) => (a ? a.teacher_score ?? a.ai_score : null);

const listen = (text: string) => { void speak(text, { rate: 0.88 }); };

function Result({ a }: { a: Att }) {
  const sc = finalScore(a);
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-sm space-y-1 pop">
      {sc === null ? <div className="font-semibold">Waiting for ma&apos;am&apos;s marks 🎧</div> : <div className="text-xl">{stars(sc)} <span className="text-base font-bold">{sc}/5</span></div>}
      {a.ai_feedback && <p>🤖 {a.ai_feedback}</p>}
      {a.teacher_comment && <p>👩‍🏫 Ma&apos;am: “{a.teacher_comment}”</p>}
      <MistakeList items={a.mistakes} />
    </div>
  );
}

export default function SpeakingSet() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const todo = useTodo();
  const [set, setSet] = useState<SetRow | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [rec, setRec] = useState<Record<string, Recorded | null>>({});
  const [again, setAgain] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([
      supabase.from("speaking_sets").select("*").eq("id", id).maybeSingle(),
      supabase.from("speaking_tasks").select("*").eq("set_id", id).order("position"),
    ]);
    const ts = (t.data ?? []) as Task[];
    const a = ts.length ? await supabase.from("speaking_attempts").select("*").in("task_id", ts.map((x) => x.id)).order("created_at", { ascending: false }) : { data: [] };
    setSet(s.data as SetRow | null); setTasks(ts); setAtts((a.data ?? []) as Att[]); setLoaded(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tasks.length) prefetchSpeech(tasks.filter((t) => t.kind === "repeat").map((t) => t.target)); }, [tasks]);

  if (!loaded) return <p className="text-gray-500">Loading…</p>;
  if (!set) return <p>Not found.</p>;

  const isTeacher = me.role === "teacher";
  const latest = (taskId: string) => atts.find((a) => a.task_id === taskId);
  const total = tasks.reduce((n, t) => n + (finalScore(latest(t.id)) ?? 0), 0);
  const allDone = tasks.length > 0 && tasks.every((t) => latest(t.id));
  const party = allDone && me.role === "student" && total >= tasks.length * 3;

  async function setStatus(status: "draft" | "assigned") { await supabase.from("speaking_sets").update({ status }).eq("id", id); load(); todo.refresh(); }
  async function delSet() { if (!confirm("Delete this whole speaking practice?")) return; await supabase.from("speaking_sets").delete().eq("id", id); todo.refresh(); router.push("/speaking"); }
  async function removeTask(t: Task) { await supabase.from("speaking_tasks").delete().eq("id", t.id); load(); }
  async function replaceTask(t: Task) {
    setBusy(t.id); setErr("");
    const r = await fetch("/api/speaking/replace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: t.id }) });
    if (!r.ok) setErr((await r.json()).error || "Could not replace");
    setBusy(null); load();
  }
  async function send(t: Task) {
    const r = rec[t.id];
    if (!r) return;
    setBusy(t.id); setErr("");
    try {
      const ext = r.mime.includes("mp4") ? "m4a" : r.mime.includes("ogg") ? "ogg" : "webm";
      const audio_path = await uploadFile(new File([r.blob], `${t.id}.${ext}`, { type: r.mime }), "speaking");
      const res = await fetch("/api/speaking/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: t.id, transcript: r.transcript, audio_path }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not send");
      setRec({ ...rec, [t.id]: null }); setAgain({ ...again, [t.id]: false });
      await load(); todo.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function grade(a: Att, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = f.get("score") as string;
    await supabase.from("speaking_attempts").update({ teacher_score: v === "" ? null : Number(v), teacher_comment: f.get("comment") as string }).eq("id", a.id);
    load(); todo.refresh();
  }

  return (
    <div className="space-y-3">
      <button onClick={() => router.push("/speaking")} className="text-sm font-extrabold text-violet-600">‹ All speaking practice</button>
      <div className="rounded-[1.75rem] p-4 text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg fade-up flex items-center gap-3"><span className="size-12 rounded-2xl bg-white/25 grid place-items-center text-2xl">🎤</span><div><div className="text-white/85 text-xs font-extrabold uppercase tracking-wide">English speaking</div><h1 className="text-2xl font-extrabold leading-tight">{set.topic}</h1></div></div>

      {isTeacher && (
        <div className="card p-3 flex flex-wrap items-center gap-2 fade-up">
          <span className={`text-xs px-2 py-1 rounded-full ${set.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{set.status === "draft" ? "Draft" : "Assigned to Kashika"}</span>
          {set.status === "draft"
            ? <button onClick={() => setStatus("assigned")} disabled={!tasks.length} className="btn btn-green !py-2">✔ Assign to Kashika</button>
            : <button onClick={() => setStatus("draft")} className="btn btn-ghost !py-2">Take back to draft</button>}
          <button onClick={delSet} className="text-rose-600 text-sm font-bold ml-auto">Delete</button>
        </div>
      )}
      {err && <ErrorBox>{err}</ErrorBox>}

      {party && <Confetti count={30} />}
      {allDone && (
        <div className="card p-5 text-center fade-up">
          <div className="text-4xl">{total >= tasks.length * 4 ? "🏆" : total >= tasks.length * 3 ? "🌟" : "💪"}</div>
          <div className="text-2xl font-bold">{total} / {tasks.length * 5}</div>
          <div className="text-sm text-gray-600">Total speaking stars</div>
        </div>
      )}

      {tasks.map((t, i) => {
        const a = latest(t.id);
        const showRecorder = me.role === "student" && (!a || again[t.id]);
        return (
          <article key={t.id} className="card p-4 space-y-3 fade-up">
            <div className="flex items-center gap-2">
              <span className="chip bg-sky-100 text-sky-800">{KIND[t.kind]}</span>
              <span className="text-sm text-gray-500">Task {i + 1}</span>
            </div>
            <div className="font-display font-extrabold text-xl leading-snug">{t.prompt}</div>
            {t.kind === "repeat" && (
              <div className="bg-gradient-to-r from-violet-50 to-sky-50 border border-violet-100 rounded-2xl p-3 flex items-center gap-3">
                <span className="flex-1 text-xl font-extrabold">{t.target}</span>
                <button type="button" onClick={() => listen(t.target)} className="btn btn-primary !py-2 !px-3 text-sm">🔊 Listen</button>
              </div>
            )}
            {t.hint && <div className="text-sm text-gray-600">💡 {t.hint}</div>}

            {isTeacher && (
              <div className="flex gap-3 text-sm">
                {set.status === "draft" && <>
                  <button disabled={busy === t.id} onClick={() => replaceTask(t)} className="text-violet-600 font-extrabold disabled:opacity-40">🔄 Replace with new</button>
                  <button disabled={busy === t.id} onClick={() => removeTask(t)} className="text-rose-600 font-extrabold disabled:opacity-40">🗑 Remove</button>
                </>}
              </div>
            )}

            {showRecorder && (
              <div className="space-y-2 border-t pt-2">
                <VoiceRecorder onReady={(r) => setRec((p) => ({ ...p, [t.id]: r }))} disabled={busy === t.id} />
                {rec[t.id] && (
                  <button onClick={() => send(t)} disabled={busy === t.id} className="btn btn-green btn-big">
                    {busy === t.id ? "Checking… ⏳" : "✅ Send to ma'am"}
                  </button>
                )}
              </div>
            )}

            {a && !showRecorder && (
              <div className="space-y-2 border-t pt-2">
                {a.audio_path && <AudioPlayer path={a.audio_path} />}
                {a.transcript && <p className="text-sm bg-amber-50 rounded-xl px-3 py-2"><b>Heard:</b> {a.transcript}</p>}
                <Result a={a} />
                {me.role === "student" && <button onClick={() => setAgain({ ...again, [t.id]: true })} className="btn btn-soft !py-2 text-sm">🔁 Try again</button>}
                {isTeacher && (
                  <form onSubmit={(e) => grade(a, e)} className="flex flex-wrap items-center gap-2">
                    <label className="text-sm">Your marks <select name="score" defaultValue={a.teacher_score ?? ""} className="field !w-auto !py-1 ml-1">
                      <option value="">— (use AI: {a.ai_score ?? "?"})</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                    <input name="comment" defaultValue={a.teacher_comment} placeholder="Comment for Kashika" className="field flex-1 min-w-40 !py-1.5 text-sm" />
                    <button className="btn btn-soft !py-2 text-sm">Save</button>
                  </form>
                )}
              </div>
            )}
          </article>
        );
      })}
      {isTeacher && <AddMore what="speaking tasks" endpoint="/api/speaking/add" body={{ set_id: id }} options={[1, 2, 3, 4, 5, 6]} defaultCount={2} onDone={() => { load(); todo.refresh(); }} />}
    </div>
  );
}
