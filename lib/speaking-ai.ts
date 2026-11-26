import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { withSource, type ChapterSource } from "./book-source";

const MODEL = process.env.QUIZ_MODEL || "claude-opus-5-5";

export type Kind = "repeat" | "answer" | "describe";
export type DraftTask = { kind: Kind; prompt: string; target: string; hint: string };

const TaskSchema = z.object({
  kind: z.enum(["repeat", "answer", "describe"]),
  prompt: z.string(), // what Kashika reads/hears, e.g. "Listen and say this sentence." / "What is your favourite fruit? Say 2 sentences."
  target: z.string(), // repeat: the exact sentence to say. Otherwise ""
  hint: z.string(), // a sentence starter or tip, e.g. "I like ... because ...". May be ""
});
const GenOut = z.object({ topic: z.string(), tasks: z.array(TaskSchema) });
const ScoreOut = z.object({ score: z.number(), feedback: z.string() });

const GEN_SYSTEM = `You design short spoken-English practice for Kashika, a Class 3 student (age 8-9) in India who is learning English.
Make speaking tasks she can do by recording a voice note of 5-20 seconds.
Task kinds:
- repeat: "Listen and say this sentence." target = ONE short sentence (5-9 simple words) she reads and repeats. Prefer words that are a bit tricky for Indian children (th, v/w, s/sh, plurals), but still easy to read.
- answer: a simple question about her life or the topic; she answers in 1-2 full sentences. target = "".
- describe: she describes a thing, animal, place or routine in 2-3 sentences. target = "".
Rules: friendly tone; very simple words; no tongue-twisters that are too hard; nothing sensitive. hint = a short sentence starter such as "My favourite animal is ... because ..." (or "" for repeat).
Mix kinds: for 4 tasks use 2 repeat, 1 answer, 1 describe. If no topic is given, pick a fun everyday topic (family, school, food, animals, festival, weather ...) and return it in "topic".`;

const SCORE_SYSTEM = `You are a kind English speaking coach for Kashika, a Class 3 student (age 8-9) in India. You get the task and an automatic transcript of her voice note.
The transcript comes from speech recognition, so small spelling slips, missing capital letters or punctuation are NOT her fault - ignore them, and be generous when a word could be a mishearing of an Indian accent.
Give a score from 0 to 5 (whole numbers):
- repeat tasks: compare with the target sentence. 5 = all or nearly all words right in order; 4 = one small slip; 3 = about half right; 2 = a few words; 1 = barely related; 0 = nothing/unrelated.
- answer/describe tasks: 5 = relevant, clear full sentence(s), good grammar for Class 3; 4 = relevant with a small grammar slip; 3 = relevant but very short or several slips; 2 = partly relevant or single words; 1 = barely related; 0 = nothing/unrelated.
feedback: 1-2 short, warm sentences written TO Kashika in very simple English: start with something she did well, then exactly one tip (e.g. a word to practise or a better sentence). No long lists, no jargon.`;

function client() { return new Anthropic(); }

export async function generateTasks(topic: string, count: number, avoid: string[] = [], onlyKind?: Kind, source?: ChapterSource | null): Promise<{ topic: string; tasks: DraftTask[] }> {
  const user = `Topic: ${topic.trim() || source?.title || "(none - you choose)"}\nWrite ${count} task${count > 1 ? "s" : ""}${onlyKind ? ` of kind "${onlyKind}"` : ""}.` +
    (avoid.length ? `\n\nDo not repeat or closely resemble:\n${avoid.map((a) => "- " + a).join("\n")}` : "");
  const res = await client().beta.messages.parse({
    model: MODEL, max_tokens: 4000, system: GEN_SYSTEM,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "low", format: zodOutputFormat(GenOut) },
    messages: [{ role: "user", content: withSource(user, source) as never }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The AI could not write these tasks. Try a different topic.");
  const tasks = res.parsed_output.tasks
    .map((t) => ({ kind: t.kind, prompt: t.prompt.trim(), target: t.kind === "repeat" ? t.target.trim() : "", hint: t.hint.trim() }))
    .filter((t) => t.prompt && (t.kind !== "repeat" || t.target.split(/\s+/).length >= 3));
  return { topic: res.parsed_output.topic.trim() || topic.trim(), tasks };
}

export async function scoreSpeech(task: { kind: Kind; prompt: string; target: string }, transcript: string): Promise<{ score: number; feedback: string }> {
  const user = `Task type: ${task.kind}\nTask: ${task.prompt}\n${task.kind === "repeat" ? `Target sentence: ${task.target}\n` : ""}Transcript of Kashika's voice note: "${transcript}"`;
  const res = await client().beta.messages.parse({
    model: MODEL, max_tokens: 1500, system: SCORE_SYSTEM,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "low", format: zodOutputFormat(ScoreOut) },
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The AI could not check this recording.");
  const score = Math.max(0, Math.min(5, Math.round(res.parsed_output.score)));
  return { score, feedback: res.parsed_output.feedback.trim() };
}
