"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fileUrl } from "@/lib/supabase";
import Lightbox from "./Lightbox";

/** Full-screen reader for a chapter's files (PDF in a frame, photos as images). */
/** Photos open in the zoomable viewer; PDFs open in a frame. */
export default function ChapterReader(props: { title: string; paths: string[]; onClose: () => void }) {
  const photosOnly = props.paths.length > 0 && props.paths.every((p) => !p.toLowerCase().endsWith(".pdf"));
  return photosOnly ? <Lightbox paths={props.paths} title={`📖 ${props.title}`} onClose={props.onClose} /> : <PdfReader {...props} />;
}

function PdfReader({ title, paths, onClose }: { title: string; paths: string[]; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => { Promise.all(paths.map((p) => fileUrl(p))).then(setUrls); }, [paths]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const path = paths[i], url = urls[i];
  const isPdf = path?.toLowerCase().endsWith(".pdf");
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-sm flex flex-col p-2 sm:p-6">
      <div className="card flex-1 flex flex-col overflow-hidden pop max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-2 p-3 border-b border-violet-100">
          <div className="flex-1 min-w-0"><div className="text-xs font-extrabold text-violet-600">📖 Reading</div><div className="font-display font-extrabold truncate">{title}</div></div>
          {url && <a href={url} target="_blank" rel="noreferrer" className="btn btn-soft !py-2 text-sm">Open full screen ↗</a>}
          <button onClick={onClose} className="btn btn-ghost !py-2 text-sm">✕ Close</button>
        </div>
        {paths.length > 1 && (
          <div className="flex gap-1.5 p-2 overflow-x-auto border-b border-violet-100">
            {paths.map((p, k) => <button key={p} onClick={() => setI(k)} className={`chip !text-sm !py-1.5 whitespace-nowrap ${k === i ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700"}`}>Part {k + 1}</button>)}
          </div>
        )}
        <div className="flex-1 overflow-auto bg-slate-100">
          {!url ? <div className="p-10 text-center text-5xl float">🦉</div>
            : isPdf ? <iframe src={url} title={title} className="w-full h-full min-h-[60vh] border-0" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={url} alt={title} className="mx-auto max-w-full" />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
