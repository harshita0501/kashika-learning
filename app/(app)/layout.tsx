"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SessionProvider, type Me } from "@/lib/session";

const NAV = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/attendance", label: "Attendance", icon: "📅" },
  { href: "/homework", label: "Homework", icon: "📝" },
  { href: "/tests", label: "Tests", icon: "🏆" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
                path === n.href ? "text-indigo-600 font-bold md:bg-indigo-100" : "text-gray-500"}`}>
              <span className="text-xl md:text-base">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
      </div>
    </SessionProvider>
  );
}
