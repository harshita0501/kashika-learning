"use client";
import { useEffect, useId, useState } from "react";
import { subjectMeta } from "@/lib/constants";

export function SubjectChip({ subject, className = "" }: { subject: string; className?: string }) {
  const m = subjectMeta(subject);
  return <span className={`chip ${m.chip} ${className}`}>{m.icon} {subject}</span>;
}

/** Circular progress ring. `children` renders in the middle. */
export function Ring({ value, max, size = 96, stroke = 10, from = "#7a55ff", to = "#ff5fa2", children }: {
  value: number; max: number; size?: number; stroke?: number; from?: string; to?: string; children?: React.ReactNode;
}) {
  const id = "g" + useId().replace(/:/g, "");
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eee9ff" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Confetti({ count = 46 }: { count?: number }) {
  const [bits, setBits] = useState<{ e: string; left: number; delay: number; dur: number; size: number }[]>([]);
  useEffect(() => {
    const e = ["🎉", "⭐", "✨", "🌟", "🎊", "💜", "🩷", "💛"];
    setBits(Array.from({ length: count }, (_, i) => ({
      e: e[i % e.length], left: Math.random() * 100, delay: Math.random() * 0.9, dur: 2.4 + Math.random() * 2, size: 16 + Math.random() * 18,
    })));
  }, [count]);
  return <>{bits.map((b, i) => <span key={i} className="confetti-bit" style={{ left: `${b.left}vw`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, fontSize: b.size }}>{b.e}</span>)}</>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 p-1.5 bg-white/80 backdrop-blur rounded-2xl border border-violet-100 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-[13px] sm:text-sm font-extrabold transition ${value === t.id ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-violet-50"}`}>
          {t.label}{t.count !== undefined && t.count > 0 && <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${value === t.id ? "bg-white/25" : "bg-violet-100 text-violet-700"}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="card p-8 text-center fade-up">
      <div className="text-5xl float inline-block">{emoji}</div>
      <div className="font-display font-bold text-lg mt-2">{title}</div>
      {sub && <div className="text-sm text-slate-500">{sub}</div>}
    </div>
  );
}

export function PageTitle({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 fade-up">
      <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 grid place-items-center text-2xl shadow-lg shadow-violet-300/50 wiggle">{emoji}</div>
      <div><h1 className="text-2xl font-extrabold leading-tight">{title}</h1>{sub && <p className="text-sm text-slate-500 -mt-0.5">{sub}</p>}</div>
    </div>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return <p className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-3 text-sm shake">{children}</p>;
}
