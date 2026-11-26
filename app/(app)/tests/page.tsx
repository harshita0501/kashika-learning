"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase, today } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, SUBJECT_STYLE } from "@/lib/constants";

type T = { id: string; subject: string; title: string; test_date: string; syllabus: string; marks_obtained: number | null; max_marks: number | null };

export default function Tests() {
  const me = useMe();
  const [tests, setTests] = useState<T[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("tests").select("*").order("test_date", { ascending: false });
    setTests(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase.from("tests").insert({
      subject: f.get("subject"), title: f.get("title"), test_date: f.get("date"), syllabus: f.get("syllabus"),
      max_marks: f.get("max") ? Number(f.get("max")) : null,
    });
    if (error) setErr(error.message); else { setErr(""); form.reset(); load(); }
  }

  async function setMarks(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget).get("marks");
    await supabase.from("tests").update({ marks_obtained: v === "" ? null : Number(v) }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (confirm("Delete this test?")) { await supabase.from("tests").delete().eq("id", id); load(); }
  }

  const t0 = today();
  const upcoming = tests.filter((t) => t.test_date >= t0).reverse();
  const past = tests.filter((t) => t.test_date < t0);

  const Card = (t: T) => (
    <article key={t.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${SUBJECT_STYLE[t.subject]}`}>{t.subject}</span>
        <span className="text-xs text-gray-500 ml-auto">{t.test_date}</span>
      </div>
      <h3 className="font-bold">{t.title}</h3>
      {t.syllabus && <p className="text-sm text-gray-700">Syllabus: {t.syllabus}</p>}
      {t.test_date < t0 && (
        me.role === "teacher" ? (
          <form onSubmit={(e) => setMarks(t.id, e)} className="flex items-center gap-2 pt-1">
            <input name="marks" type="number" step="0.5" defaultValue={t.marks_obtained ?? ""} placeholder="Marks" className="border rounded-xl px-3 py-1 w-24 text-sm" />
            <span className="text-sm">/ {t.max_marks ?? "?"}</span>
            <button className="text-indigo-600 text-sm font-semibold">Save</button>
          </form>
        ) : (
          <p className="font-semibold">{t.marks_obtained === null ? "Marks not added yet" : `Marks: ${t.marks_obtained} / ${t.max_marks ?? "?"}`}</p>
        )
      )}
      {me.role === "teacher" && <button onClick={() => remove(t.id)} className="text-xs text-red-500">Delete</button>}
    </article>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🏆 Tests</h1>
      {err && <p className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{err}</p>}
      {me.role === "teacher" && (
        <details className="bg-white rounded-2xl p-4 shadow-sm">
          <summary className="font-semibold cursor-pointer">➕ Schedule a test</summary>
          <form onSubmit={add} className="space-y-2 mt-3">
            <select name="subject" className="w-full border rounded-xl px-3 py-2">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
            <input name="title" required placeholder="Test name (e.g. Unit Test 1)" className="w-full border rounded-xl px-3 py-2" />
            <input type="date" name="date" required className="border rounded-xl px-3 py-2" />
            <input name="max" type="number" placeholder="Total marks" className="border rounded-xl px-3 py-2 ml-2 w-32" />
            <textarea name="syllabus" placeholder="Syllabus / chapters" className="w-full border rounded-xl px-3 py-2" />
            <button className="bg-indigo-600 text-white rounded-xl px-5 py-2 font-semibold">Add test</button>
          </form>
        </details>
      )}
      <h2 className="font-bold">Upcoming</h2>
      {upcoming.length ? upcoming.map(Card) : <p className="text-gray-500 text-sm">No upcoming tests.</p>}
      <h2 className="font-bold pt-2">Past tests</h2>
      {past.length ? past.map(Card) : <p className="text-gray-500 text-sm">Nothing yet.</p>}
    </div>
  );
}
