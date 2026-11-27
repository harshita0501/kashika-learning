"use client";
import { speak } from "@/lib/speech";

/** "Here is how to say it even better": the corrected, full version of what Kashika said, with a Listen button. */
export default function ImprovedAnswer({ said, improved }: { said?: string; improved?: string | null }) {
  if (!improved?.trim()) return null;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 border border-emerald-200 p-3 space-y-1.5 pop">
      <div className="font-display font-extrabold">✨ Say it like this</div>
      {said?.trim() && <div className="text-sm"><span className="font-extrabold text-slate-500">You said:</span> <span className="text-slate-600">{said}</span></div>}
      <div className="text-base font-extrabold text-emerald-800 leading-snug">“{improved}”</div>
      <button type="button" onClick={() => { void speak(improved, { rate: 0.88 }); }} className="btn btn-soft !py-1.5 !px-3 text-sm">🔊 Listen</button>
    </div>
  );
}
