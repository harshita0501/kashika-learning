"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTodo } from "@/lib/todo";

/** Pops up once per visit for Kashika, listing everything waiting for her. */
export default function TodoModal() {
  const { items } = useTodo();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!items.length) return;
    try {
      if (sessionStorage.getItem("todo-popup-seen")) return;
      sessionStorage.setItem("todo-popup-seen", "1");
    } catch { /* storage blocked: still show once per page load */ }
    setOpen(true);
  }, [items.length]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-indigo-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-[2rem] w-full max-w-md p-5 space-y-3 shadow-2xl pop" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-6xl wiggle inline-block">🔔</div>
          <h2 className="text-2xl font-extrabold mt-1">You have {items.length} thing{items.length > 1 ? "s" : ""} to do!</h2>
          <p className="text-sm text-slate-500">Tap one to start 💪</p>
        </div>
        <ul className="space-y-2 max-h-72 overflow-auto">
          {items.map((it, i) => (
            <li key={i} className="fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
              <Link href={it.href} onClick={() => setOpen(false)} className="flex items-center gap-3 bg-gradient-to-r from-violet-50 to-pink-50 rounded-2xl px-4 py-3 border border-violet-100 active:scale-[.98] transition">
                <span className="text-3xl">{it.icon}</span>
                <span className="flex-1 min-w-0"><span className="block font-extrabold truncate">{it.title}</span><span className="block text-xs text-slate-500 truncate">{it.sub}</span></span>
                <span className="text-violet-600 font-extrabold text-xl">›</span>
              </Link>
            </li>
          ))}
        </ul>
        <button onClick={() => setOpen(false)} className="btn btn-ghost btn-big">I&apos;ll do it later</button>
      </div>
    </div>
  );
}
