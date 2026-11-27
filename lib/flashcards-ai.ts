import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { withSource, type ChapterSource } from "./book-source";
import { freshNote } from "./ai-history";

const MODEL = process.env.QUIZ_MODEL || "claude-opus-5-5";

const Card = z.object({
  word: z.string(), // the English word (or tiny phrase) on the FRONT
  emoji: z.string(), // ONE emoji that hints at the meaning ("" if none fits)
  meaning: z.string(), // simple English meaning for a Class 3 child, max ~10 words
  example: z.string(), // one short sentence (max ~10 words) using the word
  hindi: z.string(), // the meaning in simple Hindi (Devanagari), 1-4 words
});
const Out = z.object({ topic: z.string(), cards: z.array(Card) });

export type DraftCard = z.infer<typeof Card>;

const SYSTEM = `You make vocabulary flashcards for Kashika, a Class 3 student (age 8-9) in India learning English.
Front of card = one English word. Back = what it means, written for an 8-year-old.
Rules:
- Pick words a Class 3 child can realistically learn and use: concrete, useful, not too rare. Mix nouns, verbs and adjectives when the topic allows.
- meaning: very simple English, ONE short sentence, using only easier words than the word itself. Never define a word with the word itself.
- example: one short, cheerful sentence using the word in a child's world (home, school, animals, food, games).
- hindi: the meaning in simple Hindi, Devanagari script, 1-4 words.
- emoji: one emoji that helps remember the word (empty string if none fits).
- No duplicates, nothing scary or sensitive. Spelling must be correct.
If no topic is given, choose a fun everyday theme (e.g. kitchen, feelings, weather, animals, school, festival) and return it in "topic".`;

export async function generateCards(topic: string, count: number, avoid: string[] = [], source?: ChapterSource | null): Promise<{ topic: string; cards: DraftCard[] }> {
  const user = `Topic: ${topic.trim() || source?.title || "(none - you choose)"}\nMake ${count} flashcard${count > 1 ? "s" : ""}.` +
    (avoid.length ? `\n\nDo not use these words again: ${avoid.join(", ")}` : "") + freshNote(avoid.length > 0);
  const res = await new Anthropic().beta.messages.parse({
    model: MODEL, max_tokens: 6000, system: SYSTEM,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "low", format: zodOutputFormat(Out) },
    messages: [{ role: "user", content: withSource(user, source) as never }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("The AI could not write these flashcards. Try a different topic.");
  const seen = new Set(avoid.map((a) => a.toLowerCase()));
  const cards = res.parsed_output.cards
    .map((c) => ({ word: c.word.trim(), emoji: c.emoji.trim(), meaning: c.meaning.trim(), example: c.example.trim(), hindi: c.hindi.trim() }))
    .filter((c) => c.word && c.meaning && !seen.has(c.word.toLowerCase()) && (seen.add(c.word.toLowerCase()), true));
  return { topic: res.parsed_output.topic.trim() || topic.trim(), cards };
}
