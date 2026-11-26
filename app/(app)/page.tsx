"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, today } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { useTodo } from "@/lib/todo";
import { loadStats, type Stats } from "@/lib/stats";
import TodoModal from "@/components/TodoModal";
import { Ring, SubjectChip } from "@/components/ui";

type Test = { id: string; subject: string; title: string; test_date: string };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? ["Good morning", "☀️"] : h < 17 ? ["Good afternoon", "🌤️"] : ["Good evening", "🌙"];
}

export default function Home() {
  const me = useMe();
  const todo = useTodo();
  const [zoom, setZoom] = useState("");
  const [classTime, setClassTime] = useState("");
  const [todayStatus, setTodayStatus] = useState<string | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [hello, setHello] = useState<string[]>(["Hello", "👋"]);

  useEffect(() => {
    setHello(greeting());
    (async () => {
      const t = today();
      const [s, a, ts] = await Promise.all([
        supabase.from("settings").select("zoom_link, class_time").eq("id", 1).single(),
        supabase.from("attendance").select("status").eq("day", t).maybeSingle(),
        supabase.from("tests").select("id, subject, title, test_date").gte("test_date", t).order("test_date").limit(3),
      ]);
      setZoom(s.data?.zoom_link ?? ""); setClassTime(s.data?.class_time ?? "");
      setTodayStatus(a.data?.status ?? null); setTests(ts.data ?? []);
      setStats(await loadStats());
    })();
  }, []);

  const name = me.role === "student" ? me.name : me.role === "teacher" ? "Ma'am" : "there";
  const att = { present: ["✅", "Present today", "from-emerald-400 to-green-500"], absent: ["❌", "Absent today", "from-rose-400 to-red-500"], holiday: ["🏖️", "Holiday today", "from-amber-300 to-yellow-400"] } as const;
  const today_ = todayStatus ? att[todayStatus as keyof typeof att] : null;
  const daysTo = (d: string) => Math.round((new Date(d).getTime() - new Date(today()).getTime()) / 86400000);
  const earned = stats?.badges.filter((b) => b.earned).length ?? 0;

  return (
    <div className="space-y-4">
      {me.role === "student" && <TodoModal />}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] p-5 text-white bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 shadow-xl shadow-violet-400/40 fade-up">
        <div className="absolute -right-6 -top-6 size-32 rounded-full bg-white/10" />
        <div className="absolute right-10 bottom-[-30px] size-24 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="text-6xl float drop-shadow-lg">🦉</div>
          <div className="min-w-0">
            <p className="text-white/80 text-sm font-bold">{hello[1]} {hello[0]}</p>
            <h1 className="text-3xl font-extrabold leading-tight truncate">{name}!</h1>
            <p className="text-white/80 text-sm">{new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>
        {stats && (
          <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
            {[["🔥", stats.streak, "day streak"], ["⭐", stats.stars, "stars"], ["🏅", earned, "badges"]].map(([i, n, l]) => (
              <div key={l as string} className="bg-white/20 backdrop-blur rounded-2xl py-2 pop">
                <div className="text-xl font-extrabold font-display">{i} {n}</div>
                <div className="text-[11px] font-bold text-white/85">{l}</div>
              </div>
            ))}
          </div>
        )}
        {stats && me.role !== "teacher" && (
          <div className="relative mt-3">
            <div className="flex justify-between text-[11px] font-bold text-white/85 mb-1"><span>Level {stats.level}</span><span>{Math.round(stats.levelProgress * 25)}/25 ⭐ to Level {stats.level + 1}</span></div>
            <div className="h-2.5 rounded-full bg-white/25 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 bar-grow" style={{ width: `${stats.levelProgress * 100}%` }} /></div>
          </div>
        )}
      </section>

      {/* Zoom */}
      {zoom ? (
        <a href={zoom} target="_blank" rel="noreferrer"
          className="block rounded-[1.75rem] p-5 text-white bg-gradient-to-r from-sky-500 to-cyan-400 shadow-xl shadow-sky-400/40 pulse-ring active:scale-[.98] transition fade-up" style={{ animationDelay: ".05s" }}>
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-white/25 grid place-items-center text-3xl">🎥</div>
            <div className="flex-1">
              <div className="font-display font-extrabold text-2xl leading-tight">Join Zoom Class</div>
              <div className="text-white/90 text-sm font-semibold">{classTime ? `⏰ ${classTime}` : "Tap to join"}</div>
            </div>
            <div className="text-3xl">→</div>
          </div>
        </a>
      ) : (
        <div className="card p-4 text-sm text-slate-600 fade-up">🎥 Zoom link not set yet.{me.role === "teacher" && <> <Link href="/settings" className="font-bold text-violet-600 underline">Add it in Settings</Link>.</>}</div>
      )}

      {/* To do */}
      {todo.items.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display font-extrabold text-xl flex items-center gap-2">🔔 {me.role === "teacher" ? "Needs your attention" : me.role === "parent" ? "Pending for Kashika" : "To do"} <span className="chip bg-rose-100 text-rose-700">{todo.items.length}</span></h2>
          {todo.items.map((it, i) => (
            <Link key={i} href={it.href} className="card card-lift flex items-center gap-3 p-3.5 fade-up" style={{ animationDelay: `${0.08 + i * 0.05}s` }}>
              <span className="size-12 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 grid place-items-center text-2xl">{it.icon}</span>
              <span className="flex-1 min-w-0"><span className="block font-extrabold truncate">{it.title}</span><span className="block text-xs text-slate-500 truncate">{it.sub}</span></span>
              <span className="text-violet-500 text-xl font-bold">›</span>
            </Link>
          ))}
        </section>
      )}
      {todo.items.length === 0 && stats && (
        <div className="card p-5 text-center fade-up"><div className="text-4xl">🎉</div><div className="font-display font-bold text-lg">All caught up!</div><div className="text-sm text-slate-500">Nothing is waiting right now.</div></div>
      )}

      {/* Attendance + tests */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/attendance" className="card card-lift p-4 flex items-center gap-4 fade-up">
          <Ring value={stats?.monthPct ?? 0} max={100} size={92}>
            <div><div className="font-display font-extrabold text-xl leading-none">{stats?.monthPct ?? "—"}{stats?.monthPct != null && "%"}</div><div className="text-[10px] font-bold text-slate-500">this month</div></div>
          </Ring>
          <div className="flex-1">
            <div className="font-extrabold">Attendance</div>
            <div className="text-xs text-slate-500">{stats ? `${stats.present} present · ${stats.absent} absent` : "…"}</div>
            {today_ && <div className={`mt-1 inline-flex items-center gap-1 text-xs font-extrabold text-white rounded-full px-2.5 py-1 bg-gradient-to-r ${today_[2]}`}>{today_[0]} {today_[1]}</div>}
            {!today_ && <div className="mt-1 text-xs text-slate-400 font-bold">Today: not marked</div>}
          </div>
        </Link>
        <Link href="/tests" className="card card-lift p-4 fade-up" style={{ animationDelay: ".05s" }}>
          <div className="font-extrabold mb-2">🏆 Upcoming tests</div>
          {tests.length === 0 ? <p className="text-sm text-slate-500">No tests coming up.</p> : (
            <ul className="space-y-1.5">
              {tests.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <SubjectChip subject={t.subject} />
                  <span className="flex-1 truncate font-semibold">{t.title}</span>
                  <span className={`chip ${daysTo(t.test_date) <= 1 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{daysTo(t.test_date) === 0 ? "Today" : daysTo(t.test_date) === 1 ? "Tomorrow" : `${daysTo(t.test_date)}d`}</span>
                </li>
              ))}
            </ul>
          )}
        </Link>
      </div>

      {/* Badges */}
      {stats && (
        <section className="card p-4 fade-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-extrabold text-xl">🏅 Badges</h2>
            <span className="text-sm font-bold text-slate-500">{earned}/{stats.badges.length} earned</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {stats.badges.map((b, i) => (
              <div key={b.id} title={b.hint} className={`rounded-2xl p-2 text-center ${b.earned ? "bg-gradient-to-b from-amber-50 to-yellow-100 border border-amber-200 pop" : "bg-slate-50 border border-slate-100 grayscale opacity-60"}`} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="text-3xl">{b.earned ? b.icon : "🔒"}</div>
                <div className="text-[11px] font-extrabold leading-tight mt-1">{b.name}</div>
                <div className="text-[9px] text-slate-500 leading-tight">{b.hint}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
