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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-5xl">🔔</div>
          <h2 className="text-xl font-bold mt-1">You have {items.length} thing{items.length > 1 ? "s" : ""} to do!</h2>
        </div>
        <ul className="space-y-2 max-h-64 overflow-auto">
          {items.map((it, i) => (
            <li key={i}>
              <Link href={it.href} onClick={() => setOpen(false)} className="flex items-center gap-3 bg-indigo-50 rounded-2xl px-4 py-3 active:scale-[.98] transition">
                <span className="text-2xl">{it.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{it.title}</span>
                  <span className="block text-xs text-gray-600 truncate">{it.sub}</span>
                </span>
                <span className="text-indigo-600 font-bold">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <button onClick={() => setOpen(false)} className="w-full bg-gray-100 rounded-2xl py-3 font-semibold">I&apos;ll do it later</button>
      </div>
    </div>
  );
}
