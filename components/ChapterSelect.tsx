"use client";
import type { ChapterOpt } from "@/lib/chapters";

/** "📖 From a book chapter (optional)" dropdown. Chapters of the matching subject are listed first. */
export default function ChapterSelect({ chapters, value, onChange, subject, disabled, className = "" }: {
  chapters: ChapterOpt[]; value: string; onChange: (v: string) => void; subject?: string; disabled?: boolean; className?: string;
}) {
  if (!chapters.length) return null;
  const match = (c: ChapterOpt) => !subject || c.subject === subject || (subject === "Science" && c.subject === "EVS");
  const groups = (list: ChapterOpt[]) => [...new Set(list.map((c) => c.bookTitle))].map((b) => ({ b, items: list.filter((c) => c.bookTitle === b) }));
  const first = chapters.filter(match), rest = chapters.filter((c) => !match(c));
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`field !py-2 text-sm ${className}`}>
      <option value="">📖 No book — use my topic only</option>
      {groups(first).map((g) => <optgroup key={g.b} label={g.b}>{g.items.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</optgroup>)}
      {rest.length > 0 && groups(rest).map((g) => <optgroup key={g.b} label={`Other: ${g.b}`}>{g.items.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</optgroup>)}
    </select>
  );
}
