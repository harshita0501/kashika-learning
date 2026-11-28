export const SUBJECTS = ["Hindi", "English", "EVS", "Maths", "Science", "Social Studies"] as const;
export type Role = "student" | "teacher" | "parent";
export type AttStatus = "present" | "absent" | "holiday";

export const SUBJECT_META: Record<string, { icon: string; chip: string; grad: string; bar: string; soft: string }> = {
  Hindi:   { icon: "🪔", chip: "bg-orange-100 text-orange-800", grad: "from-orange-400 to-amber-400", bar: "bg-orange-400", soft: "bg-orange-50" },
  English: { icon: "🔤", chip: "bg-sky-100 text-sky-800", grad: "from-sky-400 to-blue-500", bar: "bg-sky-400", soft: "bg-sky-50" },
  EVS:     { icon: "🌳", chip: "bg-emerald-100 text-emerald-800", grad: "from-emerald-400 to-green-500", bar: "bg-emerald-400", soft: "bg-emerald-50" },
  Maths:   { icon: "➗", chip: "bg-violet-100 text-violet-800", grad: "from-violet-500 to-fuchsia-500", bar: "bg-violet-500", soft: "bg-violet-50" },
  Science: { icon: "🔬", chip: "bg-pink-100 text-pink-800", grad: "from-pink-400 to-rose-500", bar: "bg-pink-400", soft: "bg-pink-50" },
  "Social Studies": { icon: "🌏", chip: "bg-cyan-100 text-cyan-800", grad: "from-cyan-500 to-teal-500", bar: "bg-cyan-500", soft: "bg-cyan-50" },
};
export const subjectMeta = (s: string) => SUBJECT_META[s] ?? { icon: "📘", chip: "bg-gray-100 text-gray-800", grad: "from-slate-400 to-slate-500", bar: "bg-slate-400", soft: "bg-slate-50" };
/** @deprecated kept for older imports */
export const SUBJECT_STYLE: Record<string, string> = Object.fromEntries(Object.entries(SUBJECT_META).map(([k, v]) => [k, v.chip]));
