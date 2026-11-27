"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fileUrl } from "@/lib/supabase";

const isPdf = (p: string) => p.toLowerCase().endsWith(".pdf");
const MAX = 6;

/** One image you can zoom (pinch / wheel / double-tap / buttons), pan in every direction, and rotate. */
type Api = { zoomBy: (f: number) => void; reset: () => void; rotate: () => void };

function ZoomStage({ url, onSwipe, onApi }: { url: string; onSwipe: (d: number) => void; onApi: (a: Api) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [v, setV] = useState({ s: 1, x: 0, y: 0, r: 0 });
  const [dragging, setDragging] = useState(false);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ d: number; s: number; cx: number; cy: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // how big the picture is when it just fits the screen (taking rotation into account)
  const rot90 = v.r % 180 !== 0;
  const rw = nat ? (rot90 ? nat.h : nat.w) : 1, rh = nat ? (rot90 ? nat.w : nat.h) : 1;
  const fit = nat && box.w ? Math.min(box.w / rw, box.h / rh) : 1;
  const bw = rw * fit, bh = rh * fit;   // fitted size on screen (after rotation)

  const clamp = useCallback((x: number, y: number, s: number) => {
    const mx = Math.max(0, (bw * s - box.w) / 2), my = Math.max(0, (bh * s - box.h) / 2);
    return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  }, [bw, bh, box.w, box.h]);

  // zoom so the point (cx, cy) – measured from the stage centre – stays under the finger / cursor
  const zoomAt = useCallback((factor: number, cx = 0, cy = 0, absolute = false) => {
    setV((o) => {
      const s = Math.min(MAX, Math.max(1, absolute ? factor : o.s * factor));
      if (s === o.s) return o;
      const k = s / o.s;
      const p = clamp(cx - (cx - o.x) * k, cy - (cy - o.y) * k, s);
      return s === 1 ? { ...o, s: 1, x: 0, y: 0 } : { ...o, s, ...p };
    });
  }, [clamp]);

  useEffect(() => {
    onApi({
      zoomBy: (f) => zoomAt(f),
      reset: () => setV((o) => ({ ...o, s: 1, x: 0, y: 0 })),
      rotate: () => setV((o) => ({ s: 1, x: 0, y: 0, r: (o.r + 90) % 360 })),
    });
  }, [onApi, zoomAt]);

  // mouse wheel / trackpad zoom (needs a non-passive listener to stop the page from scrolling)
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const rel = (e: React.PointerEvent) => { const r = stage.current!.getBoundingClientRect(); return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }; };

  function down(e: React.PointerEvent) {
    stage.current?.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: v.s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      start.current = null;
    } else { start.current = { x: e.clientX, y: e.clientY, moved: false }; }
    setDragging(true);
  }
  function move(e: React.PointerEvent) {
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2 && gesture.current) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), r = stage.current!.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - r.left - r.width / 2, cy = (a.y + b.y) / 2 - r.top - r.height / 2;
      zoomAt(gesture.current.s * (d / gesture.current.d), cx, cy, true);
      return;
    }
    if (ptrs.current.size === 1 && start.current) {
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 6) start.current.moved = true;
      if (v.s > 1) setV((o) => ({ ...o, ...clamp(o.x + (e.clientX - prev.x), o.y + (e.clientY - prev.y), o.s) }));
    }
  }
  function up(e: React.PointerEvent) {
    const s0 = start.current;
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) gesture.current = null;
    if (ptrs.current.size === 0) {
      setDragging(false);
      if (s0) {
        const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
        if (v.s === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);      // swipe to next / previous
        else if (!s0.moved) {                                                                                      // double tap = zoom in / out
          const now = Date.now();
          if (now - lastTap.current < 300) { const p = rel(e); v.s > 1 ? zoomAt(1, 0, 0, true) : zoomAt(2.5, p.x, p.y, true); lastTap.current = 0; }
          else lastTap.current = now;
        }
      }
      start.current = null;
    }
  }

  return (
    <div ref={stage} className="absolute inset-0 overflow-hidden select-none" style={{ touchAction: "none", cursor: v.s > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Photo" draggable={false} onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className="absolute left-1/2 top-1/2 max-w-none rounded-md shadow-2xl"
        style={{
          width: nat ? nat.w * fit : undefined, height: nat ? nat.h * fit : undefined, opacity: nat ? 1 : 0,
          transform: `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) scale(${v.s}) rotate(${v.r}deg)`,
          transition: dragging ? "none" : "transform .18s ease-out",
        }} />
      {!nat && <div className="absolute inset-0 grid place-items-center text-6xl float">🦉</div>}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white">{Math.round(v.s * 100)}%</div>
    </div>
  );
}

/** Full-screen viewer for uploaded photos / PDFs: previous / next, zoom, drag, rotate. Stays inside the app (no new tab). */
export default function Lightbox({ paths, start = 0, title, onClose, urls: direct }: { paths: string[]; start?: number; title?: string; onClose: () => void; urls?: string[] }) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [i, setI] = useState(Math.min(start, paths.length - 1));
  const [api, setApi] = useState<Api | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => { if (direct) setUrls(direct); else Promise.all(paths.map((p) => fileUrl(p))).then(setUrls); }, [paths, direct]);
  const go = useCallback((d: number) => setI((x) => (x + d + paths.length) % paths.length), [paths.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") api?.zoomBy(1.4);
      else if (e.key === "-") api?.zoomBy(1 / 1.4);
      else if (e.key === "0") api?.reset();
      else if (e.key.toLowerCase() === "r") api?.rotate();
    };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [go, onClose, api]);

  const url = urls[i], many = paths.length > 1, pdf = isPdf(paths[i] ?? "");
  const btn = "grid place-items-center size-11 rounded-full bg-white/15 text-white text-xl font-extrabold active:scale-90 transition hover:bg-white/25";
  // Rendered straight into <body> so no card / animation / overflow around the photo can cut it off.
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex h-dvh w-screen flex-col bg-black/95 select-none">
      <div className="flex items-center gap-2 p-3 text-white">
        <div className="flex-1 min-w-0 font-display font-extrabold truncate">{title ?? "Photo"}{many && <span className="ml-2 text-white/70 text-sm font-bold">{i + 1} / {paths.length}</span>}</div>
        {url && <a href={url} target="_blank" rel="noreferrer" className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold">Open ↗</a>}
        <button onClick={onClose} className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold">✕ Close</button>
      </div>

      <div className="relative flex-1 min-h-0">
        {!url ? <div className="absolute inset-0 grid place-items-center text-6xl float">🦉</div>
          : pdf ? <iframe src={url} title="PDF" className="absolute inset-0 h-full w-full bg-white border-0" />
          : <ZoomStage key={paths[i]} url={url} onSwipe={go} onApi={setApi} />}
        {many && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/85 text-slate-900 text-3xl font-extrabold shadow-lg active:scale-90 transition">‹</button>
            <button onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/85 text-slate-900 text-3xl font-extrabold shadow-lg active:scale-90 transition">›</button>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 p-3">
        {many && <div className="flex gap-1.5">{paths.map((p, k) => <button key={p} onClick={() => setI(k)} aria-label={`Go to ${k + 1}`} className={`h-2.5 rounded-full transition-all ${k === i ? "w-7 bg-white" : "w-2.5 bg-white/40"}`} />)}</div>}
        {!pdf && (
          <div className="flex items-center gap-2">
            <button onClick={() => api?.zoomBy(1 / 1.5)} aria-label="Zoom out" className={btn}>−</button>
            <button onClick={() => api?.reset()} aria-label="Fit to screen" className={`${btn} !w-auto px-4 !text-sm`}>Fit</button>
            <button onClick={() => api?.zoomBy(1.5)} aria-label="Zoom in" className={btn}>＋</button>
            <button onClick={() => api?.rotate()} aria-label="Rotate" className={btn}>⟳</button>
          </div>
        )}
        {!pdf && <div className="text-[11px] text-white/50 font-semibold">Pinch or double-tap to zoom · drag to move around</div>}
      </div>
    </div>,
    document.body,
  );
}
