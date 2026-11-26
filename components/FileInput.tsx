"use client";
import { useRef, useState } from "react";

/** Big, obvious upload area: tap to take a photo / choose files; shows what was picked. Works inside <form> (name is submitted). */
export default function FileInput({
  name = "file", label = "Add photo or file", multiple = false, accept = "image/*,application/pdf", color = "indigo",
}: { name?: string; label?: string; multiple?: boolean; accept?: string; color?: "indigo" | "green" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []));
  }
  function clear() {
    if (ref.current) ref.current.value = "";
    setFiles([]);
  }
  const tone = color === "green" ? "border-emerald-400 text-emerald-700 bg-gradient-to-br from-emerald-50 to-green-50" : "border-violet-400 text-violet-700 bg-gradient-to-br from-violet-50 to-pink-50";

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" name={name} accept={accept} multiple={multiple} onChange={onChange} className="hidden" />
      <button type="button" onClick={() => ref.current?.click()}
        className={`w-full border-[3px] border-dashed rounded-3xl py-6 px-4 flex flex-col items-center gap-1 active:scale-[.98] hover:brightness-95 transition ${tone}`}>
        <span className="text-4xl float">📷</span>
        <span className="font-display font-extrabold text-lg">{files.length ? "Change / add more" : label}</span>
        <span className="text-xs opacity-80">{multiple ? "You can choose more than one page" : "Tap to choose"}</span>
      </button>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 bg-white border border-violet-100 rounded-2xl px-3 py-2 text-sm pop">
              <span>{f.type.startsWith("image/") ? "🖼️" : "📄"}</span>
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-500">{(f.size / 1024).toFixed(0)} KB</span>
            </li>
          ))}
          <li><button type="button" onClick={clear} className="text-xs text-red-600">Remove selection</button></li>
        </ul>
      )}
    </div>
  );
}
