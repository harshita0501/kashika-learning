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
  const tone = color === "green" ? "border-green-500 text-green-700 bg-green-50" : "border-indigo-500 text-indigo-700 bg-indigo-50";

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" name={name} accept={accept} multiple={multiple} onChange={onChange} className="hidden" />
      <button type="button" onClick={() => ref.current?.click()}
        className={`w-full border-2 border-dashed rounded-2xl py-5 px-4 flex flex-col items-center gap-1 active:scale-[.98] transition ${tone}`}>
        <span className="text-3xl">📷</span>
        <span className="font-bold">{files.length ? "Change / add more" : label}</span>
        <span className="text-xs opacity-80">{multiple ? "You can choose more than one page" : "Tap to choose"}</span>
      </button>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2 text-sm">
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
