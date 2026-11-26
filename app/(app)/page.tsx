"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, today } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { useTodo } from "@/lib/todo";
import TodoModal from "@/components/TodoModal";

type Hw = { id: string; subject: string; title: string; due_date: string | null };
type Test = { id: string; subject: string; title: string; test_date: string };

export default function Home() {
  const me = useMe();
  const todo = useTodo();
  const [zoom, setZoom] = useState("");
  const [classTime, setClassTime] = useState("");
  const [todayStatus, setTodayStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<Hw[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const t = today();
      const [s, a, hw, sub, ts, all] = await Promise.all([
        supabase.from("settings").select("zoom_link, class_time").eq("id", 1).single(),
        supabase.from("attendance").select("status").eq("day", t).maybeSingle(),
        supabase.from("homework").select("id, subject, title, due_date").order("due_date"),
        supabase.from("submissions").select("homework_id, status"),
        supabase.from("tests").select("id, subject, title, test_date").gte("test_date", t).order("test_date").limit(3),
        supabase.from("attendance").select("status").gte("day", t.slice(0, 8) + "01"),
      ]);
      setZoom(s.data?.zoom_link ?? "");
      setClassTime(s.data?.class_time ?? "");
      setTodayStatus(a.data?.status ?? null);
      const done = new Set((sub.data ?? []).filter((x) => x.status !== "redo").map((x) => x.homework_id));
      setPending((hw.data ?? []).filter((h) => !done.has(h.id)));
      setTests(ts.data ?? []);
      const rows = (all.data ?? []).filter((r) => r.status !== "holiday");
      setPct(rows.length ? Math.round((rows.filter((r) => r.status === "present").length / rows.length) * 100) : null);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hi {me.role === "student" ? me.name : "👋"}!</h1>
      {me.role === "student" && <TodoModal />}

      {todo.items.length > 0 && (
        <section className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
          <h2 className="font-bold mb-2">{me.role === "teacher" ? "🔔 Needs your attention" : me.role === "parent" ? "🔔 Pending for Kashika" : "🔔 To do"} ({todo.items.length})</h2>
          <ul className="space-y-2">
            {todo.items.map((it, i) => (
              <li key={i}>
                <Link href={it.href} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 shadow-sm active:scale-[.98] transition">
                  <span className="text-xl">{it.icon}</span>
                  <span className="flex-1 min-w-0"><span className="block font-semibold text-sm truncate">{it.title}</span><span className="block text-xs text-gray-500 truncate">{it.sub}</span></span>
                  <span className="text-indigo-600">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {zoom ? (
        <a href={zoom} target="_blank" rel="noreferrer"
          className="block text-center bg-blue-600 text-white text-xl font-bold rounded-3xl py-6 shadow-lg active:scale-95 transition">
          🎥 Join Zoom Class{classTime && <span className="block text-sm font-normal opacity-90">Class time: {classTime}</span>}
        </a>
      ) : (
        <div className="bg-yellow-50 rounded-2xl p-4 text-sm">
          Zoom link not set yet.{me.role === "teacher" && <> <Link href="/settings" className="underline">Add it in Settings</Link>.</>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Today</div>
          <div className="text-lg font-bold">
            {todayStatus === "present" ? "✅ Present" : todayStatus === "absent" ? "❌ Absent" : todayStatus === "holiday" ? "🏖️ Holiday" : "Not marked"}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">This month</div>
          <div className="text-lg font-bold">{pct === null ? "—" : `${pct}% attendance`}</div>
        </div>
      </div>

      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">📝 Homework to do</h2>
          <Link href="/homework" className="text-indigo-600 text-sm">See all</Link>
        </div>
        {pending.length === 0 ? <p className="text-gray-500 text-sm">All done! 🎉</p> : (
          <ul className="space-y-1 text-sm">
            {pending.slice(0, 4).map((h) => (
              <li key={h.id}><b>{h.subject}</b> — {h.title}{h.due_date && <span className="text-gray-500"> (due {h.due_date})</span>}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">🏆 Upcoming tests</h2>
          <Link href="/tests" className="text-indigo-600 text-sm">See all</Link>
        </div>
        {tests.length === 0 ? <p className="text-gray-500 text-sm">No tests scheduled.</p> : (
          <ul className="space-y-1 text-sm">
            {tests.map((t) => <li key={t.id}><b>{t.subject}</b> — {t.title} <span className="text-gray-500">on {t.test_date}</span></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
