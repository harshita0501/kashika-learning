"use client";
import { useRef, useState } from "react";

const keyOf = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
/** Can we put several files into an <input type=file> from code? (all current phones and browsers can) */
function canMerge() { try { new DataTransfer(); return true; } catch { return false; } }

/**
 * Big, obvious upload area. With `multiple`, every new pick is ADDED to the ones already chosen
 * (the browser would normally replace them), and each file can be removed with ✕.
 * Works inside a <form>: the chosen files are what the form submits.
 */
export default function FileInput({
  name = "file", label = "Add photo or file", multiple = false, accept = "image/*,application/pdf", color = "indigo", compact = false, disabled = false,
}: { name?: string; label?: string; multiple?: boolean; accept?: string; color?: "indigo" | "green"; compact?: boolean; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  /** Show `list` and make the real input hold exactly the same files. */
  function sync(list: File[]) {
    setFiles(list);
    if (!ref.current) return;
    try {
      const dt = new DataTransfer();
      list.forEach((f) => dt.items.add(f));
      ref.current.files = dt.files;
    } catch { if (!list.length) ref.current.value = ""; }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!multiple || !canMerge()) { setFiles(picked); return; }
    const merged = [...files];
    for (const p of picked) if (!merged.some((m) => keyOf(m) === keyOf(p))) merged.push(p);
    sync(merged);
  }
  const removeAt = (i: number) => sync(files.filter((_, k) => k !== i));
  const clear = () => sync([]);

  const tone = color === "green" ? "border-emerald-400 text-emerald-700 bg-gradient-to-br from-emerald-50 to-green-50" : "border-violet-400 text-violet-700 bg-gradient-to-br from-violet-50 to-pink-50";
  const many = multiple && files.length > 0;

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" name={name} accept={accept} multiple={multiple} onChange={onChange} className="hidden" />
      {compact ? (
        <button type="button" disabled={disabled} onClick={() => ref.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/60 px-3 py-2 text-sm font-extrabold text-violet-700 active:scale-[.98] transition disabled:opacity-50">
          📷 {files.length ? `${files.length} file${files.length > 1 ? "s" : ""} selected — add more` : label}
        </button>
      ) : (
        <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
          className={`w-full border-[3px] border-dashed rounded-3xl py-6 px-4 flex flex-col items-center gap-1 active:scale-[.98] hover:brightness-95 transition disabled:opacity-50 ${tone}`}>
          <span className="text-4xl float">📷</span>
          <span className="font-display font-extrabold text-lg">{files.length ? (many ? "➕ Add another photo" : "Change photo") : label}</span>
          <span className="text-xs opacity-80">{multiple ? (files.length ? `${files.length} selected — tap to add more` : "You can add more than one page") : "Tap to choose"}</span>
        </button>
      )}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={keyOf(f) + i} className="flex items-center gap-2 bg-white border border-violet-100 rounded-2xl px-3 py-2 text-sm pop">
              <span className="font-extrabold text-violet-600">{i + 1}.</span>
              <span>{f.type.startsWith("image/") ? "🖼️" : "📄"}</span>
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-500">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeAt(i)} aria-label={`Remove ${f.name}`} className="size-7 rounded-full bg-rose-50 text-rose-600 font-extrabold">✕</button>
            </li>
          ))}
          {files.length > 1 && <li><button type="button" onClick={clear} className="text-xs font-bold text-red-600">Remove all</button></li>}
        </ul>
      )}
    </div>
  );
}
