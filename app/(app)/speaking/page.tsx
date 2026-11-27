"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, uploadFile } from "@/lib/supabase";
import FileInput from "@/components/FileInput";
import { useMe } from "@/lib/session";
import { Empty, ErrorBox, PageTitle } from "@/components/ui";
import { useTodo } from "@/lib/todo";
import { useChapters } from "@/lib/chapters";
import ChapterSelect from "@/components/ChapterSelect";

type SetRow = { id: string; topic: string; week_start: string; status: "draft" | "assigned"; speaking_tasks: { id: string }[] };
type Att = { task_id: string; ai_score: number | null; teacher_score: number | null; created_at: string };

export default function Speaking() {
  const me = useMe();
  const router = useRouter();
  const todo = useTodo();
  const [sets, setSets] = useState<SetRow[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [topic, setTopic] = useState("");
  const [chapter, setChapter] = useState("");
  const [count, setCount] = useState(8);
  const chapters = useChapters();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [s, a] = await Promise.all([
      supabase.from("speaking_sets").select("id, topic, week_start, status, speaking_tasks(id)").order("created_at", { ascending: false }),
      supabase.from("speaking_attempts").select("task_id, ai_score, teacher_score, created_at").order("created_at", { ascending: false }),
    ]);
    setSets((s.data ?? []) as SetRow[]);
    setAtts((a.data ?? []) as Att[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const files = ((new FormData(e.currentTarget as HTMLFormElement)).getAll("photos") as File[]).filter((x) => x.size);
      const photos = await Promise.all(files.map((x) => uploadFile(x, "sources")));
      const res = await fetch("/api/speaking/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, chapter_id: chapter || undefined, photos, count }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      todo.refresh(); router.push(`/speaking/${j.id}`);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  function summary(s: SetRow) {
    const seen = new Set<string>(); let got = 0, done = 0, pending = false;
    for (const a of atts) {
      if (seen.has(a.task_id) || !s.speaking_tasks.some((t) => t.id === a.task_id)) continue;
      seen.add(a.task_id); done++;
      const sc = a.teacher_score ?? a.ai_score;
      if (sc === null) pending = true; else got += sc;
    }
    return { got, done, total: s.speaking_tasks.length, pending };
  }

  return (
    <div className="space-y-4">
      <PageTitle emoji="🎤" title="English Speaking" sub={me.role === "teacher" ? "Make, review and assign" : "Speak up and earn stars!"} />

      {me.role === "teacher" && (
        <form onSubmit={generate} className="card p-4 space-y-2.5 fade-up">
          <h2 className="font-display font-extrabold text-xl">✨ Make speaking practice</h2>
          <p className="text-sm text-gray-600">Write a topic (optional) like &quot;My family&quot; or &quot;Animals&quot;. Leave it blank and the AI will pick one. You will review the tasks before giving them to Kashika.</p>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)" className="field" disabled={busy} />
          <ChapterSelect chapters={chapters} subject="English" value={chapter} onChange={setChapter} disabled={busy} />
          <FileInput name="photos" multiple compact disabled={busy} label="Or upload photos / PDF of the pages" />
          <label className="flex items-center gap-2 text-sm font-extrabold">How many tasks
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={busy} className="field !w-auto !py-1.5">{[8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}</select> <span className="text-xs font-semibold text-slate-500">(at least 8 · add or delete later)</span></label>
          <button disabled={busy} className="btn btn-primary btn-big">{busy ? "🪄 Making tasks…" : "🪄 Create speaking tasks"}</button>
          {err && <ErrorBox>{err}</ErrorBox>}
        </form>
      )}

      {sets.length === 0 && <Empty emoji="🎤" title={me.role === "teacher" ? "Nothing yet" : "No speaking practice yet"} />}
      {sets.map((s, i) => {
        const m = summary(s);
        return (
          <Link key={s.id} href={`/speaking/${s.id}`} className="card card-lift flex overflow-hidden fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="w-20 grid place-items-center text-4xl bg-gradient-to-b from-sky-400 to-blue-500">🎤</div>
            <div className="flex-1 p-3.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="chip bg-sky-100 text-sky-800">🔤 English Speaking</span>
                {me.role === "teacher" && <span className={`chip ${s.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{s.status === "draft" ? "Draft — review" : "Assigned"}</span>}
              </div>
              <div className="font-display font-extrabold text-lg truncate mt-0.5">{s.topic}</div>
              <div className="text-xs text-slate-500 font-semibold">{s.speaking_tasks.length} tasks · week of {s.week_start}</div>
            </div>
            <div className="pr-3 grid place-items-center text-sm font-extrabold">
              {m.done === 0 ? (me.role === "student" ? <span className="chip bg-violet-600 text-white !text-sm">Start ›</span> : <span className="text-slate-300 text-xl">›</span>) : m.done < m.total ? <span className="chip bg-sky-100 text-sky-800 !text-sm">{m.done}/{m.total} done</span> : m.pending ? <span className="chip bg-amber-100 text-amber-800 !text-sm">Waiting 🎧</span> : <span className="chip bg-amber-100 text-amber-800 !text-sm">⭐ {m.got}/{m.total * 5}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
