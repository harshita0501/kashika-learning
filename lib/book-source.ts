import type { SupabaseClient } from "@supabase/supabase-js";

type Block =
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } }
  | { type: "text"; text: string };

export type ChapterSource = { title: string; bookTitle: string; blocks: Block[] };

const MAX_BYTES = 24 * 1024 * 1024; // Anthropic request limit is 32 MB; base64 adds ~33%
const IMG: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

async function filesToBlocks(supabase: SupabaseClient, paths: string[], startBytes = 0): Promise<{ blocks: Block[]; bytes: number }> {
  const blocks: Block[] = [];
  let total = startBytes;
  for (const p of paths) {
    const { data, error } = await supabase.storage.from("uploads").download(p);
    if (error || !data) throw new Error("Could not open an uploaded file.");
    const buf = Buffer.from(await data.arrayBuffer());
    total += buf.length;
    if (total > MAX_BYTES) throw new Error("These files are too large to read at once. Use fewer pages or smaller photos.");
    const ext = p.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "pdf") blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } });
    else if (IMG[ext]) blocks.push({ type: "image", source: { type: "base64", media_type: IMG[ext], data: buf.toString("base64") } });
    else throw new Error(`Unsupported file type .${ext}. Please upload PDF, JPG or PNG.`);
  }
  return { blocks, bytes: total };
}

/**
 * Builds the source material for the AI: a book chapter, ma'am's own uploaded photos/PDFs, or both.
 * Returns null when neither is given.
 */
export async function loadSource(supabase: SupabaseClient, chapterId?: string | null, paths: string[] = [], fallbackTitle = ""): Promise<ChapterSource | null> {
  if (!chapterId && !paths.length) return null;
  const blocks: Block[] = [];
  let title = fallbackTitle || "the uploaded pages", bookTitle = "", bytes = 0;
  if (chapterId) {
    const { data: ch } = await supabase.from("book_chapters").select("title, file_paths, books(title)").eq("id", chapterId).maybeSingle();
    if (!ch) throw new Error("That book chapter was not found.");
    if (!ch.file_paths?.length) throw new Error("This chapter has no pages uploaded yet.");
    const r = await filesToBlocks(supabase, ch.file_paths as string[]);
    blocks.push(...r.blocks); bytes = r.bytes;
    title = ch.title as string; bookTitle = (ch.books as unknown as { title: string } | null)?.title ?? "";
  }
  if (paths.length) {
    const safe = paths.filter((p) => /^sources\/[\w.\-]+$/.test(p)).slice(0, 12);
    const r = await filesToBlocks(supabase, safe, bytes);
    blocks.push(...r.blocks);
  }
  return { title, bookTitle, blocks };
}

/** Back-compat helper for a single chapter. */
export const loadChapter = (supabase: SupabaseClient, chapterId: string) => loadSource(supabase, chapterId).then((x) => x!);

/** User message content: the chapter (if any) followed by the instruction text. */
export function withSource(text: string, source?: ChapterSource | null) {
  if (!source) return text;
  return [
    ...source.blocks,
    { type: "text" as const, text: `${text}\n\nUse ONLY the attached school book chapter ("${source.title}" from ${source.bookTitle || "a school book"}) as your source material. Stay with what this chapter actually teaches and keep it at Class 3 level. Do not invent facts that are not in the chapter.` },
  ];
}
