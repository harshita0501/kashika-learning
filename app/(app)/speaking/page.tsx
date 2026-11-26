"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";

type SetRow = { id: string; topic: string; week_start: string; status: "draft" | "assigned"; speaking_tasks: { id: string }[] };
type Att = { task_id: string; ai_score: number | null; teacher_score: number | null; created_at: string };

export default function Speaking() {
  const me = useMe();
  const router = useRouter();
  const [sets, setSets] = useState<SetRow[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);
  const [topic, setTopic] = useState("");
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
      const res = await fetch("/api/speaking/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      router.push(`/speaking/${j.id}`);
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
      <h1 className="text-2xl font-bold">🎤 English Speaking</h1>

      {me.role === "teacher" && (
        <form onSubmit={generate} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <h2 className="font-semibold">✨ Make speaking practice</h2>
          <p className="text-sm text-gray-600">Write a topic (optional) like &quot;My family&quot; or &quot;Animals&quot;. Leave it blank and the AI will pick one. You will review the tasks before giving them to Kashika.</p>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)" className="w-full border rounded-xl px-3 py-2" disabled={busy} />
          <button disabled={busy} className="bg-indigo-600 text-white rounded-xl px-5 py-2 font-semibold disabled:opacity-50">{busy ? "Making tasks…" : "Create speaking tasks"}</button>
          {err && <p className="text-red-600 text-sm">{err}</p>}
        </form>
      )}

      {sets.length === 0 && <p className="text-gray-500">{me.role === "teacher" ? "Nothing yet." : "No speaking practice yet."}</p>}
      {sets.map((s) => {
        const m = summary(s);
        return (
          <Link key={s.id} href={`/speaking/${s.id}`} className="block bg-white rounded-2xl p-4 shadow-sm active:scale-[.99] transition">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-1 rounded-full font-semibold bg-blue-100 text-blue-800">English Speaking</span>
              {me.role === "teacher" && <span className={`text-xs px-2 py-1 rounded-full ${s.status === "draft" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>{s.status === "draft" ? "Draft — needs review" : "Assigned"}</span>}
              <span className="ml-auto text-sm font-semibold">
                {m.done === 0 ? (me.role === "student" ? "Start →" : "") : m.done < m.total ? `${m.done}/${m.total} done` : m.pending ? "Waiting for marks" : `⭐ ${m.got}/${m.total * 5}`}
              </span>
            </div>
            <div className="font-bold mt-1">{s.topic}</div>
            <div className="text-xs text-gray-500">{s.speaking_tasks.length} tasks · week of {s.week_start}</div>
          </Link>
        );
      })}
    </div>
  );
}
