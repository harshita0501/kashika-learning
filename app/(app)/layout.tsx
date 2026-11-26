"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SessionProvider, type Me } from "@/lib/session";
import { TodoProvider, useTodo } from "@/lib/todo";

const NAV = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/homework", label: "Homework", icon: "📝" },
  { href: "/quizzes", label: "Quizzes", icon: "🧠" },
  { href: "/books", label: "Books", icon: "📖" },
  { href: "/flashcards", label: "Cards", icon: "🃏" },
  { href: "/speaking", label: "Speak", icon: "🎤" },
  { href: "/tests", label: "Tests", icon: "🏆" },
  { href: "/history", label: "My Work", icon: "📚" },
];
const PRIMARY = 4; // on phones only the first few show; the rest live under "More"
const BADGE_KEY: Record<string, "homework" | "quizzes" | "speaking" | "tests" | "flashcards"> = {
  "/homework": "homework", "/quizzes": "quizzes", "/speaking": "speaking", "/tests": "tests", "/flashcards": "flashcards",
};

function Badge({ href }: { href: string }) {
  const { counts } = useTodo();
  const k = BADGE_KEY[href];
  const n = k ? counts[k] : 0;
  if (!n) return null;
  return <span className="pop absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 text-white text-[10px] leading-[18px] text-center font-extrabold ring-2 ring-white">{n}</span>;
}

function MoreBadge() {
  const { counts } = useTodo();
  const n = NAV.slice(PRIMARY).reduce((t, x) => t + (BADGE_KEY[x.href] ? counts[BADGE_KEY[x.href]] : 0), 0);
  if (!n) return null;
  return <span className="pop absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 text-white text-[10px] leading-[18px] text-center font-extrabold ring-2 ring-white">{n}</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [more, setMore] = useState(false);
  const path = usePathname();

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name, role").eq("id", u.user.id).single();
      setMe({ id: u.user.id, name: p?.full_name || "User", role: p?.role ?? "student" });
    })();
  }, []);

  if (!me) return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center"><div className="text-6xl float">🦉</div><p className="font-display font-bold text-violet-700 mt-2">Loading…</p></div>
    </div>
  );

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <SessionProvider value={me}>
      <TodoProvider role={me.role}>
        <div className="max-w-3xl mx-auto pb-28 md:pb-10">
          <header className="flex items-center justify-between px-4 pt-4 pb-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="size-10 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 grid place-items-center text-xl shadow-md shadow-violet-300/60">🦉</span>
              <span className="font-display font-extrabold text-lg leading-none">Kashika<br /><span className="text-violet-600 text-sm font-bold">Learning</span></span>
            </Link>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden sm:block"><span className="chip bg-white text-slate-600 border border-violet-100">{me.name} · {me.role}</span></span>
              <Link href="/attendance" className={`size-10 grid place-items-center rounded-2xl bg-white border border-violet-100 text-lg ${active("/attendance") ? "ring-2 ring-violet-400" : ""}`} title="Attendance calendar">📅</Link>
              {me.role === "teacher" && <Link href="/settings" className={`size-10 grid place-items-center rounded-2xl bg-white border border-violet-100 text-lg ${active("/settings") ? "ring-2 ring-violet-400" : ""}`} title="Settings">⚙️</Link>}
              <Link href="/profile" className={`size-10 grid place-items-center rounded-2xl bg-white border border-violet-100 text-lg ${active("/profile") ? "ring-2 ring-violet-400" : ""}`} title="My profile">👤</Link>
              <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }} title="Log out"
                className="hidden sm:block px-3 h-10 rounded-2xl bg-white border border-violet-100 font-bold text-violet-700 whitespace-nowrap">Log out</button>
            </div>
          </header>

          <main className="px-4 pt-2" key={path}>{children}</main>

          {more && <div className="fixed inset-0 z-40" onClick={() => setMore(false)} />}
          <nav className="fixed bottom-3 inset-x-3 z-40 max-w-3xl mx-auto md:static md:mt-8 md:mx-4">
            {more && (
              <div className="md:hidden mb-2 card p-3 grid grid-cols-3 gap-2 pop">
                {[...NAV.slice(PRIMARY), { href: "/profile", label: "Profile", icon: "👤" }, { href: "/attendance", label: "Class", icon: "📅" }, ...(me.role === "teacher" ? [{ href: "/settings", label: "Settings", icon: "⚙️" }] : [])].map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => setMore(false)} className={`flex flex-col items-center gap-0.5 rounded-2xl py-3 ${active(n.href) ? "bg-violet-100 text-violet-700" : "bg-violet-50/60 text-slate-600"}`}>
                    <span className="relative text-2xl leading-none">{n.icon}<Badge href={n.href} /></span><span className="text-xs font-extrabold">{n.label}</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="flex justify-between gap-0.5 bg-white/90 backdrop-blur-xl border border-violet-100 shadow-xl shadow-violet-300/30 rounded-3xl p-1.5">
              {NAV.map((n, i) => (
                <Link key={n.href} href={n.href} onClick={() => setMore(false)}
                  className={`${i >= PRIMARY ? "hidden md:flex" : "flex"} flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition ${active(n.href) ? "bg-gradient-to-b from-violet-100 to-pink-100 text-violet-700 scale-105" : "text-slate-500 hover:bg-violet-50"}`}>
                  <span className="relative text-xl leading-none">{n.icon}<Badge href={n.href} /></span>
                  <span className="text-[10px] font-extrabold">{n.label}</span>
                </Link>
              ))}
              <button onClick={() => setMore((v) => !v)} className={`md:hidden flex-1 flex flex-col items-center gap-0.5 rounded-2xl py-1.5 transition ${more || NAV.slice(PRIMARY).some((n) => active(n.href)) || active("/profile") || active("/attendance") || active("/settings") ? "bg-gradient-to-b from-violet-100 to-pink-100 text-violet-700" : "text-slate-500"}`}>
                <span className="relative text-xl leading-none">⋯<MoreBadge /></span>
                <span className="text-[10px] font-extrabold">More</span>
              </button>
            </div>
          </nav>
        </div>
      </TodoProvider>
    </SessionProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-6xl float">🦉</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
