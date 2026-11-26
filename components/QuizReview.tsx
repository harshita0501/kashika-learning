"use client";
import { isCorrect, type Question, type Attempt } from "@/lib/quiz";

type Resp = Attempt["responses"][string];

export function correctText(q: Question): string {
  if (q.type === "mcq") return (q.options as string[])[q.answer as number];
  if (q.type === "fill") return (q.answer as string[])[0];
  const o = q.options as { left: string[]; right: string[] };
  return (q.answer as number[]).map((r, i) => `${o.left[i]} → ${o.right[r]}`).join("  ·  ");
}

export function respText(q: Question, r: Resp | undefined): string {
  if (r === undefined || r === null || r === "" || (Array.isArray(r) && r.every((x) => x === -1))) return "— (not answered)";
  if (q.type === "mcq") return (q.options as string[])[r as number] ?? "—";
  if (q.type === "fill") return String(r);
  const o = q.options as { left: string[]; right: string[] };
  return (r as number[]).map((x, i) => `${o.left[i]} → ${x >= 0 ? o.right[x] : "?"}`).join("  ·  ");
}

/** One question with the right answer, her answer (if given) and the explanation. Optional teacher controls. */
export default function Review({ q, n, resp, onRemove, onReplace, busy }: {
  q: Question; n: number; resp?: Resp; onRemove?: () => void; onReplace?: () => void; busy?: boolean;
}) {
  const answered = resp !== undefined;
  const ok = answered && isCorrect(q, resp);
  return (
    <article className={`card p-4 space-y-1.5 fade-up ${answered ? (ok ? "!bg-emerald-50 !border-emerald-200" : "!bg-rose-50 !border-rose-200") : ""}`} style={{ animationDelay: `${Math.min(n, 10) * 0.04}s` }}>
      <div className="font-extrabold">{answered && (ok ? "✅ " : "❌ ")}{n}. {q.prompt}</div>
      {q.type === "mcq" && <ul className="text-sm grid grid-cols-2 gap-1">{(q.options as string[]).map((o, i) => (
        <li key={i} className={`rounded-xl px-2.5 py-1.5 ${i === q.answer ? "bg-emerald-100 font-bold" : "bg-slate-50"}`}>{String.fromCharCode(65 + i)}. {o}</li>))}</ul>}
      {q.type === "match" && (
        <div className="text-sm grid grid-cols-2 gap-x-4 bg-slate-50 rounded-xl p-2">
          <div>{(q.options as { left: string[] }).left.map((l, i) => <div key={i}>{l}</div>)}</div>
          <div>{(q.options as { right: string[] }).right.map((r, i) => <div key={i}>{r}</div>)}</div>
        </div>
      )}
      {answered && <div className="text-sm"><b>{ok ? "Her answer:" : "Her answer:"}</b> <span className={ok ? "text-emerald-700" : "text-rose-700"}>{respText(q, resp)}</span></div>}
      <div className="text-sm"><b>Correct answer:</b> {correctText(q)}</div>
      {q.explanation && <div className="text-sm text-slate-600 bg-white/70 rounded-xl px-3 py-1.5">💡 {q.explanation}</div>}
      {onRemove && (
        <div className="flex gap-4 pt-1 text-sm">
          <button disabled={busy} onClick={onReplace} className="text-violet-600 font-extrabold disabled:opacity-40">🔄 Replace with new</button>
          <button disabled={busy} onClick={onRemove} className="text-rose-600 font-extrabold disabled:opacity-40">🗑 Remove</button>
        </div>
      )}
    </article>
  );
}
