"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import type { AttStatus } from "@/lib/constants";

const COLOR: Record<AttStatus, string> = {
  present: "bg-green-200 text-green-900",
  absent: "bg-red-200 text-red-900",
  holiday: "bg-yellow-200 text-yellow-900",
};
const NEXT: Record<string, AttStatus | null> = { none: "present", present: "absent", absent: "holiday", holiday: null };
const pad = (n: number) => String(n).padStart(2, "0");

export default function Attendance() {
  const me = useMe();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [rows, setRows] = useState<Record<string, AttStatus>>({});

  const load = useCallback(async () => {
    const from = `${cursor.y}-${pad(cursor.m + 1)}-01`;
    const to = `${cursor.y}-${pad(cursor.m + 1)}-${pad(new Date(cursor.y, cursor.m + 1, 0).getDate())}`;
    const { data } = await supabase.from("attendance").select("day, status").gte("day", from).lte("day", to);
    setRows(Object.fromEntries((data ?? []).map((r) => [r.day, r.status as AttStatus])));
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
  const pct = present + absent ? Math.round((present / (present + absent)) * 100) : null;
  const shift = (d: number) => setCursor((c) => { const x = new Date(c.y, c.m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="px-4 py-2 bg-white rounded-xl shadow-sm">◀</button>
        <h1 className="text-xl font-bold">{new Date(cursor.y, cursor.m).toLocaleString("en", { month: "long", year: "numeric" })}</h1>
        <button onClick={() => shift(1)} className="px-4 py-2 bg-white rounded-xl shadow-sm">▶</button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="bg-green-100 rounded-xl p-2"><b className="text-lg block">{present}</b>Present</div>
        <div className="bg-red-100 rounded-xl p-2"><b className="text-lg block">{absent}</b>Absent</div>
        <div className="bg-indigo-100 rounded-xl p-2"><b className="text-lg block">{pct === null ? "—" : pct + "%"}</b>Attendance</div>
      </div>

      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: first }).map((_, i) => <div key={"e" + i} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`;
            const st = rows[day];
            return (
              <button key={day} onClick={() => tap(day)} disabled={me.role !== "teacher"}
                className={`aspect-square rounded-xl text-sm font-medium ${st ? COLOR[st] : "bg-gray-50 text-gray-700"}`}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="px-2 py-1 rounded bg-green-200">Present</span>
        <span className="px-2 py-1 rounded bg-red-200">Absent</span>
        <span className="px-2 py-1 rounded bg-yellow-200">Holiday</span>
      </div>
      {me.role === "teacher" && <p className="text-xs text-gray-500">Tap a date to change: Present → Absent → Holiday → clear.</p>}
    </div>
  );
}
