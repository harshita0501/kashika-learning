"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, subjectMeta } from "@/lib/constants";
import { Empty, ErrorBox, PageTitle } from "@/components/ui";

type Book = { id: string; title: string; subject: string; publisher: string; description: string; emoji: string; kind: "ncert" | "custom"; class_level: number; book_chapters: { id: string }[] };

export default function Books() {
  const me = useMe();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("books").select("*, book_chapters(id)").order("subject").order("title");
    setBooks((data ?? []) as Book[]); setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { data, error } = await supabase.from("books").insert({
      title: f.get("title"), subject: f.get("subject"), publisher: f.get("publisher") ?? "", class_level: 3, kind: "custom", emoji: subjectMeta(f.get("subject") as string).icon,
      description: f.get("description") ?? "",
    }).select("id").single();
    if (error) setErr(error.message); else router.push(`/books/${data.id}`);
  }

  const isTeacher = me.role === "teacher";
  const subjects = [...SUBJECTS].filter((s) => books.some((b) => b.subject === s));

  return (
    <div className="space-y-4">
      <PageTitle emoji="📖" title="Books" sub="Class 3 textbooks — read them, and make quizzes from them" />
      {err && <ErrorBox>{err}</ErrorBox>}

      {isTeacher && (
        <details className="card p-4 fade-up">
          <summary className="font-extrabold cursor-pointer select-none">➕ Add my own book</summary>
          <p className="text-sm text-slate-600 mt-2">For books your school uses (Oxford, S. Chand, Rachna Sagar…): add the book here, then upload each chapter as a PDF or photos of the pages.</p>
          <form onSubmit={addBook} className="space-y-2.5 mt-3">
            <input name="title" required placeholder="Book name (e.g. Together With Science 3)" className="field" />
            <div className="flex gap-2">
              <select name="subject" className="field">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
              <input name="publisher" placeholder="Publisher" className="field" />
            </div>
            <input name="description" placeholder="Note (optional)" className="field" />
            <button className="btn btn-primary btn-big">Add book</button>
          </form>
        </details>
      )}

      {loaded && books.length === 0 && <Empty emoji="📚" title="No books yet" sub={isTeacher ? "Add your first book above" : "Ma'am will add the books soon"} />}

      {subjects.map((s) => (
        <section key={s} className="space-y-2">
          <h2 className="font-display font-extrabold text-xl">{subjectMeta(s).icon} {s}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {books.filter((b) => b.subject === s).map((b, i) => (
              <Link key={b.id} href={`/books/${b.id}`} className="card card-lift overflow-hidden fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={`p-4 text-white bg-gradient-to-br ${subjectMeta(s).grad} flex items-center gap-3`}>
                  <span className="text-5xl drop-shadow">{b.emoji}</span>
                  <div className="min-w-0"><div className="font-display font-extrabold text-2xl leading-tight">{b.title}</div><div className="text-white/85 text-sm font-bold">Class {b.class_level} · {b.publisher || "My book"}</div></div>
                </div>
                <div className="p-3 text-sm space-y-1">
                  <p className="text-slate-600 line-clamp-2">{b.description}</p>
                  <div className="flex items-center gap-2"><span className="chip bg-violet-100 text-violet-800">{b.book_chapters.length} chapters</span>{b.kind === "ncert" && <span className="chip bg-emerald-100 text-emerald-800">✓ Official NCERT</span>}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
