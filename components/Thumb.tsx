"use client";
import { useEffect, useState } from "react";
import { fileUrl } from "@/lib/supabase";
import Lightbox from "./Lightbox";

const isImg = (p: string) => /\.(png|jpe?g|webp|gif|heic)$/i.test(p);

/** One thumbnail. Tapping calls `onOpen` (used by ThumbGrid to open the viewer); on its own it opens the file in a new tab. */
export default function Thumb({ path, label, onOpen }: { path: string; label?: string; onOpen?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { fileUrl(path).then(setUrl); }, [path]);
  const open = () => { if (onOpen) onOpen(); else if (url) window.open(url, "_blank"); };
  if (isImg(path)) {
    return (
      <button type="button" onClick={open} className="relative size-20 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-violet-100 active:scale-95 transition">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={label ?? "upload"} className="size-full object-cover" /> : <span className="grid place-items-center size-full text-xl">🖼️</span>}
      </button>
    );
  }
  return (
    <button type="button" onClick={open} className="h-20 px-3 rounded-2xl bg-white border-2 border-violet-100 shadow-sm flex flex-col items-center justify-center text-xs font-bold text-violet-700 active:scale-95 transition">
      <span className="text-2xl">📄</span>{label ?? "Open file"}
    </button>
  );
}

/** A row of thumbnails that opens a swipe-able viewer (next / previous) on tap. */
export function ThumbGrid({ paths, label = "Page", title, className = "flex flex-wrap gap-2", renderExtra }: {
  paths: string[]; label?: string; title?: string; className?: string; renderExtra?: (path: string, index: number) => React.ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!paths.length) return null;
  return (
    <>
      <div className={className}>
        {paths.map((p, i) => (
          <div key={p} className={renderExtra ? "relative" : undefined}>
            <Thumb path={p} label={paths.length > 1 ? `${label} ${i + 1}` : label} onOpen={() => setOpen(i)} />
            {renderExtra?.(p, i)}
          </div>
        ))}
      </div>
      {open !== null && <Lightbox paths={paths} start={open} title={title ?? label} onClose={() => setOpen(null)} />}
    </>
  );
}
