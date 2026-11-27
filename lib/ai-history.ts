import type { SupabaseClient } from "@supabase/supabase-js";

export type Kind = "quiz" | "flashcards" | "speaking";

/** A stable key for "the same topic": the book chapter if there is one, otherwise the topic text (lower-cased). */
export const topicKey = (topic: string | null | undefined, chapterId?: string | null) =>
  chapterId ? `ch:${chapterId}` : (topic ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** What the AI already made for this topic (newest first), so a repeat request can be told to avoid it. */
export async function pastItems(supabase: SupabaseClient, kind: Kind, subject: string, key: string): Promise<string[]> {
  if (!key) return [];
  const { data } = await supabase.from("ai_history").select("item").eq("kind", kind).eq("subject", subject).eq("topic_key", key)
    .order("created_at", { ascending: false }).limit(80);
  return (data ?? []).map((x) => x.item as string);
}

export async function remember(supabase: SupabaseClient, kind: Kind, subject: string, key: string, items: string[]) {
  if (!key || !items.length) return;
  await supabase.from("ai_history").insert(items.map((item) => ({ kind, subject, topic_key: key, item: item.slice(0, 300) })));
}

/** Extra instruction for the AI: be different from before, and vary even with no history. */
export function freshNote(hasHistory: boolean) {
  const code = Math.random().toString(36).slice(2, 8);
  return (hasHistory
    ? "\n\nThis topic has been used before (the earlier items are listed above). Make a clearly FRESH set: different questions, different numbers/examples/words, and different angles - not rewordings of the old ones."
    : "\n\nPick varied, not-the-most-obvious items.") + ` (variation code ${code} - just use it to vary your choices)`;
}
