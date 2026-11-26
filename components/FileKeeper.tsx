"use client";
import Thumb from "./Thumb";

/** Shows already-uploaded files with a ✕ to remove each one (the caller keeps the list of paths to keep). */
export default function FileKeeper({ paths, keep, setKeep, label }: { paths: string[]; keep: string[]; setKeep: (k: string[]) => void; label: string }) {
  if (!paths.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-extrabold">{label}</div>
      <div className="flex flex-wrap gap-3">
        {paths.map((p, i) => {
          const on = keep.includes(p);
          return (
            <div key={p} className={`relative transition ${on ? "" : "opacity-30 grayscale"}`}>
              <Thumb path={p} label={`Page ${i + 1}`} />
              <button type="button" onClick={() => setKeep(on ? keep.filter((x) => x !== p) : [...keep, p])}
                className={`absolute -top-2 -right-2 size-7 rounded-full text-white text-sm font-extrabold shadow ${on ? "bg-rose-500" : "bg-emerald-500"}`} title={on ? "Remove this" : "Keep this"}>
                {on ? "✕" : "↺"}
              </button>
            </div>
          );
        })}
      </div>
      {keep.length < paths.length && <p className="text-xs font-bold text-rose-600">{paths.length - keep.length} will be removed when you save.</p>}
    </div>
  );
}
