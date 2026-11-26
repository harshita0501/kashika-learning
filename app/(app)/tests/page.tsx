"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase, today, uploadFile } from "@/lib/supabase";
import { useMe } from "@/lib/session";
import { SUBJECTS, subjectMeta } from "@/lib/constants";
import FileInput from "@/components/FileInput";
import Thumb from "@/components/Thumb";
import { Empty, ErrorBox, PageTitle, Ring, SubjectChip, Tabs } from "@/components/ui";

type T = { id: string; subject: string; title: string; test_date: string; syllabus: string; marks_obtained: number | null; max_marks: number | null; file_paths: string[] };

export default function Tests() {
  const me = useMe();
  const [tests, setTests] = useState<T[]>([]);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"up" | "past">("up");
  const [busy, setBusy] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("tests").select("*").order("test_date", { ascending: false });
    setTests((data ?? []) as T[]);
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
  async function addPaper(t: T, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = (new FormData(e.currentTarget).getAll("file") as File[]).filter((x) => x.size);
    if (!files.length) return;
    setBusy(t.id); setErr("");
    try {
      const paths = await Promise.all(files.map((x) => uploadFile(x, "tests")));
      const { error } = await supabase.from("tests").update({ file_paths: [...t.file_paths, ...paths] }).eq("id", t.id);
      if (error) throw error;
      load();
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }
  async function saveTest(t: T, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("tests").update({
      subject: f.get("subject"), title: f.get("title"), test_date: f.get("date"), syllabus: f.get("syllabus"),
      max_marks: f.get("max") ? Number(f.get("max")) : null,
    }).eq("id", t.id);
    if (error) setErr(error.message); else { setErr(""); setEditId(null); load(); }
  }
  async function removePaper(t: T, p: string) {
    if (!confirm("Remove this photo?")) return;
    await supabase.from("tests").update({ file_paths: t.file_paths.filter((x) => x !== p) }).eq("id", t.id);
    load();
  }
  async function remove(id: string) { if (confirm("Delete this test?")) { await supabase.from("tests").delete().eq("id", id); load(); } }

  const t0 = today();
  const upcoming = tests.filter((t) => t.test_date >= t0).reverse();
  const past = tests.filter((t) => t.test_date < t0);
  const daysTo = (d: string) => Math.round((new Date(d).getTime() - new Date(t0).getTime()) / 86400000);

  const Card = (t: T, i: number) => {
    const isPast = t.test_date < t0;
    const pct = t.marks_obtained !== null && t.max_marks ? Math.round((t.marks_obtained / t.max_marks) * 100) : null;
    const m = subjectMeta(t.subject);
    return (
      <article key={t.id} className="card overflow-hidden fade-up" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
        <div className={`h-2 bg-gradient-to-r ${m.grad}`} />
        <div className="p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <SubjectChip subject={t.subject} />
            {!isPast && <span className={`chip ${daysTo(t.test_date) <= 1 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>⏳ {daysTo(t.test_date) === 0 ? "Today!" : daysTo(t.test_date) === 1 ? "Tomorrow" : `in ${daysTo(t.test_date)} days`}</span>}
            <span className="ml-auto text-xs font-bold text-slate-500">📅 {t.test_date}</span>
          </div>
          {editId === t.id ? (
            <form onSubmit={(e) => saveTest(t, e)} className="space-y-2.5 rounded-2xl bg-amber-50 border border-amber-200 p-3">
              <div className="font-extrabold">✏️ Edit test</div>
              <select name="subject" defaultValue={t.subject} className="field">{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select>
              <input name="title" required defaultValue={t.title} className="field" />
              <div className="flex gap-2"><input type="date" name="date" required defaultValue={t.test_date} className="field" /><input name="max" type="number" defaultValue={t.max_marks ?? ""} placeholder="Total marks" className="field !w-36" /></div>
              <textarea name="syllabus" defaultValue={t.syllabus} placeholder="Syllabus / chapters" className="field" rows={2} />
              <div className="flex gap-2"><button className="btn btn-primary flex-1">Save changes</button><button type="button" onClick={() => setEditId(null)} className="btn btn-ghost">Cancel</button></div>
            </form>
          ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-extrabold text-xl leading-snug">{t.title}</h2>
              {t.syllabus && <p className="text-sm text-slate-600">📖 {t.syllabus}</p>}
            </div>
            {isPast && pct !== null && (
              <Ring value={pct} max={100} size={76} stroke={9} from={pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#fb7185"} to={pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"}>
                <div><div className="font-display font-extrabold text-sm leading-none">{t.marks_obtained}/{t.max_marks}</div><div className="text-[10px] font-bold text-slate-500">{pct}%</div></div>
              </Ring>
            )}
          </div>
          )}
          {isPast && pct === null && <p className="text-sm font-bold text-slate-400">Marks not added yet</p>}
          {t.file_paths.length > 0 && <div className="flex flex-wrap gap-3">{t.file_paths.map((p, k) => (
            <div key={p} className="relative"><Thumb path={p} label={`Paper ${k + 1}`} />
              {me.role === "teacher" && <button onClick={() => removePaper(t, p)} className="absolute -top-2 -right-2 size-7 rounded-full bg-rose-500 text-white text-sm font-extrabold shadow" title="Remove photo">✕</button>}
            </div>))}</div>}

          {me.role === "teacher" && isPast && (
            <div className="space-y-2 border-t border-dashed border-violet-200 pt-3">
              <form onSubmit={(e) => setMarks(t.id, e)} className="flex items-center gap-2">
                <input name="marks" type="number" step="0.5" defaultValue={t.marks_obtained ?? ""} placeholder="Marks" className="field !w-28" />
                <span className="font-bold">/ {t.max_marks ?? "?"}</span>
                <button className="btn btn-soft">Save marks</button>
              </form>
              <form onSubmit={(e) => addPaper(t, e)} className="space-y-2">
                <FileInput name="file" multiple label="Add checked paper (photo)" />
                <button disabled={busy === t.id} className="btn btn-soft">{busy === t.id ? "Uploading…" : "Upload paper"}</button>
              </form>
            </div>
          )}
          {me.role === "teacher" && editId !== t.id && (
            <div className="flex gap-2">
              <button onClick={() => setEditId(t.id)} className="btn btn-soft !py-1.5 text-sm">✏️ Edit</button>
              <button onClick={() => remove(t.id)} className="btn btn-ghost !py-1.5 text-sm !text-rose-600">🗑 Delete</button>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-4">
      <PageTitle emoji="🏆" title="Tests" sub="Upcoming tests and past marks" />
      {err && <ErrorBox>{err}</ErrorBox>}
      {me.role === "teacher" && (
        <details className="card p-4 fade-up">
          <summary className="font-extrabold cursor-pointer select-none">➕ Schedule a test</summary>
          <form onSubmit={add} className="space-y-2.5 mt-3">
            <select name="subject" className="field">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
            <input name="title" required placeholder="Test name (e.g. Unit Test 1)" className="field" />
            <div className="flex gap-2"><input type="date" name="date" required className="field" /><input name="max" type="number" placeholder="Total marks" className="field !w-36" /></div>
            <textarea name="syllabus" placeholder="Syllabus / chapters" className="field" rows={2} />
            <button className="btn btn-primary btn-big">Add test</button>
          </form>
        </details>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "up", label: "Upcoming", count: upcoming.length }, { id: "past", label: "Past tests & marks" }]} />
      {tab === "up" && (upcoming.length ? upcoming.map(Card) : <Empty emoji="🌈" title="No upcoming tests" sub="Relax and keep learning!" />)}
      {tab === "past" && (past.length ? past.map(Card) : <Empty emoji="📭" title="No past tests yet" />)}
    </div>
  );
}
