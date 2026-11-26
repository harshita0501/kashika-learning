"use client";
import { useEffect, useState } from "react";
import { fileUrl } from "@/lib/supabase";

export default function AudioPlayer({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { fileUrl(path).then(setSrc); }, [path]);
  if (!src) return <span className="text-xs text-gray-400">Loading audio…</span>;
  return <audio controls src={src} className="w-full" />;
}
