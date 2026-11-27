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

type SetRow = { id: string; topic: string; week_start: string; status: "draft" | "assigned"; flashcards: { id: string }[] };

export default function Flashcards() {
  const me = useMe();
  const router = useRouter();
  const todo = useTodo();
  const [sets, setSets] = useState<SetRow[]>([]);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState("");
  const [chapter, setChapter] = useState("");
  const [count, setCount] = useState(8);
  const chapters = useChapters();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from("flashcard_sets").select("id, topic, week_start, status, flashcards(id)").order("created_at", { ascending: false }),
      supabase.from("flashcard_progress").select("card_id").eq("known", true),
    ]);
    setSets((s.data ?? []) as SetRow[]);
    setKnown(new Set((p.data ?? []).map((x) => x.card_id)));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const files = ((new FormData(e.currentTarget as HTMLFormElement)).getAll("photos") as File[]).filter((x) => x.size);
      const photos = await Promise.all(files.map((x) => uploadFile(x, "sources")));
      const res = await fetch("/api/flashcards/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, chapter_id: chapter || undefined, photos, count }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      todo.refresh(); router.push(`/flashcards/${j.id}`);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  const isTeacher = me.role === "teacher";
  const tints = ["from-fuchsia-500 to-pink-500", "from-amber-400 to-orange-500", "from-teal-400 to-emerald-500", "from-indigo-500 to-violet-500"];

  return (
    <div className="space-y-4">
      <PageTitle emoji="🃏" title="Word Flashcards" sub={isTeacher ? "Make, review and assign" : "Flip, learn, remember!"} />

      {isTeacher && (
        <form onSubmit={generate} className="card p-4 space-y-2.5 fade-up">
          <h2 className="font-display font-extrabold text-xl">✨ Make this week&apos;s flashcards</h2>
          <p className="text-sm text-slate-600">Write a theme like &quot;Kitchen&quot; or &quot;Feelings&quot; (optional). The AI makes 10 words with a simple meaning, a Hindi hint and an example sentence. You review before giving them to Kashika.</p>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Theme (optional)" className="field" disabled={busy} />
          <ChapterSelect chapters={chapters} subject="English" value={chapter} onChange={setChapter} disabled={busy} />
          <FileInput name="photos" multiple compact disabled={busy} label="Or upload photos / PDF of the pages" />
          <label className="flex items-center gap-2 text-sm font-extrabold">How many cards
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={busy} className="field !w-auto !py-1.5">{[8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select> <span className="text-xs font-semibold text-slate-500">(at least 8 · add or delete later)</span></label>
          <button disabled={busy} className="btn btn-primary btn-big">{busy ? "🪄 Making cards…" : `🪄 Create ${count} flashcards`}</button>
          {err && <ErrorBox>{err}</ErrorBox>}
        </form>
      )}

      {sets.length === 0 && <Empty emoji="🃏" title={isTeacher ? "No flashcards yet" : "No flashcards yet"} sub={isTeacher ? "Create this week's set above" : "Ma'am will add some soon!"} />}
      {sets.map((s, i) => {
        const n = s.flashcards.length, k = s.flashcards.filter((c) => known.has(c.id)).length;
        return (
          <Link key={s.id} href={`/flashcards/${s.id}`} className="card card-lift flex overflow-hidden fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`w-20 grid place-items-center text-4xl bg-gradient-to-b ${tints[i % tints.length]}`}>🃏</div>
            <div className="flex-1 p-3.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="chip bg-fuchsia-100 text-fuchsia-800">🔤 Vocabulary</span>
                {isTeacher && <span className={`chip ${s.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{s.status === "draft" ? "Draft — review" : "Assigned"}</span>}
              </div>
              <div className="font-display font-extrabold text-lg truncate mt-0.5">{s.topic}</div>
              <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 bar-grow" style={{ width: `${n ? (k / n) * 100 : 0}%` }} /></div>
              <div className="text-xs text-slate-500 font-semibold mt-0.5">{k}/{n} words known · week of {s.week_start}</div>
            </div>
            <div className="pr-3 grid place-items-center">{!isTeacher && me.role === "student" ? <span className="chip bg-violet-600 text-white !text-sm">{k === 0 ? "Start ›" : "Open ›"}</span> : <span className="text-slate-300 text-xl">›</span>}</div>
          </Link>
        );
      })}
    </div>
  );
}
