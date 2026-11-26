"use client";
import { useState } from "react";
import { ErrorBox } from "./ui";

/** Ma'am picks how many more she wants; the AI adds that many to this set. */
export default function AddMore({ what, endpoint, body, options, defaultCount, onDone }: {
  what: string; endpoint: string; body: Record<string, string>; options: number[]; defaultCount: number; onDone: () => void;
}) {
  const [n, setN] = useState(defaultCount);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, count: n }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      onDone();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <div className="card p-3 space-y-2 fade-up">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold">➕ Need more {what}?</span>
        <select value={n} onChange={(e) => setN(Number(e.target.value))} disabled={busy} className="field !w-auto !py-1.5 font-bold">
          {options.map((o) => <option key={o} value={o}>{o} more</option>)}
        </select>
        <button onClick={go} disabled={busy} className="btn btn-primary !py-2 text-sm">{busy ? "🪄 Making…" : "🪄 Add with AI"}</button>
      </div>
      {err && <ErrorBox>{err}</ErrorBox>}
    </div>
  );
}
