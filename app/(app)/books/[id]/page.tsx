"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, uploadFile } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { subjectMeta } from "@/lib/constants";
import FileInput from "@/components/FileInput";
import ChapterReader from "@/components/ChapterReader";
import { ErrorBox } from "@/components/ui";
import { useTodo } from "@/lib/todo";

type Book = { id: string; title: string; subject: string; publisher: string; description: string; emoji: string; kind: "ncert" | "custom"; class_level: number; source_note: string };
type Chapter = { id: string; position: number; title: string; file_paths: string[] };

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const todo = useTodo();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [reading, setReading] = useState<Chapter | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [b, c] = await Promise.all([
      supabase.from("books").select("*").eq("id", id).maybeSingle(),
      supabase.from("book_chapters").select("*").eq("book_id", id).order("position"),
    ]);
    setBook(b.data as Book | null); setChapters((c.data ?? []) as Chapter[]); setLoaded(true);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!loaded) return <div className="text-center py-16 text-5xl float">🦉</div>;
  if (!book) return <p>Book not found.</p>;
  const isTeacher = me.role === "teacher";
  const m = subjectMeta(book.subject);

  async function addChapter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; const f = new FormData(form);
    const files = (f.getAll("file") as File[]).filter((x) => x.size);
    if (!files.length) { setErr("Please choose a PDF or photos of the pages."); return; }
    setBusy("add"); setErr("");
    try {
      const paths = await Promise.all(files.map((x) => uploadFile(x, "books/custom")));
      const { error } = await supabase.from("book_chapters").insert({ book_id: id, position: chapters.length, title: f.get("title"), file_paths: paths });
      if (error) throw error;
      form.reset(); load();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function delChapter(c: Chapter) {
    if (!confirm(`Remove "${c.title}"?`)) return;
    await supabase.from("book_chapters").delete().eq("id", c.id);
    if (book!.kind === "custom") await supabase.storage.from("uploads").remove(c.file_paths);
    load();
  }
  async function delBook() {
    if (!confirm(`Delete the book "${book!.title}" and all its chapters?`)) return;
    const paths = chapters.flatMap((c) => c.file_paths);
    await supabase.from("books").delete().eq("id", id);
    if (book!.kind === "custom" && paths.length) await supabase.storage.from("uploads").remove(paths);
    router.push("/books");
  }

  /** Ask the AI to build something from this chapter, then go review it. */
  async function make(kind: "quiz" | "cards" | "speak", c: Chapter) {
    setBusy(c.id + kind); setErr("");
    try {
      const url = kind === "quiz" ? "/api/quiz/generate" : kind === "cards" ? "/api/flashcards/generate" : "/api/speaking/generate";
      const body = kind === "quiz" ? { chapters: { [book!.subject === "EVS" ? "EVS" : book!.subject]: c.id } } : { chapter_id: c.id };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      if (kind === "quiz" && j.results?.[0] && !j.results[0].ok) throw new Error(j.results[0].error);
      todo.refresh();
      router.push(kind === "quiz" ? "/quizzes" : kind === "cards" ? `/flashcards/${j.id}` : `/speaking/${j.id}`);
    } catch (x) { setErr((x as Error).message); setBusy(null); }
  }

  return (
    <div className="space-y-3">
      {reading && <ChapterReader title={`${book.title} · ${reading.title}`} paths={reading.file_paths} onClose={() => setReading(null)} />}
      <button onClick={() => router.push("/books")} className="text-sm font-extrabold text-violet-600">‹ All books</button>
      <div className={`rounded-[1.75rem] p-4 text-white bg-gradient-to-br ${m.grad} shadow-lg fade-up flex items-center gap-3`}>
        <span className="text-6xl drop-shadow">{book.emoji}</span>
        <div className="min-w-0">
          <div className="text-white/85 text-xs font-extrabold uppercase tracking-wide">{book.subject} · Class {book.class_level}</div>
          <h1 className="text-3xl font-extrabold leading-tight">{book.title}</h1>
          <div className="text-white/85 text-sm font-bold">{book.publisher || "My book"}{book.kind === "ncert" && " · Official NCERT ✓"}</div>
        </div>
      </div>
      {book.description && <p className="text-sm text-slate-600 px-1">{book.description}</p>}
      {err && <ErrorBox>{err}</ErrorBox>}
      {isTeacher && <p className="text-xs text-slate-500 px-1">💡 Tap <b>Quiz / Cards / Speak</b> on a chapter and the AI will read that chapter and make questions from it. You review before Kashika sees anything.</p>}

      <div className="space-y-2">
        {chapters.map((c, i) => (
          <article key={c.id} className="card p-3.5 fade-up" style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}>
            <div className="flex items-center gap-3">
              <span className={`size-10 rounded-2xl grid place-items-center text-white font-extrabold bg-gradient-to-br ${m.grad}`}>{i + 1}</span>
              <div className="flex-1 min-w-0 font-extrabold leading-snug">{c.title}</div>
              <button onClick={() => setReading(c)} className="btn btn-primary !py-2 text-sm">📖 Read</button>
            </div>
            {isTeacher && (
              <div className="flex flex-wrap gap-2 mt-2.5 pl-[3.25rem]">
                <button disabled={!!busy} onClick={() => make("quiz", c)} className="btn btn-soft !py-1.5 !px-3 text-sm">{busy === c.id + "quiz" ? "Reading… ⏳" : "🧠 Quiz"}</button>
                <button disabled={!!busy} onClick={() => make("cards", c)} className="btn btn-soft !py-1.5 !px-3 text-sm">{busy === c.id + "cards" ? "Reading… ⏳" : "🃏 Cards"}</button>
                <button disabled={!!busy} onClick={() => make("speak", c)} className="btn btn-soft !py-1.5 !px-3 text-sm">{busy === c.id + "speak" ? "Reading… ⏳" : "🎤 Speak"}</button>
                <button disabled={!!busy} onClick={() => delChapter(c)} className="text-rose-500 text-sm font-bold px-1">🗑</button>
              </div>
            )}
          </article>
        ))}
        {chapters.length === 0 && <div className="card p-6 text-center text-slate-500 font-semibold">No chapters yet.</div>}
      </div>

      {isTeacher && (
        <>
          <details className="card p-4 fade-up">
            <summary className="font-extrabold cursor-pointer select-none">➕ Add a chapter</summary>
            <form onSubmit={addChapter} className="space-y-2.5 mt-3">
              <input name="title" required placeholder="Chapter name (e.g. 4. Plants Around Us)" className="field" />
              <FileInput name="file" multiple accept="application/pdf,image/*" label="Upload chapter (PDF or photos of the pages)" />
              <button disabled={busy === "add"} className="btn btn-primary btn-big">{busy === "add" ? "Uploading…" : "Add chapter"}</button>
              <p className="text-xs text-slate-500">Keep each chapter under about 20 MB so the AI can read it. Use clear, straight photos.</p>
            </form>
          </details>
          <button onClick={delBook} className="text-rose-600 text-sm font-bold">🗑 Delete this book</button>
        </>
      )}
    </div>
  );
}
