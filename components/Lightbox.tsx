"use client";
import { useEffect, useRef, useState } from "react";
import { fileUrl } from "@/lib/supabase";

const isPdf = (p: string) => p.toLowerCase().endsWith(".pdf");

/** Full-screen viewer for a set of uploaded files: arrows, keyboard, swipe, counter. Photos stay in the app (no new tab). */
export default function Lightbox({ paths, start = 0, title, onClose }: { paths: string[]; start?: number; title?: string; onClose: () => void }) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [i, setI] = useState(Math.min(start, paths.length - 1));
  const touch = useRef<number | null>(null);

  useEffect(() => { Promise.all(paths.map((p) => fileUrl(p))).then(setUrls); }, [paths]);
  const go = (d: number) => setI((x) => (x + d + paths.length) % paths.length);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.length]);

  const url = urls[i], many = paths.length > 1;
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center gap-2 p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 min-w-0 font-display font-extrabold truncate">{title ?? "Photo"}{many && <span className="ml-2 text-white/70 text-sm font-bold">{i + 1} / {paths.length}</span>}</div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold">Open ↗</a>}
        <button onClick={onClose} className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold">✕ Close</button>
      </div>

      <div className="relative flex-1 min-h-0 grid place-items-center"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (touch.current === null || !many) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}>
        <div className="w-full h-full grid place-items-center p-2" onClick={(e) => e.stopPropagation()}>
          {!url ? <div className="text-6xl float">🦉</div>
            : isPdf(paths[i]) ? <iframe src={url} title="PDF" className="w-full h-full max-w-4xl rounded-xl bg-white border-0" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={url} alt={`Photo ${i + 1}`} className="max-w-full max-h-full object-contain rounded-xl select-none" draggable={false} />}
        </div>
        {many && (
          <>
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/80 text-slate-900 text-2xl font-extrabold shadow-lg active:scale-90 transition">‹</button>
            <button onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/80 text-slate-900 text-2xl font-extrabold shadow-lg active:scale-90 transition">›</button>
          </>
        )}
      </div>

      {many && (
        <div className="flex gap-1.5 justify-center p-3" onClick={(e) => e.stopPropagation()}>
          {paths.map((p, k) => <button key={p} onClick={() => setI(k)} aria-label={`Go to ${k + 1}`} className={`h-2.5 rounded-full transition-all ${k === i ? "w-7 bg-white" : "w-2.5 bg-white/40"}`} />)}
        </div>
      )}
    </div>
  );
}
