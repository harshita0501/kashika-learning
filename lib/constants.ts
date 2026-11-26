export const SUBJECTS = ["Hindi", "English", "EVS", "Maths", "Science"] as const;
export type Role = "student" | "teacher" | "parent";
export type AttStatus = "present" | "absent" | "holiday";

export const SUBJECT_STYLE: Record<string, string> = {
  Hindi: "bg-orange-100 text-orange-800",
  English: "bg-blue-100 text-blue-800",
  EVS: "bg-green-100 text-green-800",
  Maths: "bg-purple-100 text-purple-800",
  Science: "bg-pink-100 text-pink-800",
};
