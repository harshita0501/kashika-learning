import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { withSource, type ChapterSource } from "./book-source";

const MODEL = process.env.QUIZ_MODEL || "claude-opus-5-5";

const Q = z.object({
  type: z.enum(["mcq", "fill", "match"]),
  prompt: z.string(),
  choices: z.array(z.string()), // mcq: exactly 4 options. Otherwise []
  correct_choice: z.number(), // mcq: 0-3. Otherwise -1
  accepted_answers: z.array(z.string()), // fill: every acceptable spelling/form. Otherwise []
  pairs: z.array(z.object({ left: z.string(), right: z.string() })), // match: 4 pairs. Otherwise []
  explanation: z.string(),
});
const Out = z.object({ questions: z.array(Q) });

export type DraftQuestion = {
  type: "mcq" | "fill" | "match";
  prompt: string;
  options: string[] | { left: string[]; right: string[] };
  answer: number | string[] | number[];
  explanation: string;
};

const SYSTEM = `You write short weekly practice quizzes for Kashika, a Class 3 student (age 8-9) in India. Her teacher gives you one topic per subject.

Rules:
- Level: Class 3 (NCERT/CBSE style). Simple words, short sentences, friendly tone. Nothing too hard, nothing babyish.
- Hindi subject: write everything (questions, choices, explanations) in Hindi, Devanagari script. Every other subject: simple English.
- Each question must have exactly one clearly correct answer. No trick questions, no opinion questions, and nothing that needs a picture or diagram.
- Pick the question type that suits each question best, and mix types when the topic allows:
  * mcq: 4 choices, correct_choice is the 0-based index of the right one, other fields empty ([] / -1).
  * fill: a sentence or sum containing "____" for the blank. accepted_answers lists every acceptable answer (e.g. "6" and "six"; both spellings). choices=[], pairs=[], correct_choice=-1.
  * match: exactly 4 pairs, e.g. word <-> opposite, animal <-> home, country <-> capital. The prompt says what to match. choices=[], accepted_answers=[], correct_choice=-1.
  Maths: prefer mcq and fill with small numbers, double-check every calculation. English grammar: prefer fill and mcq.
- explanation: one short, encouraging sentence that says why the answer is right.
- Never repeat a question, and never write a question that gives away another one's answer.`;

function clean(raw: z.infer<typeof Q>): DraftQuestion | null {
  const prompt = raw.prompt.trim();
  if (!prompt) return null;
  const explanation = raw.explanation.trim();
  if (raw.type === "mcq") {
    const c = raw.choices.map((x) => x.trim()).filter(Boolean);
    if (c.length !== 4 || new Set(c).size !== 4 || !Number.isInteger(raw.correct_choice) || raw.correct_choice < 0 || raw.correct_choice > 3) return null;
    return { type: "mcq", prompt, options: c, answer: raw.correct_choice, explanation };
  }
  if (raw.type === "fill") {
    const a = raw.accepted_answers.map((x) => x.trim()).filter(Boolean);
    if (!a.length || !prompt.includes("__")) return null;
    return { type: "fill", prompt, options: [], answer: a, explanation };
  }
  const p = raw.pairs.filter((x) => x.left.trim() && x.right.trim());
  if (p.length < 3 || new Set(p.map((x) => x.right.trim())).size !== p.length) return null;
  // shuffle the right column; answer[i] = index in shuffled right list for left i
  const idx = p.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  if (idx.every((v, i) => v === i)) idx.push(idx.shift()!); // avoid the identity order
  const right = idx.map((i) => p[i].right.trim());
  const answer = p.map((_, i) => idx.indexOf(i));
  return { type: "match", prompt, options: { left: p.map((x) => x.left.trim()), right }, answer, explanation };
}

export async function generateQuestions(subject: string, topic: string, count: number, avoid: string[] = [], source?: ChapterSource | null): Promise<DraftQuestion[]> {
  const client = new Anthropic();
  const user = `Subject: ${subject}\nTopic this week: ${topic || source?.title || ""}\nWrite ${count} question${count > 1 ? "s" : ""}.` +
    (avoid.length ? `\n\nDo not repeat or closely resemble these existing questions:\n${avoid.map((a) => "- " + a).join("\n")}` : "");

  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: zodOutputFormat(Out) },
    messages: [{ role: "user", content: withSource(user, source) as never }],
  });

  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error("The AI could not write this quiz. Try rewording the topic.");
  }
  return res.parsed_output.questions.map(clean).filter((x): x is DraftQuestion => x !== null);
}
