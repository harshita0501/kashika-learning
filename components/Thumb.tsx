"use client";
import { useEffect, useState } from "react";
import { fileUrl } from "@/lib/supabase";

const isImg = (p: string) => /\.(png|jpe?g|webp|gif|heic)$/i.test(p);

/** Thumbnail for an uploaded image (tap to open full size); a file chip for PDFs etc. */
export default function Thumb({ path, label }: { path: string; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { fileUrl(path).then(setUrl); }, [path]);
  const open = () => url && window.open(url, "_blank");
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
