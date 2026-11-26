"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SessionProvider, type Me } from "@/lib/session";
import { TodoProvider, useTodo } from "@/lib/todo";

const NAV = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/attendance", label: "Attendance", icon: "📅" },
  { href: "/homework", label: "Homework", icon: "📝" },
  { href: "/quizzes", label: "Quizzes", icon: "🧠" },
  { href: "/speaking", label: "Speaking", icon: "🎤" },
  { href: "/tests", label: "Tests", icon: "🏆" },
];

const BADGE_KEY: Record<string, "homework" | "quizzes" | "speaking" | "tests"> = {
  "/homework": "homework", "/quizzes": "quizzes", "/speaking": "speaking", "/tests": "tests",
};

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

  if (!me) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  const nav = me.role === "teacher" ? [...NAV, { href: "/settings", label: "Settings", icon: "⚙️" }] : NAV;

  return (
    <SessionProvider value={me}>
      <TodoProvider role={me.role}>
      <div className="max-w-3xl mx-auto pb-24 md:pb-8">
        <header className="flex items-center justify-between p-4">
          <div className="font-bold text-lg">📚 Kashika Learning</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{me.name} · {me.role}</span>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
              className="text-indigo-600 font-medium"
            >Log out</button>
          </div>
        </header>
        <main className="px-4">{children}</main>
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex justify-around md:static md:border-0 md:bg-transparent md:justify-center md:gap-4 md:mt-6">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex flex-col md:flex-row md:gap-2 items-center px-3 py-2 text-xs md:text-sm md:rounded-full ${
                (n.href === "/" ? path === "/" : path.startsWith(n.href)) ? "text-indigo-600 font-bold md:bg-indigo-100" : "text-gray-500"}`}>
              <span className="relative text-xl md:text-base">{n.icon}<Badge href={n.href} /></span>{n.label}
            </Link>
          ))}
        </nav>
      </div>
      </TodoProvider>
    </SessionProvider>
  );
}

function Badge({ href }: { href: string }) {
  const { counts } = useTodo();
  const k = BADGE_KEY[href];
  const n = k ? counts[k] : 0;
  if (!n) return null;
  return <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-bold">{n}</span>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
