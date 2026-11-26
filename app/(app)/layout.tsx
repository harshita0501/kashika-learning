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
  { href: "/flashcards", label: "Cards", icon: "🃏" },
  { href: "/speaking", label: "Speak", icon: "🎤" },
  { href: "/tests", label: "Tests", icon: "🏆" },
  { href: "/history", label: "My Work", icon: "📚" },
];
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

function Shell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
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
              <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                className="px-3 h-10 rounded-2xl bg-white border border-violet-100 font-bold text-violet-700 whitespace-nowrap">Log out</button>
            </div>
          </header>

          <main className="px-4 pt-2" key={path}>{children}</main>

          <nav className="fixed bottom-3 inset-x-3 z-40 max-w-3xl mx-auto md:static md:mt-8 md:mx-4">
            <div className="flex justify-between gap-0.5 bg-white/90 backdrop-blur-xl border border-violet-100 shadow-xl shadow-violet-300/30 rounded-3xl p-1.5">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}
                  className={`flex-1 flex flex-col items-center gap-0.5 rounded-2xl py-1.5 transition ${active(n.href) ? "bg-gradient-to-b from-violet-100 to-pink-100 text-violet-700 scale-105" : "text-slate-500 hover:bg-violet-50"}`}>
                  <span className="relative text-xl leading-none">{n.icon}<Badge href={n.href} /></span>
                  <span className="text-[10px] font-extrabold">{n.label}</span>
                </Link>
              ))}
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
