import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { withSource, type ChapterSource } from "./book-source";
import { freshNote } from "./ai-history";

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
const Mistake = z.object({
  category: z.enum(["article", "preposition", "tense", "plural", "verb_agreement", "missing_word", "word_order", "word_choice", "pronunciation", "other"]),
  said: z.string(), // the exact words she said that are wrong (short phrase)
  better: z.string(), // the corrected phrase
  why: z.string(), // one very short, kind reason in simple English
});
const ScoreOut = z.object({ score: z.number(), feedback: z.string(), mistakes: z.array(Mistake), improved: z.string() });
export type SpeakMistake = z.infer<typeof Mistake>;

const GEN_SYSTEM = `You design short spoken-English practice for Kashika, a Class 3 student (age 8-9) in India who is learning English.
Make speaking tasks she can do by recording a voice note of 5-20 seconds.
Task kinds:
- repeat: "Listen and say this sentence." target = ONE short sentence (5-9 simple words) she reads and repeats. Prefer words that are a bit tricky for Indian children (th, v/w, s/sh, plurals), but still easy to read.
- answer: a simple question about her life or the topic; she answers in 1-2 full sentences. target = "".
- describe: she describes a thing, animal, place or routine in 2-3 sentences. target = "".
Rules: friendly tone; very simple words; no tongue-twisters that are too hard; nothing sensitive. hint = a short sentence starter such as "My favourite animal is ... because ..." (or "" for repeat).
Mix kinds: roughly half repeat, the rest answer and describe (for 4 tasks: 2 repeat, 1 answer, 1 describe). If no topic is given, pick a fun everyday topic (family, school, food, animals, festival, weather ...) and return it in "topic".`;

const SCORE_SYSTEM = `You are a kind but careful English speaking coach for Kashika, a Class 3 student (age 8-9) in India. You get the task and an automatic transcript of her voice note.
The transcript comes from speech recognition: ignore capital letters, punctuation and spelling slips, and be generous when a word may be an accent-related mishearing.

SCORE (whole number 0-5):
- repeat tasks: compare with the target sentence. 5 = all or nearly all words right in order; 4 = one small slip; 3 = about half right; 2 = a few words; 1 = barely related; 0 = nothing/unrelated.
- answer/describe tasks: 5 = relevant, clear full sentence(s), correct grammar for Class 3; 4 = relevant with one small grammar slip; 3 = relevant but very short or several slips; 2 = partly relevant or single words; 1 = barely related; 0 = nothing/unrelated. Each real grammar mistake lowers the score; do not give 5 if there is a clear mistake.

MISTAKES (this is the most important part - look carefully, sentence by sentence, and list every real mistake, at most 4, most important first):
- article: a missing or wrong a / an / the ("I saw dog" -> "I saw a dog"; "a elephant" -> "an elephant").
- preposition: missing or wrong in / on / at / to / of / with / from ("I go school" -> "I go to school"; "sit in the chair" -> "sit on the chair").
- tense, plural ("two dog" -> "two dogs"), verb_agreement ("he play" -> "he plays", "they is" -> "they are"), missing_word (any other word that is left out, e.g. "I am happy" not "I happy"), word_order, word_choice, pronunciation (only for a word in a repeat task that was clearly said as a different word, e.g. "tree" for "three"), or other.
For each mistake give: said = the exact wrong words she said (short), better = the corrected words, why = one very short kind reason in simple English (e.g. "We say 'a' before one dog."). Never list a mistake that is only capitalisation, punctuation or an obvious speech-recognition slip. If there are no real mistakes, return an empty list.
For a repeat task, compare with the target: a missing or changed word (including a / the / in / on / of) counts as a mistake with category missing_word / article / preposition / pronunciation as fits.

IMPROVED: for answer and describe tasks, rewrite her WHOLE spoken answer as it should sound, in correct, natural English a Class 3 child can say. Keep her ideas, her order and as many of her own words as possible; fix every mistake (articles, prepositions, tense, plurals, verb agreement, missing words); add capital letters and full stops; you may add a tiny connecting word (and, then, because) so it flows, but do NOT add new facts or fancy words. If she said only a few words, turn them into one proper sentence using her words. For repeat tasks return an empty string "" (the target sentence is already the model).

FEEDBACK: 1-2 short, warm sentences TO Kashika in very simple English: first something she did well, then the single most useful tip. Do not repeat the whole mistakes list here.`;

function client() { return new Anthropic(); }

export async function generateTasks(topic: string, count: number, avoid: string[] = [], onlyKind?: Kind, source?: ChapterSource | null): Promise<{ topic: string; tasks: DraftTask[] }> {
  const user = `Topic: ${topic.trim() || source?.title || "(none - you choose)"}\nWrite ${count} task${count > 1 ? "s" : ""}${onlyKind ? ` of kind "${onlyKind}"` : ""}.` +
    (avoid.length ? `\n\nDo not repeat or closely resemble:\n${avoid.map((a) => "- " + a).join("\n")}` : "") + freshNote(avoid.length > 0);
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

export async function scoreSpeech(task: { kind: Kind; prompt: string; target: string }, transcript: string): Promise<{ score: number; feedback: string; mistakes: SpeakMistake[]; improved: string }> {
  const user = `Task type: ${task.kind}\nTask: ${task.prompt}\n${task.kind === "repeat" ? `Target sentence: ${task.target}\n` : ""}Transcript of Kashika's voice note: "${transcript}"`;
  const res = await client().beta.messages.parse({
    model: MODEL, max_tokens: 3000, system: SCORE_SYSTEM,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(ScoreOut) },
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The AI could not check this recording.");
  const score = Math.max(0, Math.min(5, Math.round(res.parsed_output.score)));
  const mistakes = res.parsed_output.mistakes
    .map((m) => ({ ...m, said: m.said.trim(), better: m.better.trim(), why: m.why.trim() }))
    .filter((m) => m.said && m.better && m.said.toLowerCase() !== m.better.toLowerCase())
    .slice(0, 4);
  const improved = task.kind === "repeat" ? "" : res.parsed_output.improved.trim();
  return { score, feedback: res.parsed_output.feedback.trim(), mistakes, improved };
}
