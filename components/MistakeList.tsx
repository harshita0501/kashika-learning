"use client";

export type Mistake = { category: string; said: string; better: string; why: string };

const CAT: Record<string, { icon: string; label: string }> = {
  article: { icon: "🅰️", label: "Article (a / an / the)" },
  preposition: { icon: "📍", label: "Preposition (in / on / at / to…)" },
  tense: { icon: "⏰", label: "Tense" },
  plural: { icon: "🔢", label: "Plural" },
  verb_agreement: { icon: "🤝", label: "Verb with the right word" },
  missing_word: { icon: "🧩", label: "Missing word" },
  word_order: { icon: "↔️", label: "Word order" },
  word_choice: { icon: "💬", label: "Better word" },
  pronunciation: { icon: "🗣️", label: "Say it clearly" },
  other: { icon: "✏️", label: "Grammar" },
};

/** "Let's fix these" box: what she said, the better way, and why. */
export default function MistakeList({ items }: { items: Mistake[] | null | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 space-y-2 pop">
      <div className="font-display font-extrabold">✏️ Let&apos;s fix {items.length === 1 ? "this" : "these"}</div>
      {items.map((m, i) => {
        const c = CAT[m.category] ?? CAT.other;
        return (
          <div key={i} className="bg-white rounded-xl p-2.5 text-sm space-y-0.5">
            <span className="chip bg-amber-100 text-amber-800">{c.icon} {c.label}</span>
            <div><span className="text-rose-600 font-bold line-through decoration-2">{m.said}</span> <span className="text-slate-400">→</span> <span className="text-emerald-700 font-extrabold">{m.better}</span></div>
            {m.why && <div className="text-slate-600">💡 {m.why}</div>}
          </div>
        );
      })}
    </div>
  );
}
