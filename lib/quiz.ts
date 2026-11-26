export type QType = "mcq" | "fill" | "match";

export type Question = {
  id: string;
  quiz_id: string;
  position: number;
  type: QType;
  prompt: string;
  options: string[] | { left: string[]; right: string[] };
  answer: number | string[] | number[];
  explanation: string;
};

export type Quiz = {
  id: string;
  subject: string;
  topic: string;
  week_start: string;
  status: "draft" | "assigned";
  created_at: string;
};

export type Attempt = {
  id: string;
  quiz_id: string;
  responses: Record<string, number | string | number[]>;
  score: number;
  total: number;
  submitted_at: string;
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFC").replace(/[.,!?।'"’“”]/g, "").replace(/\s+/g, " ").trim();

export function isCorrect(q: Question, r: number | string | number[] | undefined): boolean {
  if (r === undefined || r === null) return false;
  if (q.type === "mcq") return r === q.answer;
  if (q.type === "fill") {
    return typeof r === "string" && (q.answer as string[]).some((a) => norm(a) === norm(r));
  }
  const want = q.answer as number[];
  return Array.isArray(r) && r.length === want.length && want.every((w, i) => r[i] === w);
}

export function gradeQuiz(questions: Question[], responses: Attempt["responses"]) {
  const score = questions.filter((q) => isCorrect(q, responses[q.id])).length;
  return { score, total: questions.length };
}

/** Monday of the current week, YYYY-MM-DD (local). */
export function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toLocaleDateString("en-CA");
}
