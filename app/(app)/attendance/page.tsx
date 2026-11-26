"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase, today } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import type { AttStatus } from "@/lib/constants";
import { Ring, PageTitle } from "@/components/ui";

const STYLE: Record<AttStatus, string> = {
  present: "bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-md shadow-emerald-300/60",
  absent: "bg-gradient-to-br from-rose-400 to-red-500 text-white shadow-md shadow-rose-300/60",
  holiday: "bg-gradient-to-br from-amber-300 to-yellow-400 text-amber-900 shadow-md shadow-amber-200/70",
};
const NEXT: Record<string, AttStatus | null> = { none: "present", present: "absent", absent: "holiday", holiday: null };
const pad = (n: number) => String(n).padStart(2, "0");

export default function Attendance() {
  const me = useMe();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [rows, setRows] = useState<Record<string, AttStatus>>({});
  const [streak, setStreak] = useState(0);

  const load = useCallback(async () => {
    const from = `${cursor.y}-${pad(cursor.m + 1)}-01`;
    const to = `${cursor.y}-${pad(cursor.m + 1)}-${pad(new Date(cursor.y, cursor.m + 1, 0).getDate())}`;
    const [mo, all] = await Promise.all([
      supabase.from("attendance").select("day, status").gte("day", from).lte("day", to),
      supabase.from("attendance").select("day, status").order("day", { ascending: false }),
    ]);
    setRows(Object.fromEntries((mo.data ?? []).map((r) => [r.day, r.status as AttStatus])));
    let s = 0;
    for (const r of all.data ?? []) { if (r.status === "holiday") continue; if (r.status === "present") s++; else break; }
    setStreak(s);
  }, [cursor]);
  useEffect(() => { load(); }, [load]);

  async function tap(day: string) {
    if (me.role !== "teacher") return;
    const next = NEXT[rows[day] ?? "none"];
    if (next) await supabase.from("attendance").upsert({ day, status: next });
    else await supabase.from("attendance").delete().eq("day", day);
    load();
  }

  const first = new Date(cursor.y, cursor.m, 1).getDay();
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const vals = Object.values(rows);
  const present = vals.filter((v) => v === "present").length;
  const absent = vals.filter((v) => v === "absent").length;
  const holiday = vals.filter((v) => v === "holiday").length;
  const pct = present + absent ? Math.round((present / (present + absent)) * 100) : null;
  const shift = (d: number) => setCursor((c) => { const x = new Date(c.y, c.m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const t = today();

  return (
    <div className="space-y-4">
      <PageTitle emoji="📅" title="Class Calendar" sub="Every day Kashika attended" />

      <div className="card p-4 flex items-center gap-4 fade-up">
        <Ring value={pct ?? 0} max={100} size={104} stroke={11}>
          <div><div className="font-display font-extrabold text-2xl leading-none">{pct === null ? "—" : pct + "%"}</div><div className="text-[10px] font-bold text-slate-500">attendance</div></div>
        </Ring>
        <div className="flex-1 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-emerald-50 py-2"><div className="font-display font-extrabold text-xl text-emerald-600">{present}</div><div className="text-[11px] font-bold text-emerald-700">Present</div></div>
          <div className="rounded-2xl bg-rose-50 py-2"><div className="font-display font-extrabold text-xl text-rose-600">{absent}</div><div className="text-[11px] font-bold text-rose-700">Absent</div></div>
          <div className="rounded-2xl bg-amber-50 py-2"><div className="font-display font-extrabold text-xl text-amber-600">{holiday}</div><div className="text-[11px] font-bold text-amber-700">Holiday</div></div>
          <div className="rounded-2xl bg-orange-50 py-2"><div className="font-display font-extrabold text-xl text-orange-600">🔥 {streak}</div><div className="text-[11px] font-bold text-orange-700">Streak</div></div>
        </div>
      </div>

      <div className="card p-3 fade-up" style={{ animationDelay: ".06s" }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => shift(-1)} className="size-10 rounded-2xl bg-violet-50 text-violet-700 font-extrabold text-lg active:scale-90 transition">‹</button>
          <h2 className="font-display font-extrabold text-xl">{new Date(cursor.y, cursor.m).toLocaleString("en", { month: "long", year: "numeric" })}</h2>
          <button onClick={() => shift(1)} className="size-10 rounded-2xl bg-violet-50 text-violet-700 font-extrabold text-lg active:scale-90 transition">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-extrabold text-slate-400 mb-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: first }).map((_, i) => <div key={"e" + i} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`;
            const st = rows[day];
            return (
              <button key={day} onClick={() => tap(day)} disabled={me.role !== "teacher"}
                className={`aspect-square rounded-2xl text-sm font-extrabold transition active:scale-90 ${st ? STYLE[st] : "bg-slate-50 text-slate-600"} ${day === t ? "ring-2 ring-violet-500 ring-offset-2" : ""}`}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <span className="chip bg-emerald-100 text-emerald-800">● Present</span>
        <span className="chip bg-rose-100 text-rose-800">● Absent</span>
        <span className="chip bg-amber-100 text-amber-800">● Holiday</span>
        {me.role === "teacher" && <span className="text-slate-500 self-center">Tap a date: Present → Absent → Holiday → clear</span>}
      </div>
    </div>
  );
}
